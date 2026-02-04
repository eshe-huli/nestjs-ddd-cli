/**
 * Complete Event Sourcing Framework
 * Full infrastructure for event sourcing architecture
 */

import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface EventSourcingOptions {
  path?: string;
  snapshotThreshold?: number;
  eventStore?: 'postgres' | 'mongodb' | 'memory';
}

export async function setupEventSourcingFramework(
  basePath: string,
  options: EventSourcingOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📦 Setting up Event Sourcing Framework\n'));

  const esPath = path.join(basePath, 'src/shared/event-sourcing');
  await ensureDir(esPath);
  await ensureDir(path.join(esPath, 'decorators'));
  await ensureDir(path.join(esPath, 'stores'));
  await ensureDir(path.join(esPath, 'handlers'));
  await ensureDir(path.join(esPath, 'projections'));

  // Generate core types
  await generateEventTypes(esPath);

  // Generate aggregate root
  await generateAggregateRoot(esPath);

  // Generate event store
  await generateEventStore(esPath, options);

  // Generate snapshot store
  await generateSnapshotStore(esPath, options);

  // Generate event bus
  await generateEventBus(esPath);

  // Generate projection manager
  await generateProjectionManager(esPath);

  // Generate decorators
  await generateDecorators(esPath);

  // Generate module
  await generateEventSourcingModule(esPath);

  // Generate index
  await writeFile(path.join(esPath, 'index.ts'), `export * from './event.types';
export * from './aggregate-root';
export * from './stores/event.store';
export * from './stores/snapshot.store';
export * from './event-bus';
export * from './projections/projection.manager';
export * from './decorators';
export * from './event-sourcing.module';
`);

  console.log(chalk.green('\n✅ Event Sourcing Framework set up!'));
}

async function generateEventTypes(esPath: string): Promise<void> {
  const content = `/**
 * Core Event Sourcing Types
 */

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  payload: T;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  timestamp?: Date;
  [key: string]: any;
}

export interface StoredEvent extends DomainEvent {
  id: string;
  createdAt: Date;
  sequence: number;
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  version: number;
  events: StoredEvent[];
}

export interface Snapshot<T = any> {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: T;
  timestamp: Date;
}

export interface EventEnvelope<T = any> {
  event: DomainEvent<T>;
  position: number;
  timestamp: Date;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => Promise<void> | void;

export type EventApplier<TState, TEvent> = (state: TState, event: TEvent) => TState;

export interface EventStoreOptions {
  batchSize?: number;
  timeout?: number;
}

export interface AppendResult {
  success: boolean;
  nextVersion: number;
  position: number;
}

export interface ReadOptions {
  fromVersion?: number;
  toVersion?: number;
  limit?: number;
}

/**
 * Event versioning for schema evolution
 */
export interface EventVersion {
  version: number;
  upcast: (oldEvent: any) => any;
  downcast?: (newEvent: any) => any;
}

export interface VersionedEvent {
  schemaVersion: number;
  [key: string]: any;
}

/**
 * Create a domain event
 */
export function createEvent<T>(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  payload: T,
  metadata?: EventMetadata
): DomainEvent<T> {
  return {
    eventId: generateEventId(),
    eventType,
    aggregateId,
    aggregateType,
    version: 0, // Will be set by aggregate
    timestamp: new Date(),
    payload,
    metadata: {
      timestamp: new Date(),
      ...metadata,
    },
  };
}

function generateEventId(): string {
  return \`evt_\${Date.now()}_\${Math.random().toString(36).slice(2, 11)}\`;
}

/**
 * Event serialization helpers
 */
export function serializeEvent(event: DomainEvent): string {
  return JSON.stringify({
    ...event,
    timestamp: event.timestamp.toISOString(),
    metadata: event.metadata ? {
      ...event.metadata,
      timestamp: event.metadata.timestamp?.toISOString(),
    } : undefined,
  });
}

export function deserializeEvent(json: string): DomainEvent {
  const parsed = JSON.parse(json);
  return {
    ...parsed,
    timestamp: new Date(parsed.timestamp),
    metadata: parsed.metadata ? {
      ...parsed.metadata,
      timestamp: parsed.metadata.timestamp ? new Date(parsed.metadata.timestamp) : undefined,
    } : undefined,
  };
}
`;

  await writeFile(path.join(esPath, 'event.types.ts'), content);
  console.log(chalk.green('  ✓ Event types'));
}

