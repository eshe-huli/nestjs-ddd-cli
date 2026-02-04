import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyEventSourcingRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const esPath = path.join(sharedPath, 'event-sourcing');

  await ensureDir(esPath);
  await ensureDir(path.join(esPath, 'store'));
  await ensureDir(path.join(esPath, 'aggregate'));
  await ensureDir(path.join(esPath, 'projections'));

  // Event sourcing types
  const typesContent = `export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  payload: T;
  metadata: EventMetadata;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: any;
}

export interface StoredEvent {
  id: string;
  streamId: string;
  eventType: string;
  version: number;
  data: string;
  metadata: string;
  timestamp: Date;
}

export interface EventStream {
  streamId: string;
  version: number;
  events: DomainEvent[];
}

export interface Snapshot<T = any> {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: T;
  timestamp: Date;
}

export interface ProjectionState<T = any> {
  projectionName: string;
  position: number;
  state: T;
  lastUpdated: Date;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => Promise<void>;

export interface Projection {
  name: string;
  init(): Promise<void>;
  handle(event: DomainEvent): Promise<void>;
  getPosition(): Promise<number>;
  reset(): Promise<void>;
}
`;
  await writeFile(path.join(esPath, 'event-sourcing.types.ts'), typesContent);

  // Event Store
  const eventStoreContent = `import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { DomainEvent, StoredEvent, EventStream, EventMetadata } from "../event-sourcing.types";

export interface EventStoreConfig {
  snapshotFrequency?: number;
}

@Injectable()
export class EventStore {
  private readonly logger = new Logger(EventStore.name);
  private events: Map<string, StoredEvent[]> = new Map();
  private globalPosition = 0;
  private subscribers: Map<string, Array<(event: DomainEvent) => Promise<void>>> = new Map();

  /**
   * Append events to a stream
   */
  async append(
    streamId: string,
    events: Array<{ eventType: string; payload: any }>,
    expectedVersion: number,
    metadata: EventMetadata = {}
  ): Promise<DomainEvent[]> {
    const stream = this.events.get(streamId) || [];
    const currentVersion = stream.length;

    // Optimistic concurrency check
    if (expectedVersion !== -1 && expectedVersion !== currentVersion) {
      throw new Error(
        \`Concurrency conflict: expected version \${expectedVersion}, but stream is at \${currentVersion}\`
      );
    }

    const domainEvents: DomainEvent[] = [];

    for (let i = 0; i < events.length; i++) {
      const { eventType, payload } = events[i];
      const version = currentVersion + i + 1;
      this.globalPosition++;

      const event: DomainEvent = {
        eventId: uuid(),
        eventType,
        aggregateId: streamId.split("-")[1] || streamId,
        aggregateType: streamId.split("-")[0],
        version,
        timestamp: new Date(),
        payload,
        metadata: {
          ...metadata,
          position: this.globalPosition,
        },
      };

      const storedEvent: StoredEvent = {
        id: event.eventId,
        streamId,
        eventType,
        version,
        data: JSON.stringify(payload),
        metadata: JSON.stringify(event.metadata),
        timestamp: event.timestamp,
      };

      stream.push(storedEvent);
      domainEvents.push(event);
    }

    this.events.set(streamId, stream);

    // Notify subscribers
    for (const event of domainEvents) {
      await this.notifySubscribers(event);
    }

    this.logger.debug(\`Appended \${events.length} events to stream \${streamId}\`);
    return domainEvents;
  }

  /**
   * Read events from a stream
   */
  async readStream(
    streamId: string,
    fromVersion: number = 0,
    toVersion?: number
  ): Promise<EventStream> {
    const stored = this.events.get(streamId) || [];
    const filtered = stored.filter(
      (e) => e.version > fromVersion && (!toVersion || e.version <= toVersion)
    );

    const events: DomainEvent[] = filtered.map((e) => ({
      eventId: e.id,
      eventType: e.eventType,
      aggregateId: streamId.split("-")[1] || streamId,
      aggregateType: streamId.split("-")[0],
      version: e.version,
      timestamp: e.timestamp,
      payload: JSON.parse(e.data),
      metadata: JSON.parse(e.metadata),
    }));

    return {
      streamId,
      version: stored.length,
      events,
    };
  }

  /**
   * Read all events from a position (for projections)
   */
  async readAll(fromPosition: number = 0, limit: number = 100): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = [];

    for (const [streamId, stored] of this.events) {
      for (const e of stored) {
        const metadata = JSON.parse(e.metadata);
        if (metadata.position > fromPosition) {
          allEvents.push({
            eventId: e.id,
            eventType: e.eventType,
            aggregateId: streamId.split("-")[1] || streamId,
            aggregateType: streamId.split("-")[0],
            version: e.version,
            timestamp: e.timestamp,
            payload: JSON.parse(e.data),
            metadata,
          });
        }
      }
    }

    return allEvents
      .sort((a, b) => (a.metadata.position || 0) - (b.metadata.position || 0))
      .slice(0, limit);
  }

  /**
   * Subscribe to events
   */
  subscribe(
    eventType: string | "*",
    handler: (event: DomainEvent) => Promise<void>
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get current stream version
   */
  async getStreamVersion(streamId: string): Promise<number> {
    const stream = this.events.get(streamId) || [];
    return stream.length;
  }

  /**
   * Check if stream exists
   */
  async streamExists(streamId: string): Promise<boolean> {
    return this.events.has(streamId) && (this.events.get(streamId)?.length || 0) > 0;
  }

  /**
   * Delete stream (soft delete - mark as deleted)
   */
  async deleteStream(streamId: string): Promise<void> {
    await this.append(
      streamId,
      [{ eventType: "StreamDeleted", payload: { deletedAt: new Date() } }],
      -1
    );
  }

  private async notifySubscribers(event: DomainEvent): Promise<void> {
    const handlers = [
      ...(this.subscribers.get(event.eventType) || []),
      ...(this.subscribers.get("*") || []),
    ];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(\`Subscriber error for \${event.eventType}:\`, error);
      }
    }
  }
}
`;
  await writeFile(path.join(esPath, 'store/event.store.ts'), eventStoreContent);

  // Snapshot Store
  const snapshotStoreContent = `import { Injectable, Logger } from "@nestjs/common";
import { Snapshot } from "../event-sourcing.types";

@Injectable()
export class SnapshotStore {
  private readonly logger = new Logger(SnapshotStore.name);
  private snapshots: Map<string, Snapshot[]> = new Map();

  /**
   * Save a snapshot
   */
  async save<T>(snapshot: Snapshot<T>): Promise<void> {
    const key = \`\${snapshot.aggregateType}-\${snapshot.aggregateId}\`;

    if (!this.snapshots.has(key)) {
      this.snapshots.set(key, []);
    }

    this.snapshots.get(key)!.push(snapshot);
    this.logger.debug(\`Saved snapshot for \${key} at version \${snapshot.version}\`);
  }

  /**
   * Get latest snapshot for an aggregate
   */
  async getLatest<T>(
    aggregateType: string,
    aggregateId: string
  ): Promise<Snapshot<T> | null> {
    const key = \`\${aggregateType}-\${aggregateId}\`;
    const snapshots = this.snapshots.get(key);

    if (!snapshots || snapshots.length === 0) {
      return null;
    }

    return snapshots[snapshots.length - 1] as Snapshot<T>;
  }

  /**
   * Get snapshot at specific version
   */
  async getAtVersion<T>(
    aggregateType: string,
    aggregateId: string,
    version: number
  ): Promise<Snapshot<T> | null> {
    const key = \`\${aggregateType}-\${aggregateId}\`;
    const snapshots = this.snapshots.get(key);

    if (!snapshots) return null;

    // Find snapshot at or before the requested version
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].version <= version) {
        return snapshots[i] as Snapshot<T>;
      }
    }

    return null;
  }

  /**
   * Delete old snapshots, keeping only the latest N
   */
  async pruneSnapshots(
    aggregateType: string,
    aggregateId: string,
    keepCount: number = 3
  ): Promise<number> {
    const key = \`\${aggregateType}-\${aggregateId}\`;
    const snapshots = this.snapshots.get(key);

    if (!snapshots || snapshots.length <= keepCount) {
      return 0;
    }

    const removed = snapshots.length - keepCount;
    this.snapshots.set(key, snapshots.slice(-keepCount));

    this.logger.debug(\`Pruned \${removed} old snapshots for \${key}\`);
    return removed;
  }
}
`;
  await writeFile(path.join(esPath, 'store/snapshot.store.ts'), snapshotStoreContent);

  // Aggregate Root
  const aggregateRootContent = `import { DomainEvent, EventMetadata } from "../event-sourcing.types";

export abstract class AggregateRoot<TState = any> {
  protected _id: string;
  protected _version: number = 0;
  protected _state: TState;
  protected _uncommittedEvents: Array<{ eventType: string; payload: any }> = [];

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get state(): TState {
    return this._state;
  }

  /**
   * Get the aggregate type name
   */
  abstract getType(): string;

  /**
   * Create initial state
   */
  protected abstract createInitialState(): TState;

  /**
   * Apply an event to update state
   */
  protected abstract applyEvent(event: DomainEvent): void;

  /**
   * Initialize a new aggregate
   */
  protected initialize(id: string): void {
    this._id = id;
    this._state = this.createInitialState();
  }

  /**
   * Record a new event
   */
  protected recordEvent(eventType: string, payload: any): void {
    this._uncommittedEvents.push({ eventType, payload });

    // Apply immediately to update state
    const event: DomainEvent = {
      eventId: "",
      eventType,
      aggregateId: this._id,
      aggregateType: this.getType(),
      version: this._version + this._uncommittedEvents.length,
      timestamp: new Date(),
      payload,
      metadata: {},
    };

    this.applyEvent(event);
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): Array<{ eventType: string; payload: any }> {
    return [...this._uncommittedEvents];
  }

  /**
   * Clear uncommitted events after persisting
   */
  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Reconstitute aggregate from events
   */
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
      this._version = event.version;
    }
  }

  /**
   * Load from snapshot and subsequent events
   */
  loadFromSnapshot(state: TState, version: number, events: DomainEvent[]): void {
    this._state = state;
    this._version = version;

    for (const event of events) {
      this.applyEvent(event);
      this._version = event.version;
    }
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): { state: TState; version: number } {
    return {
      state: { ...this._state },
      version: this._version,
    };
  }
}
`;
  await writeFile(path.join(esPath, 'aggregate/aggregate-root.ts'), aggregateRootContent);

  // Aggregate Repository
  const aggregateRepoContent = `import { Logger } from "@nestjs/common";
import { EventStore } from "../store/event.store";
import { SnapshotStore } from "../store/snapshot.store";
import { AggregateRoot } from "./aggregate-root";
import { DomainEvent, EventMetadata, Snapshot } from "../event-sourcing.types";

export interface AggregateRepositoryConfig {
  snapshotFrequency?: number;
}

export abstract class AggregateRepository<T extends AggregateRoot> {
  protected readonly logger = new Logger(this.constructor.name);
  protected config: AggregateRepositoryConfig = {
    snapshotFrequency: 10,
  };

  constructor(
    protected readonly eventStore: EventStore,
    protected readonly snapshotStore: SnapshotStore
  ) {}

  /**
   * Get the aggregate type
   */
  protected abstract getAggregateType(): string;

  /**
   * Create a new aggregate instance
   */
  protected abstract createAggregate(): T;

  /**
   * Get stream ID for an aggregate
   */
  protected getStreamId(aggregateId: string): string {
    return \`\${this.getAggregateType()}-\${aggregateId}\`;
  }

  /**
   * Load an aggregate by ID
   */
  async load(aggregateId: string): Promise<T | null> {
    const streamId = this.getStreamId(aggregateId);
    const exists = await this.eventStore.streamExists(streamId);

    if (!exists) {
      return null;
    }

    const aggregate = this.createAggregate();
    (aggregate as any)._id = aggregateId;

    // Try to load from snapshot
    const snapshot = await this.snapshotStore.getLatest(
      this.getAggregateType(),
      aggregateId
    );

    let fromVersion = 0;
    if (snapshot) {
      (aggregate as any)._state = snapshot.state;
      (aggregate as any)._version = snapshot.version;
      fromVersion = snapshot.version;
    }

    // Load events after snapshot
    const { events } = await this.eventStore.readStream(streamId, fromVersion);

    if (snapshot) {
      aggregate.loadFromSnapshot(snapshot.state, snapshot.version, events);
    } else {
      aggregate.loadFromHistory(events);
    }

    return aggregate;
  }

  /**
   * Save an aggregate
   */
  async save(aggregate: T, metadata: EventMetadata = {}): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();

    if (uncommittedEvents.length === 0) {
      return;
    }

    const streamId = this.getStreamId(aggregate.id);
    const expectedVersion = aggregate.version - uncommittedEvents.length;

    await this.eventStore.append(
      streamId,
      uncommittedEvents,
      expectedVersion,
      metadata
    );

    aggregate.clearUncommittedEvents();

    // Create snapshot if needed
    const newVersion = aggregate.version;
    if (
      this.config.snapshotFrequency &&
      newVersion % this.config.snapshotFrequency === 0
    ) {
      await this.createSnapshot(aggregate);
    }
  }

  /**
   * Create a snapshot of the aggregate
   */
  protected async createSnapshot(aggregate: T): Promise<void> {
    const { state, version } = aggregate.createSnapshot();

    const snapshot: Snapshot = {
      aggregateId: aggregate.id,
      aggregateType: this.getAggregateType(),
      version,
      state,
      timestamp: new Date(),
    };

    await this.snapshotStore.save(snapshot);
    this.logger.debug(\`Created snapshot for \${aggregate.id} at version \${version}\`);
  }

  /**
   * Check if aggregate exists
   */
  async exists(aggregateId: string): Promise<boolean> {
    const streamId = this.getStreamId(aggregateId);
    return this.eventStore.streamExists(streamId);
  }
}
`;
  await writeFile(path.join(esPath, 'aggregate/aggregate-repository.ts'), aggregateRepoContent);

  // Projection Manager
  const projectionManagerContent = `import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventStore } from "../store/event.store";
import { DomainEvent, Projection, ProjectionState } from "../event-sourcing.types";

@Injectable()
export class ProjectionManager implements OnModuleInit {
  private readonly logger = new Logger(ProjectionManager.name);
  private projections: Map<string, Projection> = new Map();
  private positions: Map<string, number> = new Map();
  private isRunning = false;

  constructor(private eventStore: EventStore) {}

  async onModuleInit() {
    // Start projection processing after a short delay
    setTimeout(() => this.start(), 1000);
  }

  /**
   * Register a projection
   */
  register(projection: Projection): void {
    this.projections.set(projection.name, projection);
    this.logger.log(\`Registered projection: \${projection.name}\`);
  }

  /**
   * Start processing projections
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initialize all projections
    for (const [name, projection] of this.projections) {
      await projection.init();
      const position = await projection.getPosition();
      this.positions.set(name, position);
      this.logger.log(\`Projection \${name} at position \${position}\`);
    }

    // Subscribe to all events
    this.eventStore.subscribe("*", async (event) => {
      await this.processEvent(event);
    });

    this.logger.log("Projection manager started");
  }

  /**
   * Stop processing projections
   */
  stop(): void {
    this.isRunning = false;
    this.logger.log("Projection manager stopped");
  }

  /**
   * Process a single event for all projections
   */
  private async processEvent(event: DomainEvent): Promise<void> {
    const eventPosition = event.metadata.position || 0;

    for (const [name, projection] of this.projections) {
      const currentPosition = this.positions.get(name) || 0;

      if (eventPosition > currentPosition) {
        try {
          await projection.handle(event);
          this.positions.set(name, eventPosition);
        } catch (error) {
          this.logger.error(\`Projection \${name} failed on event \${event.eventType}:\`, error);
        }
      }
    }
  }

  /**
   * Rebuild a projection from scratch
   */
  async rebuild(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(\`Projection \${projectionName} not found\`);
    }

    this.logger.log(\`Rebuilding projection: \${projectionName}\`);

    await projection.reset();
    this.positions.set(projectionName, 0);

    // Process all events
    let position = 0;
    const batchSize = 100;

    while (true) {
      const events = await this.eventStore.readAll(position, batchSize);
      if (events.length === 0) break;

      for (const event of events) {
        await projection.handle(event);
        position = event.metadata.position || position + 1;
      }

      this.positions.set(projectionName, position);
    }

    this.logger.log(\`Projection \${projectionName} rebuilt to position \${position}\`);
  }

  /**
   * Get projection status
   */
  getStatus(): Array<{ name: string; position: number }> {
    return Array.from(this.projections.keys()).map((name) => ({
      name,
      position: this.positions.get(name) || 0,
    }));
  }
}
`;
  await writeFile(path.join(esPath, 'projections/projection-manager.ts'), projectionManagerContent);

  // Base Projection
  const baseProjectionContent = `import { Logger } from "@nestjs/common";
import { DomainEvent, Projection } from "../event-sourcing.types";

export abstract class BaseProjection implements Projection {
  protected readonly logger = new Logger(this.constructor.name);
  protected position = 0;

  abstract readonly name: string;

  /**
   * Initialize the projection
   */
  async init(): Promise<void> {
    this.logger.log(\`Initializing projection: \${this.name}\`);
  }

  /**
   * Handle an event
   */
  async handle(event: DomainEvent): Promise<void> {
    const handlerName = \`on\${event.eventType}\`;
    const handler = (this as any)[handlerName];

    if (typeof handler === "function") {
      await handler.call(this, event);
    }

    this.position = event.metadata.position || this.position + 1;
  }

  /**
   * Get current position
   */
  async getPosition(): Promise<number> {
    return this.position;
  }

  /**
   * Reset the projection
   */
  async reset(): Promise<void> {
    this.position = 0;
    this.logger.log(\`Reset projection: \${this.name}\`);
  }
}
`;
  await writeFile(path.join(esPath, 'projections/base-projection.ts'), baseProjectionContent);

  // Event Sourcing Module
  const moduleContent = `import { Module, Global, DynamicModule } from "@nestjs/common";
import { EventStore } from "./store/event.store";
import { SnapshotStore } from "./store/snapshot.store";
import { ProjectionManager } from "./projections/projection-manager";

export interface EventSourcingModuleOptions {
  snapshotFrequency?: number;
}

@Global()
@Module({})
export class EventSourcingModule {
  static forRoot(options: EventSourcingModuleOptions = {}): DynamicModule {
    return {
      module: EventSourcingModule,
      providers: [
        EventStore,
        SnapshotStore,
        ProjectionManager,
        {
          provide: "EVENT_SOURCING_OPTIONS",
          useValue: options,
        },
      ],
      exports: [EventStore, SnapshotStore, ProjectionManager],
    };
  }
}
`;
  await writeFile(path.join(esPath, 'event-sourcing.module.ts'), moduleContent);

  // Index exports
  await writeFile(path.join(esPath, 'index.ts'), `export * from "./event-sourcing.types";
export * from "./store/event.store";
export * from "./store/snapshot.store";
export * from "./aggregate/aggregate-root";
export * from "./aggregate/aggregate-repository";
export * from "./projections/projection-manager";
export * from "./projections/base-projection";
export * from "./event-sourcing.module";
`);

  await writeFile(path.join(esPath, 'store/index.ts'), `export * from "./event.store";
export * from "./snapshot.store";
`);

  await writeFile(path.join(esPath, 'aggregate/index.ts'), `export * from "./aggregate-root";
export * from "./aggregate-repository";
`);

  await writeFile(path.join(esPath, 'projections/index.ts'), `export * from "./projection-manager";
export * from "./base-projection";
`);

  console.log(chalk.green('  ✓ Event sourcing types'));
  console.log(chalk.green('  ✓ Event store with optimistic concurrency'));
  console.log(chalk.green('  ✓ Snapshot store'));
  console.log(chalk.green('  ✓ Aggregate root base class'));
  console.log(chalk.green('  ✓ Aggregate repository with snapshot support'));
  console.log(chalk.green('  ✓ Projection manager with rebuild capability'));
  console.log(chalk.green('  ✓ Base projection class'));
  console.log(chalk.green('  ✓ Event sourcing module'));
}
