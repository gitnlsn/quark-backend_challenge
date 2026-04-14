import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ENRICHMENT_QUEUE, CLASSIFICATION_QUEUE } from './queue.constants.js';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private connection: amqp.AmqpConnectionManager;
  private channel: ChannelWrapper;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>(
      'RABBITMQ_URL',
      'amqp://guest:guest@localhost:5672',
    );
    this.connection = amqp.connect([url]);

    this.connection.on('connect', () =>
      this.logger.log('Connected to RabbitMQ'),
    );
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn('Disconnected from RabbitMQ', err?.message),
    );

    this.channel = this.connection.createChannel({
      setup: async (ch: amqp.Channel) => {
        await ch.assertQueue(ENRICHMENT_QUEUE, { durable: true });
        await ch.assertQueue(CLASSIFICATION_QUEUE, { durable: true });
      },
    });
  }

  async publish(queue: string, message: Record<string, unknown>) {
    await this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
      },
    );
    this.logger.log(`Published message to ${queue}`);
  }

  getChannel(): ChannelWrapper {
    return this.channel;
  }
}
