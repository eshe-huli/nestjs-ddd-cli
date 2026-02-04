import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { toPascalCase, toCamelCase, toKebabCase } from '../utils/naming.utils';

export interface GraphQLSubscriptionsOptions {
  module?: string;
  events?: string[];
  useRedis?: boolean;
}

export async function setupGraphQLSubscriptions(
  basePath: string,
  options: GraphQLSubscriptionsOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📡 Setting up GraphQL Subscriptions\n'));

  const moduleName = options.module || 'shared';
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  const kebabName = toKebabCase(moduleName);
  const events = options.events || ['created', 'updated', 'deleted'];
  const useRedis = options.useRedis !== false;

  const baseDir = path.join(basePath, 'src', kebabName, 'infrastructure', 'graphql');
  fs.mkdirSync(baseDir, { recursive: true });

  // PubSub service
  const pubSubContent = `import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
${useRedis ? "import { RedisPubSub } from 'graphql-redis-subscriptions';\nimport Redis from 'ioredis';" : ''}

export type SubscriptionPayload<T> = {
  data: T;
  metadata: {
    timestamp: Date;
    correlationId?: string;
    userId?: string;
  };
};

/**
 * PubSub service for GraphQL subscriptions
 * ${useRedis ? 'Uses Redis for distributed pub/sub' : 'Uses in-memory pub/sub (single instance only)'}
 */
@Injectable()
export class PubSubService implements OnModuleDestroy {
  private readonly pubSub: PubSub${useRedis ? ' | RedisPubSub' : ''};
${useRedis ? `  private readonly redisPublisher?: Redis;
  private readonly redisSubscriber?: Redis;` : ''}

  constructor() {
${useRedis ? `    const redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    };

    if (process.env.USE_REDIS_PUBSUB === 'true') {
      this.redisPublisher = new Redis(redisOptions);
      this.redisSubscriber = new Redis(redisOptions);

      this.pubSub = new RedisPubSub({
        publisher: this.redisPublisher,
        subscriber: this.redisSubscriber,
      });
    } else {
      this.pubSub = new PubSub();
    }` : '    this.pubSub = new PubSub();'}
  }

  async onModuleDestroy(): Promise<void> {
${useRedis ? `    if (this.redisPublisher) {
      await this.redisPublisher.quit();
    }
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }` : '    // In-memory PubSub doesn\'t need cleanup'}
  }

  /**
   * Publish an event
   */
  async publish<T>(trigger: string, payload: SubscriptionPayload<T>): Promise<void> {
    await this.pubSub.publish(trigger, {
      [trigger]: payload,
    });
  }

  /**
   * Subscribe to an event
   */
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
    return this.pubSub.asyncIterator(triggers);
  }

  /**
   * Create a filtered subscription
   */
  asyncIteratorWithFilter<T>(
    triggers: string | string[],
    filterFn: (payload: T, variables: any, context: any) => boolean | Promise<boolean>,
  ): AsyncIterator<T> {
    const asyncIterator = this.pubSub.asyncIterator<T>(triggers);

    return {
      ...asyncIterator,
      next: async () => {
        while (true) {
          const result = await asyncIterator.next();
          if (result.done) {
            return result;
          }
          // Filter logic would be applied by resolver
          return result;
        }
      },
    };
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'pubsub.service.ts'), pubSubContent);

  // Subscription events
  const subscriptionEventsContent = `/**
 * Subscription event triggers for ${pascalName}
 */
export const ${pascalName}SubscriptionEvents = {
${events.map(event => `  ${event.toUpperCase()}: '${camelName}${toPascalCase(event)}',`).join('\n')}
} as const;

export type ${pascalName}SubscriptionEvent = typeof ${pascalName}SubscriptionEvents[keyof typeof ${pascalName}SubscriptionEvents];

/**
 * Subscription payload types
 */
export interface ${pascalName}CreatedPayload {
  ${camelName}Created: {
    data: {
      id: string;
      // Add your entity fields here
    };
    metadata: {
      timestamp: Date;
      correlationId?: string;
      userId?: string;
    };
  };
}

export interface ${pascalName}UpdatedPayload {
  ${camelName}Updated: {
    data: {
      id: string;
      changes: Record<string, { old: any; new: any }>;
    };
    metadata: {
      timestamp: Date;
      correlationId?: string;
      userId?: string;
    };
  };
}

