import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as amqplib from 'amqplib';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from '../src/queue/queue.service.js';
import {
  ENRICHMENT_QUEUE,
  CLASSIFICATION_QUEUE,
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

      rawCh.consume(queue, (msg) => {
        if (!msg) return;
        clearTimeout(timer);
        rawCh.ack(msg);
        rawCh.cancel(msg.fields.consumerTag).then(() => resolve(msg));
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
    const body = JSON.parse(msg.content.toString());

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
    const body = JSON.parse(msg.content.toString());

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

      rawCh.consume(ENRICHMENT_QUEUE, (msg) => {
        if (!msg) return;
        rawCh.ack(msg);
        ids.push(JSON.parse(msg.content.toString()).leadId);
        if (ids.length === 3) {
          clearTimeout(timer);
          rawCh.cancel(msg.fields.consumerTag).then(() => resolve(ids));
        }
      });
    });

    expect(received).toEqual(['fifo-1', 'fifo-2', 'fifo-3']);
  });
});