async function generateAggregateRoot(esPath: string): Promise<void> {
  const content = `import { DomainEvent, createEvent, EventMetadata } from './event.types';

/**
 * Base class for Event Sourced Aggregates
 */
export abstract class AggregateRoot<TState = any> {
  private _id: string;
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent[] = [];
  protected _state: TState;

  constructor(id: string) {
    this._id = id;
    this._state = this.getInitialState();
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get state(): TState {
    return this._state;
  }

  get uncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Get the aggregate type name
   */
  abstract getAggregateType(): string;

  /**
   * Get the initial state for the aggregate
   */
  protected abstract getInitialState(): TState;

  /**
   * Apply an event to update state
   */
  protected abstract applyEvent(event: DomainEvent): void;

  /**
   * Raise a new domain event
   */
  protected raise<T>(eventType: string, payload: T, metadata?: EventMetadata): void {
    const event = createEvent(
      eventType,
      this._id,
      this.getAggregateType(),
      payload,
      metadata
    );

    event.version = this._version + this._uncommittedEvents.length + 1;
    this._uncommittedEvents.push(event);
    this.applyEvent(event);
  }

  /**
   * Apply historical events to rebuild state
   */
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
      this._version = event.version;
    }
  }

  /**
   * Apply events from a snapshot
   */
  loadFromSnapshot(snapshot: { version: number; state: TState }): void {
    this._version = snapshot.version;
    this._state = snapshot.state;
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this._version += this._uncommittedEvents.length;
    this._uncommittedEvents = [];
  }

  /**
   * Check if there are uncommitted events
   */
  hasUncommittedEvents(): boolean {
    return this._uncommittedEvents.length > 0;
  }

  /**
   * Get snapshot of current state
   */
  getSnapshot(): { aggregateId: string; aggregateType: string; version: number; state: TState } {
    return {
      aggregateId: this._id,
      aggregateType: this.getAggregateType(),
      version: this._version,
      state: this._state,
    };
  }
}

/**
 * Decorator to mark a method as an event applier
 */
export function Apply(eventType: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const appliers = Reflect.getMetadata('event:appliers', target.constructor) || new Map();
    appliers.set(eventType, propertyKey);
    Reflect.defineMetadata('event:appliers', appliers, target.constructor);
    return descriptor;
  };
}

/**
 * Helper to create an aggregate class with automatic event application
 */
export function createAggregate<TState>(config: {
  aggregateType: string;
  initialState: () => TState;
  appliers: Record<string, (state: TState, payload: any) => TState>;
}): new (id: string) => AggregateRoot<TState> {
  return class extends AggregateRoot<TState> {
    getAggregateType(): string {
      return config.aggregateType;
    }

    protected getInitialState(): TState {
      return config.initialState();
    }

    protected applyEvent(event: DomainEvent): void {
      const applier = config.appliers[event.eventType];
      if (applier) {
        this._state = applier(this._state, event.payload);
      }
    }
  };
}
`;

  await writeFile(path.join(esPath, 'aggregate-root.ts'), content);
  console.log(chalk.green('  ✓ Aggregate root'));
}

