import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as amqplib from 'amqplib';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from '../src/queue/queue.service.js';
import {
  ENRICHMENT_QUEUE,
  CLASSIFICATION_QUEUE,
  ENRICHMENT_DLQ,
  CLASSIFICATION_DLQ,
} from '../src/queue/queue.constants.js';

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

describe('QueueService Integration (RabbitMQ)', () => {
  let queueService: QueueService;
  let rawConn: amqplib.ChannelModel;
  let rawCh: amqplib.Channel;
  let rabbitAvailable = false;

  beforeAll(async () => {
    try {
      rawConn = await amqplib.connect(RABBITMQ_URL);
      rawCh = await rawConn.createChannel();
      rabbitAvailable = true;
    } catch {
      console.warn(
        `RabbitMQ is not reachable at ${RABBITMQ_URL} — skipping integration tests`,
      );
      return;
    }

    // Delete any pre-existing queues so QueueService can re-assert them with
    // the current arguments (DLX bindings may have changed across versions).
    for (const queue of [
      ENRICHMENT_QUEUE,
      CLASSIFICATION_QUEUE,
      ENRICHMENT_DLQ,
      CLASSIFICATION_DLQ,
    ]) {
      try {
        await rawCh.deleteQueue(queue);
      } catch {
        // Channel may have errored; reopen
        try {
          rawCh = await rawConn.createChannel();
        } catch {
          // ignore
        }
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [QueueService],
    }).compile();

    queueService = moduleRef.get(QueueService);
    queueService.onModuleInit();
    await queueService.getChannel().waitForConnect();
  });

  beforeEach(async () => {
    if (!rabbitAvailable) return;
    await rawCh.purgeQueue(ENRICHMENT_QUEUE);
    await rawCh.purgeQueue(CLASSIFICATION_QUEUE);
    await rawCh.purgeQueue(ENRICHMENT_DLQ);
    await rawCh.purgeQueue(CLASSIFICATION_DLQ);
  });

  afterAll(async () => {
    if (!rabbitAvailable) return;
    try {
      await rawCh.close();
    } catch {
      // Channel may already be closed
    }
    try {
      await rawConn.close();
    } catch {
      // Connection may already be closed
    }
  });

  /** Consume exactly one message, then cancel the consumer. */
  function consumeOneMessage(
    queue: string,
    timeoutMs = 10000,
  ): Promise<amqplib.ConsumeMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for message')),
        timeoutMs,
      );

      void rawCh.consume(queue, (msg) => {
        if (!msg) return;
        clearTimeout(timer);
        rawCh.ack(msg);
        void rawCh.cancel(msg.fields.consumerTag).then(() => resolve(msg));
      });
    });
  }

  it('should connect to RabbitMQ and create a channel', () => {
    if (!rabbitAvailable) return;
    expect(queueService.getChannel()).toBeDefined();
  });

  it('should publish a message without errors', async () => {
    if (!rabbitAvailable) return;

    await expect(
      queueService.publish(ENRICHMENT_QUEUE, {
        leadId: 'test-1',
        requestedAt: new Date().toISOString(),
      }),
    ).resolves.not.toThrow();
  });

  it('should publish and consume a message from the enrichment queue', async () => {
    if (!rabbitAvailable) return;

    const payload = {
      leadId: 'test-enrich',
      requestedAt: new Date().toISOString(),
    };

    const consumePromise = consumeOneMessage(ENRICHMENT_QUEUE);
    await queueService.publish(ENRICHMENT_QUEUE, payload);

    const msg = await consumePromise;
    const body = JSON.parse(msg.content.toString()) as {
      leadId: string;
      requestedAt: string;
    };

    expect(body).toMatchObject({
      leadId: 'test-enrich',
      requestedAt: payload.requestedAt,
    });
  });

  it('should publish and consume a message from the classification queue', async () => {
    if (!rabbitAvailable) return;

    const payload = {
      leadId: 'test-classify',
      requestedAt: new Date().toISOString(),
    };

    const consumePromise = consumeOneMessage(CLASSIFICATION_QUEUE);
    await queueService.publish(CLASSIFICATION_QUEUE, payload);

    const msg = await consumePromise;
    const body = JSON.parse(msg.content.toString()) as {
      leadId: string;
      requestedAt: string;
    };

    expect(body).toMatchObject({
      leadId: 'test-classify',
      requestedAt: payload.requestedAt,
    });
  });

  it('should deliver messages with persistent flag (deliveryMode=2)', async () => {
    if (!rabbitAvailable) return;

    const consumePromise = consumeOneMessage(ENRICHMENT_QUEUE);
    await queueService.publish(ENRICHMENT_QUEUE, {
      leadId: 'test-persistent',
      requestedAt: new Date().toISOString(),
    });

    const msg = await consumePromise;
    expect(msg.properties.deliveryMode).toBe(2);
  });

  it('should handle multiple messages in FIFO order', async () => {
    if (!rabbitAvailable) return;

    const messages = [
      { leadId: 'fifo-1', requestedAt: new Date().toISOString() },
      { leadId: 'fifo-2', requestedAt: new Date().toISOString() },
      { leadId: 'fifo-3', requestedAt: new Date().toISOString() },
    ];

    for (const msg of messages) {
      await queueService.publish(ENRICHMENT_QUEUE, msg);
    }

    // Consume all messages with a single consumer to avoid cancel/re-register races
    const received = await new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for FIFO messages')),
        10000,
      );
      const ids: string[] = [];

      void rawCh.consume(ENRICHMENT_QUEUE, (msg) => {
        if (!msg) return;
        rawCh.ack(msg);
        const parsed = JSON.parse(msg.content.toString()) as { leadId: string };
        ids.push(parsed.leadId);
        if (ids.length === 3) {
          clearTimeout(timer);
          void rawCh.cancel(msg.fields.consumerTag).then(() => resolve(ids));
        }
      });
    });

    expect(received).toEqual(['fifo-1', 'fifo-2', 'fifo-3']);
  });

  it('should route NACKed messages to the enrichment DLQ', async () => {
    if (!rabbitAvailable) return;

    const payload = {
      leadId: 'test-dlq',
      requestedAt: new Date().toISOString(),
    };
    await queueService.publish(ENRICHMENT_QUEUE, payload);

    // Consume once and NACK without requeue — should land in the DLQ
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for main queue message')),
        10000,
      );
      void rawCh.consume(ENRICHMENT_QUEUE, (msg) => {
        if (!msg) return;
        clearTimeout(timer);
        rawCh.nack(msg, false, false);
        void rawCh.cancel(msg.fields.consumerTag).then(() => resolve());
      });
    });

    const dlqMsg = await consumeOneMessage(ENRICHMENT_DLQ);
    const body = JSON.parse(dlqMsg.content.toString()) as { leadId: string };
    expect(body.leadId).toBe('test-dlq');
  });
});