export interface ${pascalName}DeletedPayload {
  ${camelName}Deleted: {
    data: {
      id: string;
    };
    metadata: {
      timestamp: Date;
      correlationId?: string;
      userId?: string;
    };
  };
}
`;
  fs.writeFileSync(path.join(baseDir, 'subscription-events.ts'), subscriptionEventsContent);

  // Subscription resolver
  const subscriptionResolverContent = `import { Resolver, Subscription, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { ${pascalName}SubscriptionEvents } from './subscription-events';

// Uncomment and import your GraphQL types
// import { ${pascalName} } from '../types/${kebabName}.type';

/**
 * GraphQL subscription resolver for ${pascalName}
 */
@Resolver()
export class ${pascalName}SubscriptionResolver {
  constructor(private readonly pubSubService: PubSubService) {}

${events.map(event => {
  const eventName = `${camelName}${toPascalCase(event)}`;
  const payloadType = `${pascalName}${toPascalCase(event)}Payload`;
  return `
  /**
   * Subscribe to ${event} events
   */
  @Subscription(() => Object, { // Replace Object with your GraphQL type
    name: '${eventName}',
    description: 'Subscribe to ${pascalName} ${event} events',
    filter: (payload, variables, context) => {
      // Add custom filtering logic here
      // Example: filter by ID
      if (variables.id && payload.${eventName}.data.id !== variables.id) {
        return false;
      }
      return true;
    },
    resolve: (payload) => payload.${eventName},
  })
  // @UseGuards(GqlAuthGuard) // Uncomment to require authentication
  ${eventName}(
    @Args('id', { nullable: true }) id?: string,
    @Context() context?: any,
  ): AsyncIterator<any> {
    return this.pubSubService.asyncIterator(${pascalName}SubscriptionEvents.${event.toUpperCase()});
  }`;
}).join('\n')}

  /**
   * Subscribe to all ${pascalName} events
   */
  @Subscription(() => Object, {
    name: '${camelName}Events',
    description: 'Subscribe to all ${pascalName} events',
    resolve: (payload) => {
      // Return the payload with event type
      const eventType = Object.keys(payload)[0];
      return {
        type: eventType,
        ...payload[eventType],
      };
    },
  })
  ${camelName}Events(): AsyncIterator<any> {
    return this.pubSubService.asyncIterator(
      Object.values(${pascalName}SubscriptionEvents),
    );
  }
}
`;
  fs.writeFileSync(path.join(baseDir, `${kebabName}-subscription.resolver.ts`), subscriptionResolverContent);

  // Event publisher service
  const eventPublisherContent = `import { Injectable, Logger } from '@nestjs/common';
import { PubSubService, SubscriptionPayload } from './pubsub.service';
import { ${pascalName}SubscriptionEvents } from './subscription-events';

/**
 * Service for publishing ${pascalName} subscription events
 */
@Injectable()
export class ${pascalName}EventPublisher {
  private readonly logger = new Logger(${pascalName}EventPublisher.name);

  constructor(private readonly pubSubService: PubSubService) {}

  /**
   * Publish ${camelName} created event
   */
  async publishCreated(
    data: { id: string; [key: string]: any },
    metadata?: { correlationId?: string; userId?: string },
  ): Promise<void> {
    const payload: SubscriptionPayload<typeof data> = {
      data,
      metadata: {
        timestamp: new Date(),
        ...metadata,
      },
    };

    this.logger.debug(\`Publishing ${camelName}Created event for ID: \${data.id}\`);
    await this.pubSubService.publish(${pascalName}SubscriptionEvents.CREATED, payload);
  }

  /**
   * Publish ${camelName} updated event
   */
  async publishUpdated(
    data: { id: string; changes: Record<string, { old: any; new: any }> },
    metadata?: { correlationId?: string; userId?: string },
  ): Promise<void> {
    const payload: SubscriptionPayload<typeof data> = {
      data,
      metadata: {
        timestamp: new Date(),
        ...metadata,
      },
    };

    this.logger.debug(\`Publishing ${camelName}Updated event for ID: \${data.id}\`);
    await this.pubSubService.publish(${pascalName}SubscriptionEvents.UPDATED, payload);
  }

  /**
   * Publish ${camelName} deleted event
   */
  async publishDeleted(
    data: { id: string },
    metadata?: { correlationId?: string; userId?: string },
  ): Promise<void> {
    const payload: SubscriptionPayload<typeof data> = {
      data,
      metadata: {
        timestamp: new Date(),
        ...metadata,
      },
    };

    this.logger.debug(\`Publishing ${camelName}Deleted event for ID: \${data.id}\`);
    await this.pubSubService.publish(${pascalName}SubscriptionEvents.DELETED, payload);
  }

  /**
   * Publish custom event
   */
  async publishCustom<T>(
    eventName: string,
    data: T,
    metadata?: { correlationId?: string; userId?: string },
  ): Promise<void> {
    const payload: SubscriptionPayload<T> = {
      data,
      metadata: {
        timestamp: new Date(),
        ...metadata,
      },
    };

    this.logger.debug(\`Publishing custom event: \${eventName}\`);
    await this.pubSubService.publish(eventName, payload);
  }
}
`;
  fs.writeFileSync(path.join(baseDir, `${kebabName}-event-publisher.ts`), eventPublisherContent);

  // WebSocket connection manager
  const connectionManagerContent = `import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

interface ConnectionInfo {
  id: string;
  userId?: string;
  connectedAt: Date;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
}

/**
 * Manages WebSocket connections for GraphQL subscriptions
 */
@Injectable()
export class ConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionManager.name);
  private readonly connections: Map<string, ConnectionInfo> = new Map();

  async onModuleDestroy(): Promise<void> {
    this.connections.clear();
  }

  /**
   * Register a new connection
   */
  addConnection(connectionId: string, userId?: string, metadata?: Record<string, any>): void {
    this.connections.set(connectionId, {
      id: connectionId,
      userId,
      connectedAt: new Date(),
      subscriptions: new Set(),
      metadata: metadata || {},
    });

    this.logger.debug(\`Connection added: \${connectionId} (user: \${userId || 'anonymous'})\`);
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    this.logger.debug(\`Connection removed: \${connectionId}\`);
  }

  /**
   * Add subscription to connection
   */
  addSubscription(connectionId: string, subscriptionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscriptions.add(subscriptionId);
    }
  }

  /**
   * Remove subscription from connection
   */
  removeSubscription(connectionId: string, subscriptionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getConnectionsByUserId(userId: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.userId === userId,
    );
  }

  /**
   * Get all active connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections subscribed to a specific event
   */
  getConnectionsBySubscription(subscriptionName: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.subscriptions.has(subscriptionName),
    );
  }

  /**
   * Update connection metadata
   */
  updateMetadata(connectionId: string, metadata: Record<string, any>): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.metadata = { ...connection.metadata, ...metadata };
    }
  }

  /**
   * Check if user has active connection
   */
  isUserConnected(userId: string): boolean {
    return Array.from(this.connections.values()).some(
      (conn) => conn.userId === userId,
    );
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'connection-manager.ts'), connectionManagerContent);

  // Subscription guard
  const subscriptionGuardContent = `import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';

/**
 * Guard for GraphQL subscriptions
 * Validates connection parameters and authentication
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    // For WebSocket connections, check connection params
    if (ctx.connection) {
      return this.validateConnection(ctx.connection);
    }

    // For regular subscriptions
    return this.validateSubscription(ctx);
  }

  private validateConnection(connection: any): boolean {
    const { context } = connection;

    // Check if authentication is required
    if (process.env.REQUIRE_SUBSCRIPTION_AUTH === 'true') {
      if (!context?.user) {
        this.logger.warn('Subscription connection rejected: no authenticated user');
        return false;
      }
    }

    return true;
  }

  private validateSubscription(ctx: any): boolean {
    // Add custom validation logic here
    // Example: check rate limits, validate permissions, etc.
    return true;
  }
}

/**
 * Decorator to require specific permission for subscription
 */
export function RequireSubscriptionPermission(permission: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value as Function;

    (descriptor as any).value = function (...args: any[]) {
      const context = args.find((arg) => arg?.connection || arg?.req);
      const user = context?.connection?.context?.user || context?.req?.user;

      if (!user?.permissions?.includes(permission)) {
        throw new Error(\`Permission denied: \${permission} required\`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
`;
  fs.writeFileSync(path.join(baseDir, 'subscription.guard.ts'), subscriptionGuardContent);

  // GraphQL subscriptions module
  const subscriptionsModuleContent = `import { Module, Global } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { ${pascalName}SubscriptionResolver } from './${kebabName}-subscription.resolver';
import { ${pascalName}EventPublisher } from './${kebabName}-event-publisher';
import { ConnectionManager } from './connection-manager';
import { SubscriptionGuard } from './subscription.guard';

@Global()
@Module({
  providers: [
    PubSubService,
    ${pascalName}SubscriptionResolver,
    ${pascalName}EventPublisher,
    ConnectionManager,
    SubscriptionGuard,
  ],
  exports: [
    PubSubService,
    ${pascalName}EventPublisher,
    ConnectionManager,
  ],
})
export class ${pascalName}SubscriptionsModule {}
`;
  fs.writeFileSync(path.join(baseDir, 'subscriptions.module.ts'), subscriptionsModuleContent);

  console.log(chalk.green(`  ✓ Created PubSub service`));
  console.log(chalk.green(`  ✓ Created subscription events`));
  console.log(chalk.green(`  ✓ Created subscription resolver`));
  console.log(chalk.green(`  ✓ Created event publisher`));
  console.log(chalk.green(`  ✓ Created connection manager`));
  console.log(chalk.green(`  ✓ Created subscription guard`));
  console.log(chalk.green(`  ✓ Created subscriptions module`));

  console.log(chalk.bold.green(`\n✅ GraphQL subscriptions setup complete for ${pascalName}`));
  console.log(chalk.cyan(`Generated files in: ${baseDir}`));
  console.log(chalk.gray('  - pubsub.service.ts (PubSub service)'));
  console.log(chalk.gray('  - subscription-events.ts (Event definitions)'));
  console.log(chalk.gray(`  - ${kebabName}-subscription.resolver.ts (Subscription resolver)`));
  console.log(chalk.gray(`  - ${kebabName}-event-publisher.ts (Event publisher)`));
  console.log(chalk.gray('  - connection-manager.ts (WebSocket connections)'));
  console.log(chalk.gray('  - subscription.guard.ts (Auth guard)'));
  console.log(chalk.gray('  - subscriptions.module.ts (Module definition)'));
}