async function generateEventStore(esPath: string, options: EventSourcingOptions): Promise<void> {
  const content = `import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEvent,
  StoredEvent,
  EventStream,
  AppendResult,
  ReadOptions,
  serializeEvent,
  deserializeEvent,
} from '../event.types';

export interface IEventStore {
  append(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<AppendResult>;
  getEvents(aggregateId: string, options?: ReadOptions): Promise<StoredEvent[]>;
  getEventStream(aggregateId: string): Promise<EventStream | null>;
  getAllEvents(options?: { fromPosition?: number; limit?: number }): Promise<StoredEvent[]>;
}

/**
 * In-memory event store (for development/testing)
 */
@Injectable()
export class InMemoryEventStore implements IEventStore {
  private readonly logger = new Logger(InMemoryEventStore.name);
  private events: Map<string, StoredEvent[]> = new Map();
  private allEvents: StoredEvent[] = [];
  private sequence: number = 0;

  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<AppendResult> {
    const existingEvents = this.events.get(aggregateId) || [];
    const currentVersion = existingEvents.length > 0
      ? existingEvents[existingEvents.length - 1].version
      : 0;

    // Optimistic concurrency check
    if (currentVersion !== expectedVersion) {
      throw new Error(
        \`Concurrency conflict: expected version \${expectedVersion}, but found \${currentVersion}\`
      );
    }

    const storedEvents: StoredEvent[] = events.map((event, index) => ({
      ...event,
      id: \`\${aggregateId}_\${currentVersion + index + 1}\`,
      version: currentVersion + index + 1,
      sequence: ++this.sequence,
      createdAt: new Date(),
    }));

    this.events.set(aggregateId, [...existingEvents, ...storedEvents]);
    this.allEvents.push(...storedEvents);

    this.logger.debug(\`Appended \${events.length} events to aggregate \${aggregateId}\`);

    return {
      success: true,
      nextVersion: currentVersion + events.length,
      position: this.sequence,
    };
  }

  async getEvents(aggregateId: string, options?: ReadOptions): Promise<StoredEvent[]> {
    let events = this.events.get(aggregateId) || [];

    if (options?.fromVersion !== undefined) {
      events = events.filter(e => e.version >= options.fromVersion!);
    }

    if (options?.toVersion !== undefined) {
      events = events.filter(e => e.version <= options.toVersion!);
    }

    if (options?.limit !== undefined) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  async getEventStream(aggregateId: string): Promise<EventStream | null> {
    const events = this.events.get(aggregateId);
    if (!events || events.length === 0) return null;

    return {
      aggregateId,
      aggregateType: events[0].aggregateType,
      version: events[events.length - 1].version,
      events,
    };
  }

  async getAllEvents(options?: { fromPosition?: number; limit?: number }): Promise<StoredEvent[]> {
    let events = [...this.allEvents];

    if (options?.fromPosition !== undefined) {
      events = events.filter(e => e.sequence > options.fromPosition!);
    }

    if (options?.limit !== undefined) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  // For testing
  clear(): void {
    this.events.clear();
    this.allEvents = [];
    this.sequence = 0;
  }
}

/**
 * PostgreSQL event store implementation
 */
@Injectable()
export class PostgresEventStore implements IEventStore {
  private readonly logger = new Logger(PostgresEventStore.name);

  constructor(
    // Inject your database connection/repository here
    // private readonly eventRepository: Repository<EventEntity>
  ) {}

  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<AppendResult> {
    // Implementation would use a database transaction with optimistic locking
    // Example SQL:
    // BEGIN;
    // SELECT version FROM event_streams WHERE aggregate_id = $1 FOR UPDATE;
    // -- Check version matches expectedVersion
    // INSERT INTO events (aggregate_id, event_type, payload, version, ...)
    // UPDATE event_streams SET version = $newVersion WHERE aggregate_id = $1;
    // COMMIT;

    throw new Error('PostgresEventStore not fully implemented - inject your database connection');
  }

  async getEvents(aggregateId: string, options?: ReadOptions): Promise<StoredEvent[]> {
    throw new Error('PostgresEventStore not fully implemented');
  }

  async getEventStream(aggregateId: string): Promise<EventStream | null> {
    throw new Error('PostgresEventStore not fully implemented');
  }

  async getAllEvents(options?: { fromPosition?: number; limit?: number }): Promise<StoredEvent[]> {
    throw new Error('PostgresEventStore not fully implemented');
  }
}

/**
 * Event store factory
 */
export const EVENT_STORE = Symbol('EVENT_STORE');

export function createEventStore(type: 'memory' | 'postgres' | 'mongodb' = 'memory'): IEventStore {
  switch (type) {
    case 'memory':
      return new InMemoryEventStore();
    case 'postgres':
      return new PostgresEventStore();
    default:
      return new InMemoryEventStore();
  }
}
`;

  await writeFile(path.join(esPath, 'stores/event.store.ts'), content);
  console.log(chalk.green('  ✓ Event store'));
}

