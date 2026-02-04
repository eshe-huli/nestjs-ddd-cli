import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyMessageQueueRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const mqPath = path.join(sharedPath, 'messaging');

  await ensureDir(mqPath);
  await ensureDir(path.join(mqPath, 'producers'));
  await ensureDir(path.join(mqPath, 'consumers'));
  await ensureDir(path.join(mqPath, 'decorators'));

  // Message types
  const messageTypesContent = `export interface Message<T = any> {
  id: string;
  type: string;
  payload: T;
  metadata: MessageMetadata;
  timestamp: Date;
}

export interface MessageMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  retryCount?: number;
  maxRetries?: number;
  priority?: number;
  headers?: Record<string, string>;
}

export interface MessageHandler<T = any> {
  handle(message: Message<T>): Promise<void>;
}

export interface PublishOptions {
  exchange?: string;
  routingKey?: string;
  persistent?: boolean;
  priority?: number;
  expiration?: number;
  headers?: Record<string, any>;
  delay?: number;
}

export interface ConsumeOptions {
  queue: string;
  prefetch?: number;
  noAck?: boolean;
  exclusive?: boolean;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  retryDelay?: number;
  maxRetries?: number;
}

export type ExchangeType = "direct" | "topic" | "fanout" | "headers";

export interface ExchangeConfig {
  name: string;
  type: ExchangeType;
  durable?: boolean;
  autoDelete?: boolean;
}

export interface QueueConfig {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  messageTtl?: number;
  maxLength?: number;
}
`;
  await writeFile(path.join(mqPath, 'message.types.ts'), messageTypesContent);

  // RabbitMQ Connection
  const connectionContent = `import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import * as amqp from "amqplib";

export interface RabbitMQConfig {
  url: string;
  heartbeat?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

@Injectable()
export class RabbitMQConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConnection.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;

  private config: RabbitMQConfig = {
    url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
    heartbeat: 60,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
  };

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.connection = await amqp.connect(this.config.url, {
        heartbeat: this.config.heartbeat,
      });

      this.connection.on("error", (err) => {
        this.logger.error("RabbitMQ connection error:", err.message);
      });

      this.connection.on("close", () => {
        this.logger.warn("RabbitMQ connection closed, attempting reconnect...");
        this.scheduleReconnect();
      });

      this.channel = await this.connection.createChannel();
      this.reconnectAttempts = 0;
      this.logger.log("Connected to RabbitMQ");
    } catch (error) {
      this.logger.error("Failed to connect to RabbitMQ:", error);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      this.logger.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => this.connect(), this.config.reconnectDelay);
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.logger.log("Disconnected from RabbitMQ");
    } catch (error) {
      this.logger.error("Error disconnecting from RabbitMQ:", error);
    }
  }

  getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }
    return this.channel;
  }

  isConnected(): boolean {
    return this.channel !== null;
  }
}
`;
  await writeFile(path.join(mqPath, 'rabbitmq.connection.ts'), connectionContent);

  // Message Producer
  const producerContent = `import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { RabbitMQConnection } from "../rabbitmq.connection";
import { Message, MessageMetadata, PublishOptions, ExchangeConfig, ExchangeType } from "../message.types";

@Injectable()
export class MessageProducer {
  private readonly logger = new Logger(MessageProducer.name);
  private declaredExchanges: Set<string> = new Set();

  constructor(private connection: RabbitMQConnection) {}

  /**
   * Publish a message to an exchange
   */
  async publish<T>(
    type: string,
    payload: T,
    options: PublishOptions = {}
  ): Promise<string> {
    const channel = this.connection.getChannel();
    const messageId = uuid();

    const message: Message<T> = {
      id: messageId,
      type,
      payload,
      metadata: {
        correlationId: options.headers?.correlationId,
        priority: options.priority,
      },
      timestamp: new Date(),
    };

    const exchange = options.exchange || "events";
    const routingKey = options.routingKey || type;

    await this.ensureExchange(exchange, "topic");

    const content = Buffer.from(JSON.stringify(message));

    channel.publish(exchange, routingKey, content, {
      persistent: options.persistent !== false,
      messageId,
      timestamp: Date.now(),
      contentType: "application/json",
      priority: options.priority,
      expiration: options.expiration?.toString(),
      headers: options.headers,
    });

    this.logger.debug(\`Published message \${messageId} to \${exchange}:\${routingKey}\`);
    return messageId;
  }

  /**
   * Publish directly to a queue
   */
  async sendToQueue<T>(
    queue: string,
    type: string,
    payload: T,
    metadata?: Partial<MessageMetadata>
  ): Promise<string> {
    const channel = this.connection.getChannel();
    const messageId = uuid();

    const message: Message<T> = {
      id: messageId,
      type,
      payload,
      metadata: {
        ...metadata,
      },
      timestamp: new Date(),
    };

    const content = Buffer.from(JSON.stringify(message));

    channel.sendToQueue(queue, content, {
      persistent: true,
      messageId,
      timestamp: Date.now(),
      contentType: "application/json",
    });

    this.logger.debug(\`Sent message \${messageId} to queue \${queue}\`);
    return messageId;
  }

  /**
   * Publish with delay using dead-letter exchange
   */
  async publishDelayed<T>(
    type: string,
    payload: T,
    delayMs: number,
    options: PublishOptions = {}
  ): Promise<string> {
    const channel = this.connection.getChannel();
    const messageId = uuid();
    const delayQueue = \`delay.\${delayMs}.\${options.routingKey || type}\`;
    const targetExchange = options.exchange || "events";

    // Create delay queue that forwards to target exchange after TTL
    await channel.assertQueue(delayQueue, {
      durable: true,
      deadLetterExchange: targetExchange,
      deadLetterRoutingKey: options.routingKey || type,
      messageTtl: delayMs,
      expires: delayMs + 60000,
    });

    const message: Message<T> = {
      id: messageId,
      type,
      payload,
      metadata: {
        correlationId: options.headers?.correlationId,
      },
      timestamp: new Date(),
    };

    const content = Buffer.from(JSON.stringify(message));

    channel.sendToQueue(delayQueue, content, {
      persistent: true,
      messageId,
      contentType: "application/json",
    });

    this.logger.debug(\`Published delayed message \${messageId} (delay: \${delayMs}ms)\`);
    return messageId;
  }

  /**
   * Ensure exchange exists
   */
  private async ensureExchange(name: string, type: ExchangeType): Promise<void> {
    if (this.declaredExchanges.has(name)) return;

    const channel = this.connection.getChannel();
    await channel.assertExchange(name, type, { durable: true });
    this.declaredExchanges.add(name);
  }

  /**
   * Create exchange with config
   */
  async createExchange(config: ExchangeConfig): Promise<void> {
    const channel = this.connection.getChannel();
    await channel.assertExchange(config.name, config.type, {
      durable: config.durable !== false,
      autoDelete: config.autoDelete || false,
    });
    this.declaredExchanges.add(config.name);
  }
}
`;
  await writeFile(path.join(mqPath, 'producers/message.producer.ts'), producerContent);

  // Message Consumer
  const consumerContent = `import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as amqp from "amqplib";
import { RabbitMQConnection } from "../rabbitmq.connection";
import { Message, ConsumeOptions, QueueConfig } from "../message.types";

export type MessageHandlerFn<T = any> = (message: Message<T>) => Promise<void>;

interface RegisteredHandler {
  queue: string;
  handler: MessageHandlerFn;
  options: ConsumeOptions;
}

@Injectable()
export class MessageConsumer implements OnModuleInit {
  private readonly logger = new Logger(MessageConsumer.name);
  private handlers: Map<string, RegisteredHandler[]> = new Map();
  private declaredQueues: Set<string> = new Set();

  constructor(private connection: RabbitMQConnection) {}

  async onModuleInit() {
    // Start consuming after connection is established
    setTimeout(() => this.startConsuming(), 1000);
  }

  /**
   * Register a message handler
   */
  registerHandler(
    messageType: string,
    handler: MessageHandlerFn,
    options: ConsumeOptions
  ): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }
    this.handlers.get(messageType)!.push({ queue: options.queue, handler, options });
  }

  /**
   * Create and configure a queue
   */
  async createQueue(config: QueueConfig): Promise<void> {
    const channel = this.connection.getChannel();

    await channel.assertQueue(config.name, {
      durable: config.durable !== false,
      exclusive: config.exclusive || false,
      autoDelete: config.autoDelete || false,
      deadLetterExchange: config.deadLetterExchange,
      deadLetterRoutingKey: config.deadLetterRoutingKey,
      messageTtl: config.messageTtl,
      maxLength: config.maxLength,
    });

    this.declaredQueues.add(config.name);
  }

  /**
   * Bind queue to exchange
   */
  async bindQueue(queue: string, exchange: string, routingKey: string): Promise<void> {
    const channel = this.connection.getChannel();
    await channel.bindQueue(queue, exchange, routingKey);
  }

  /**
   * Start consuming from all registered handlers
   */
  private async startConsuming(): Promise<void> {
    if (!this.connection.isConnected()) {
      this.logger.warn("Connection not ready, retrying in 1s...");
      setTimeout(() => this.startConsuming(), 1000);
      return;
    }

    for (const [messageType, handlers] of this.handlers) {
      for (const { queue, handler, options } of handlers) {
        await this.consume(queue, handler, options);
      }
    }
  }

  /**
   * Consume messages from a queue
   */
  private async consume(
    queue: string,
    handler: MessageHandlerFn,
    options: ConsumeOptions
  ): Promise<void> {
    const channel = this.connection.getChannel();

    // Ensure queue exists
    await channel.assertQueue(queue, { durable: true });

    // Set prefetch
    if (options.prefetch) {
      await channel.prefetch(options.prefetch);
    }

    // Set up dead letter queue if configured
    if (options.deadLetterExchange) {
      const dlqName = \`\${queue}.dlq\`;
      await channel.assertQueue(dlqName, { durable: true });
      await channel.bindQueue(
        dlqName,
        options.deadLetterExchange,
        options.deadLetterRoutingKey || queue
      );
    }

    this.logger.log(\`Starting consumer for queue: \${queue}\`);

    channel.consume(
      queue,
      async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const message: Message = JSON.parse(msg.content.toString());
          await handler(message);
          channel.ack(msg);
          this.logger.debug(\`Processed message \${message.id} from \${queue}\`);
        } catch (error) {
          this.logger.error(\`Error processing message from \${queue}:\`, error);
          await this.handleFailure(channel, msg, options);
        }
      },
      { noAck: options.noAck || false }
    );
  }

  /**
   * Handle message processing failure
   */
  private async handleFailure(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    options: ConsumeOptions
  ): Promise<void> {
    const retryCount = (msg.properties.headers?.["x-retry-count"] || 0) + 1;
    const maxRetries = options.maxRetries || 3;

    if (retryCount <= maxRetries) {
      // Retry with delay
      const retryDelay = options.retryDelay || 5000;
      const retryQueue = \`\${options.queue}.retry\`;

      await channel.assertQueue(retryQueue, {
        durable: true,
        deadLetterExchange: "",
        deadLetterRoutingKey: options.queue,
        messageTtl: retryDelay * retryCount,
      });

      channel.sendToQueue(retryQueue, msg.content, {
        persistent: true,
        headers: {
          ...msg.properties.headers,
          "x-retry-count": retryCount,
          "x-original-queue": options.queue,
        },
      });

      this.logger.warn(\`Retrying message (attempt \${retryCount}/\${maxRetries})\`);
    } else {
      // Send to dead letter queue
      this.logger.error(\`Message exceeded max retries, sending to DLQ\`);
    }

    channel.ack(msg);
  }
}
`;
  await writeFile(path.join(mqPath, 'consumers/message.consumer.ts'), consumerContent);

  // Subscribe decorator
  const subscribeDecoratorContent = `import { SetMetadata } from "@nestjs/common";
import { ConsumeOptions } from "../message.types";

export const SUBSCRIBE_METADATA = "message:subscribe";

export interface SubscribeConfig extends Partial<ConsumeOptions> {
  messageType: string;
  queue: string;
  exchange?: string;
  routingKey?: string;
}

/**
 * Decorator to subscribe a method to a message type
 */
export function Subscribe(config: SubscribeConfig): MethodDecorator {
  return SetMetadata(SUBSCRIBE_METADATA, config);
}

/**
 * Decorator to mark a class as a message handler
 */
export function MessageHandler(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata("message:handler", true, target);
  };
}
`;
  await writeFile(path.join(mqPath, 'decorators/subscribe.decorator.ts'), subscribeDecoratorContent);

  // Messaging module
  const moduleContent = `import { Module, Global, DynamicModule, OnModuleInit } from "@nestjs/common";
import { DiscoveryModule, DiscoveryService, MetadataScanner } from "@nestjs/core";
import { RabbitMQConnection, RabbitMQConfig } from "./rabbitmq.connection";
import { MessageProducer } from "./producers/message.producer";
import { MessageConsumer } from "./consumers/message.consumer";
import { SUBSCRIBE_METADATA, SubscribeConfig } from "./decorators/subscribe.decorator";

export interface MessagingModuleOptions {
  config?: Partial<RabbitMQConfig>;
  exchanges?: Array<{ name: string; type: "direct" | "topic" | "fanout" }>;
  queues?: Array<{ name: string; exchange: string; routingKey: string }>;
}

@Global()
@Module({})
export class MessagingModule implements OnModuleInit {
  static options: MessagingModuleOptions;

  constructor(
    private discovery: DiscoveryService,
    private scanner: MetadataScanner,
    private consumer: MessageConsumer,
    private producer: MessageProducer
  ) {}

  static forRoot(options: MessagingModuleOptions = {}): DynamicModule {
    MessagingModule.options = options;

    return {
      module: MessagingModule,
      imports: [DiscoveryModule],
      providers: [
        RabbitMQConnection,
        MessageProducer,
        MessageConsumer,
      ],
      exports: [MessageProducer, MessageConsumer, RabbitMQConnection],
    };
  }

  async onModuleInit() {
    // Set up exchanges
    for (const exchange of MessagingModule.options.exchanges || []) {
      await this.producer.createExchange({
        name: exchange.name,
        type: exchange.type,
      });
    }

    // Set up queues and bindings
    for (const queue of MessagingModule.options.queues || []) {
      await this.consumer.createQueue({ name: queue.name });
      await this.consumer.bindQueue(queue.name, queue.exchange, queue.routingKey);
    }

    // Discover and register handlers
    this.discoverHandlers();
  }

  private discoverHandlers() {
    const providers = this.discovery.getProviders();

    providers
      .filter((wrapper) => wrapper.instance && wrapper.metatype)
      .forEach((wrapper) => {
        const { instance } = wrapper;

        this.scanner.scanFromPrototype(
          instance,
          Object.getPrototypeOf(instance),
          (methodName) => {
            const methodRef = instance[methodName];
            const metadata = Reflect.getMetadata(
              SUBSCRIBE_METADATA,
              methodRef
            ) as SubscribeConfig | undefined;

            if (metadata) {
              this.consumer.registerHandler(
                metadata.messageType,
                methodRef.bind(instance),
                {
                  queue: metadata.queue,
                  prefetch: metadata.prefetch,
                  maxRetries: metadata.maxRetries,
                  retryDelay: metadata.retryDelay,
                  deadLetterExchange: metadata.deadLetterExchange,
                }
              );
            }
          }
        );
      });
  }
}
`;
  await writeFile(path.join(mqPath, 'messaging.module.ts'), moduleContent);

  // Index exports
  await writeFile(path.join(mqPath, 'index.ts'), `export * from "./message.types";
export * from "./rabbitmq.connection";
export * from "./producers/message.producer";
export * from "./consumers/message.consumer";
export * from "./decorators/subscribe.decorator";
export * from "./messaging.module";
`);

  await writeFile(path.join(mqPath, 'producers/index.ts'), `export * from "./message.producer";
`);

  await writeFile(path.join(mqPath, 'consumers/index.ts'), `export * from "./message.consumer";
`);

  await writeFile(path.join(mqPath, 'decorators/index.ts'), `export * from "./subscribe.decorator";
`);

  console.log(chalk.green('  ✓ Message types and interfaces'));
  console.log(chalk.green('  ✓ RabbitMQ connection manager with reconnection'));
  console.log(chalk.green('  ✓ Message producer (publish, sendToQueue, delayed)'));
  console.log(chalk.green('  ✓ Message consumer with retry and DLQ'));
  console.log(chalk.green('  ✓ @Subscribe decorator'));
  console.log(chalk.green('  ✓ Messaging module with auto-discovery'));
}