async function generateSnapshotStore(esPath: string, options: EventSourcingOptions): Promise<void> {
  const content = `import { Injectable, Logger } from '@nestjs/common';
import { Snapshot } from '../event.types';

export interface ISnapshotStore {
  save(snapshot: Snapshot): Promise<void>;
  get(aggregateId: string, aggregateType: string): Promise<Snapshot | null>;
  getLatest(aggregateId: string): Promise<Snapshot | null>;
}

/**
 * In-memory snapshot store
 */
@Injectable()
export class InMemorySnapshotStore implements ISnapshotStore {
  private readonly logger = new Logger(InMemorySnapshotStore.name);
  private snapshots: Map<string, Snapshot[]> = new Map();

  async save(snapshot: Snapshot): Promise<void> {
    const key = \`\${snapshot.aggregateType}:\${snapshot.aggregateId}\`;
    const existing = this.snapshots.get(key) || [];
    existing.push(snapshot);
    this.snapshots.set(key, existing);
    this.logger.debug(\`Saved snapshot for \${key} at version \${snapshot.version}\`);
  }

  async get(aggregateId: string, aggregateType: string): Promise<Snapshot | null> {
    const key = \`\${aggregateType}:\${aggregateId}\`;
    const snapshots = this.snapshots.get(key);
    return snapshots?.[snapshots.length - 1] || null;
  }

  async getLatest(aggregateId: string): Promise<Snapshot | null> {
    for (const [key, snapshots] of this.snapshots) {
      if (key.endsWith(\`:\${aggregateId}\`)) {
        return snapshots[snapshots.length - 1];
      }
    }
    return null;
  }

  // For testing
  clear(): void {
    this.snapshots.clear();
  }
}

/**
 * Snapshot strategy - determines when to take snapshots
 */
export interface SnapshotStrategy {
  shouldSnapshot(aggregateId: string, version: number, eventsSinceSnapshot: number): boolean;
}

/**
 * Take snapshot every N events
 */
export class EventCountSnapshotStrategy implements SnapshotStrategy {
  constructor(private readonly threshold: number = ${options.snapshotThreshold || 100}) {}

  shouldSnapshot(aggregateId: string, version: number, eventsSinceSnapshot: number): boolean {
    return eventsSinceSnapshot >= this.threshold;
  }
}

/**
 * Take snapshot at specific version intervals
 */
export class VersionIntervalSnapshotStrategy implements SnapshotStrategy {
  constructor(private readonly interval: number = 100) {}

  shouldSnapshot(aggregateId: string, version: number, eventsSinceSnapshot: number): boolean {
    return version % this.interval === 0;
  }
}

/**
 * Snapshot store factory
 */
export const SNAPSHOT_STORE = Symbol('SNAPSHOT_STORE');

export function createSnapshotStore(type: 'memory' | 'postgres' | 'redis' = 'memory'): ISnapshotStore {
  switch (type) {
    case 'memory':
      return new InMemorySnapshotStore();
    default:
      return new InMemorySnapshotStore();
  }
}
`;

  await writeFile(path.join(esPath, 'stores/snapshot.store.ts'), content);
  console.log(chalk.green('  ✓ Snapshot store'));
}

async function generateEventBus(esPath: string): Promise<void> {
  const content = `import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DomainEvent, EventHandler } from './event.types';

export interface IEventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

/**
 * Simple in-process event bus
 */
@Injectable()
export class EventBus implements IEventBus {
  private readonly logger = new Logger(EventBus.name);
  private handlers: Map<string, Set<EventHandler>> = new Map();

  constructor(private readonly moduleRef: ModuleRef) {}

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.size === 0) {
      this.logger.debug(\`No handlers for event type: \${event.eventType}\`);
      return;
    }

    this.logger.debug(\`Publishing event \${event.eventType} to \${handlers.size} handlers\`);

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          \`Error in event handler for \${event.eventType}: \${(error as Error).message}\`,
          (error as Error).stack
        );
      }
    });

    await Promise.all(promises);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    this.logger.debug(\`Subscribed handler to event type: \${eventType}\`);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Register a handler class
   */
  registerHandler(handler: Type<IEventHandler>): void {
    const instance = this.moduleRef.get(handler, { strict: false });
    const eventTypes = Reflect.getMetadata('event:handles', handler) || [];

    for (const eventType of eventTypes) {
      this.subscribe(eventType, instance.handle.bind(instance));
    }
  }
}

/**
 * Event handler interface
 */
export interface IEventHandler<T = any> {
  handle(event: DomainEvent<T>): Promise<void> | void;
}

/**
 * Decorator to mark a class as an event handler
 */
export function EventsHandler(...eventTypes: string[]): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('event:handles', eventTypes, target);
  };
}

/**
 * Event bus with retry support
 */
@Injectable()
export class RetryableEventBus extends EventBus {
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const handlers = this['handlers'].get(event.eventType);
    if (!handlers || handlers.size === 0) return;

    const promises = Array.from(handlers).map(async (handler) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          await handler(event);
          return;
        } catch (error) {
          lastError = error as Error;
          if (attempt < this.maxRetries - 1) {
            await this.delay(this.retryDelay * Math.pow(2, attempt));
          }
        }
      }

      this['logger'].error(
        \`Failed to handle event \${event.eventType} after \${this.maxRetries} attempts: \${lastError?.message}\`
      );
    });

    await Promise.all(promises);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
`;

  await writeFile(path.join(esPath, 'event-bus.ts'), content);
  console.log(chalk.green('  ✓ Event bus'));
}

async function generateProjectionManager(esPath: string): Promise<void> {
  const content = `import { Injectable, Logger, Type, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DomainEvent, StoredEvent } from '../event.types';
import { IEventStore, EVENT_STORE } from '../stores/event.store';
import { Inject } from '@nestjs/common';

export interface IProjection {
  name: string;
  handle(event: DomainEvent): Promise<void> | void;
  getPosition(): Promise<number>;
  setPosition(position: number): Promise<void>;
  rebuild?(): Promise<void>;
}

/**
 * Base projection class
 */
export abstract class BaseProjection implements IProjection {
  abstract name: string;
  protected position: number = 0;

  abstract handle(event: DomainEvent): Promise<void> | void;

  async getPosition(): Promise<number> {
    return this.position;
  }

  async setPosition(position: number): Promise<void> {
    this.position = position;
  }

  async rebuild(): Promise<void> {
    this.position = 0;
    // Override in subclass to clear projection state
  }
}

/**
 * Manages projections and keeps them up to date
 */
@Injectable()
export class ProjectionManager implements OnModuleInit {
  private readonly logger = new Logger(ProjectionManager.name);
  private projections: Map<string, IProjection> = new Map();
  private running: boolean = false;
  private pollInterval: number = 1000;

  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    // Auto-discover and register projections
    // In practice, you'd scan for classes decorated with @Projection
  }

  /**
   * Register a projection
   */
  register(projection: IProjection): void {
    this.projections.set(projection.name, projection);
    this.logger.log(\`Registered projection: \${projection.name}\`);
  }

  /**
   * Start processing events for all projections
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.log('Starting projection manager');
    this.poll();
  }

  /**
   * Stop processing events
   */
  stop(): void {
    this.running = false;
    this.logger.log('Stopped projection manager');
  }

  /**
   * Rebuild a specific projection
   */
  async rebuild(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(\`Projection not found: \${projectionName}\`);
    }

    this.logger.log(\`Rebuilding projection: \${projectionName}\`);

    await projection.rebuild?.();
    await this.catchUp(projection);

    this.logger.log(\`Rebuilt projection: \${projectionName}\`);
  }

  /**
   * Rebuild all projections
   */
  async rebuildAll(): Promise<void> {
    for (const [name, projection] of this.projections) {
      await this.rebuild(name);
    }
  }

  /**
   * Poll for new events and process them
   */
  private async poll(): Promise<void> {
    while (this.running) {
      try {
        for (const [name, projection] of this.projections) {
          await this.catchUp(projection);
        }
      } catch (error) {
        this.logger.error(\`Error polling events: \${(error as Error).message}\`);
      }

      await this.delay(this.pollInterval);
    }
  }

  /**
   * Catch up a projection to current position
   */
  private async catchUp(projection: IProjection): Promise<void> {
    const currentPosition = await projection.getPosition();
    const events = await this.eventStore.getAllEvents({
      fromPosition: currentPosition,
      limit: 100,
    });

    for (const event of events) {
      try {
        await projection.handle(event);
        await projection.setPosition(event.sequence);
      } catch (error) {
        this.logger.error(
          \`Error processing event \${event.eventId} in projection \${projection.name}: \${(error as Error).message}\`
        );
        throw error;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator to mark a class as a projection
 */
export function Projection(name: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('projection:name', name, target);
  };
}

/**
 * Decorator to mark a method as handling specific event types
 */
export function Handles(...eventTypes: string[]): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const existing = Reflect.getMetadata('projection:handles', target.constructor) || new Map();
    for (const eventType of eventTypes) {
      existing.set(eventType, propertyKey);
    }
    Reflect.defineMetadata('projection:handles', existing, target.constructor);
    return descriptor;
  };
}
`;

  await writeFile(path.join(esPath, 'projections/projection.manager.ts'), content);
  console.log(chalk.green('  ✓ Projection manager'));
}

async function generateDecorators(esPath: string): Promise<void> {
  const content = `/**
 * Event Sourcing Decorators
 */

/**
 * Mark a class as an Event Sourced Aggregate
 */
export function Aggregate(name: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('aggregate:name', name, target);
  };
}

/**
 * Mark a method as a command handler
 */
export function CommandHandler(commandType: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const handlers = Reflect.getMetadata('aggregate:commands', target.constructor) || new Map();
    handlers.set(commandType, propertyKey);
    Reflect.defineMetadata('aggregate:commands', handlers, target.constructor);
    return descriptor;
  };
}

/**
 * Mark a method as an event applier
 */
export function ApplyEvent(eventType: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const appliers = Reflect.getMetadata('aggregate:appliers', target.constructor) || new Map();
    appliers.set(eventType, propertyKey);
    Reflect.defineMetadata('aggregate:appliers', appliers, target.constructor);
    return descriptor;
  };
}

/**
 * Mark a class as an event handler (saga/process manager)
 */
export function ProcessManager(name: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('process-manager:name', name, target);
  };
}

/**
 * Subscribe to events in a process manager
 */
export function OnEvent(eventType: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const handlers = Reflect.getMetadata('process-manager:handlers', target.constructor) || new Map();
    handlers.set(eventType, propertyKey);
    Reflect.defineMetadata('process-manager:handlers', handlers, target.constructor);
    return descriptor;
  };
}

/**
 * Mark a property as the aggregate state
 */
export function State(): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('aggregate:state', propertyKey, target.constructor);
  };
}

export * from './projections/projection.manager';
export { EventsHandler } from './event-bus';
`;

  await writeFile(path.join(esPath, 'decorators/index.ts'), content);
  await writeFile(path.join(esPath, 'decorators.ts'), `export * from './decorators/index';`);
  console.log(chalk.green('  ✓ Decorators'));
}

async function generateEventSourcingModule(esPath: string): Promise<void> {
  const content = `import { Module, Global, DynamicModule } from '@nestjs/common';
import { InMemoryEventStore, EVENT_STORE, IEventStore } from './stores/event.store';
import { InMemorySnapshotStore, SNAPSHOT_STORE, ISnapshotStore } from './stores/snapshot.store';
import { EventBus } from './event-bus';
import { ProjectionManager } from './projections/projection.manager';

export interface EventSourcingModuleOptions {
  eventStore?: 'memory' | 'postgres' | 'mongodb';
  snapshotStore?: 'memory' | 'postgres' | 'redis';
  snapshotThreshold?: number;
  autoStartProjections?: boolean;
}

@Global()
@Module({})
export class EventSourcingModule {
  static forRoot(options: EventSourcingModuleOptions = {}): DynamicModule {
    const eventStoreProvider = {
      provide: EVENT_STORE,
      useClass: InMemoryEventStore, // Replace based on options
    };

    const snapshotStoreProvider = {
      provide: SNAPSHOT_STORE,
      useClass: InMemorySnapshotStore, // Replace based on options
    };

    return {
      module: EventSourcingModule,
      providers: [
        eventStoreProvider,
        snapshotStoreProvider,
        EventBus,
        ProjectionManager,
        {
          provide: 'EVENT_SOURCING_OPTIONS',
          useValue: options,
        },
      ],
      exports: [
        EVENT_STORE,
        SNAPSHOT_STORE,
        EventBus,
        ProjectionManager,
      ],
    };
  }

  static forFeature(aggregates: any[] = []): DynamicModule {
    return {
      module: EventSourcingModule,
      providers: [...aggregates],
      exports: [...aggregates],
    };
  }
}
`;

  await writeFile(path.join(esPath, 'event-sourcing.module.ts'), content);
  console.log(chalk.green('  ✓ Event sourcing module'));
}
