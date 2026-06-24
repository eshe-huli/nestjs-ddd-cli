import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';
import { applyBusinessReferenceIdentifiersRecipe } from './business-reference-identifiers.recipe';

export async function applyEventBackboneRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const eventBackbonePath = path.join(sharedPath, 'event-backbone');
  const entitiesPath = path.join(eventBackbonePath, 'entities');
  const publishersPath = path.join(eventBackbonePath, 'publishers');
  const migrationsPath = path.join(basePath, 'src/migrations');

  await applyBusinessReferenceIdentifiersRecipe(basePath);
  await ensureDir(eventBackbonePath);
  await ensureDir(entitiesPath);
  await ensureDir(publishersPath);
  await ensureDir(migrationsPath);

  const constantsContent = `export const EVENT_BACKBONE_PUBLISHER = Symbol("EVENT_BACKBONE_PUBLISHER");

export const EVENT_BACKBONE_ENV = {
  relayEnabled: "EVENT_BACKBONE_RELAY_ENABLED",
  relayBatchSize: "EVENT_BACKBONE_RELAY_BATCH_SIZE",
  relayMaxAttempts: "EVENT_BACKBONE_RELAY_MAX_ATTEMPTS",
  relayRetryBaseMs: "EVENT_BACKBONE_RELAY_RETRY_BASE_MS",
  pulsarEnabled: "PULSAR_ENABLED",
  pulsarServiceUrl: "PULSAR_SERVICE_URL",
  pulsarTenant: "PULSAR_TENANT",
  pulsarNamespace: "PULSAR_NAMESPACE",
  pulsarTopicPrefix: "PULSAR_TOPIC_PREFIX",
} as const;
`;

  await writeFile(path.join(eventBackbonePath, 'event-backbone.constants.ts'), constantsContent);

  const typesContent = `export type EventPayload = Record<string, unknown>;

export interface EventBackboneMetadata {
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  actorId?: string;
  tenantId?: string;
  traceId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface EventBackboneEnvelope<TPayload extends EventPayload = EventPayload> {
  id: string;
  reference?: string;
  type: string;
  source: string;
  aggregateType: string;
  aggregateId: string;
  streamId: string;
  version?: number;
  subject?: string;
  payload: TPayload;
  metadata: EventBackboneMetadata;
  occurredAt: string;
}

export interface AppendDomainEventInput<TPayload extends EventPayload = EventPayload> {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  metadata?: EventBackboneMetadata;
  occurredAt?: Date;
  reference?: string;
}

export interface AppendDomainEventsInput {
  streamId: string;
  expectedVersion?: number;
  events: AppendDomainEventInput[];
}

export interface StoredDomainEvent<TPayload extends EventPayload = EventPayload> {
  globalSeq: string;
  eventId: string;
  reference?: string | null;
  streamId: string;
  version: number;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  metadata: EventBackboneMetadata;
  occurredAt: Date;
  createdAt: Date;
}

export enum OutboxEventStatus {
  Pending = "PENDING",
  Publishing = "PUBLISHING",
  Published = "PUBLISHED",
  Failed = "FAILED",
}

export interface OutboxPublishInput<TPayload extends EventPayload = EventPayload> {
  type: string;
  source: string;
  aggregateType: string;
  aggregateId: string;
  streamId: string;
  payload: TPayload;
  metadata?: EventBackboneMetadata;
  occurredAt?: Date;
  reference?: string;
  subject?: string;
}

export interface EventBackbonePublisher {
  publish(envelope: EventBackboneEnvelope): Promise<void>;
}
`;

  await writeFile(path.join(eventBackbonePath, 'event-backbone.types.ts'), typesContent);

  const envContent = `import * as Joi from "joi";

export const eventBackboneEnvSchema = {
  EVENT_BACKBONE_RELAY_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  EVENT_BACKBONE_RELAY_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),
  EVENT_BACKBONE_RELAY_MAX_ATTEMPTS: Joi.number().integer().min(1).max(100).default(10),
  EVENT_BACKBONE_RELAY_RETRY_BASE_MS: Joi.number().integer().min(1000).default(30000),
  PULSAR_ENABLED: Joi.boolean().truthy("true").falsy("false").default(false),
  PULSAR_SERVICE_URL: Joi.string()
    .pattern(/^pulsars?:\\/\\/.+/)
    .when("PULSAR_ENABLED", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  PULSAR_TENANT: Joi.string().default("public"),
  PULSAR_NAMESPACE: Joi.string().default("default"),
  PULSAR_TOPIC_PREFIX: Joi.string().allow("").default(""),
};
`;

  await writeFile(path.join(eventBackbonePath, 'event-backbone.env.ts'), envContent);

  const errorsContent = `export class EventStreamConcurrencyError extends Error {
  constructor(streamId: string, expectedVersion: number | undefined, actualVersion: number) {
    super(
      "Event stream concurrency conflict for " +
        streamId +
        ": expected " +
        String(expectedVersion) +
        ", actual " +
        String(actualVersion),
    );
    this.name = "EventStreamConcurrencyError";
  }
}

export class OutboxTransactionRequiredError extends Error {
  constructor() {
    super("Outbox writes must use the same active database transaction as the business write");
    this.name = "OutboxTransactionRequiredError";
  }
}
`;

  await writeFile(path.join(eventBackbonePath, 'event-backbone.errors.ts'), errorsContent);

  const eventStoreEntityContent = `import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "event_store" })
@Unique("uq_event_store_stream_version", ["streamId", "version"])
@Index("idx_event_store_stream", ["streamId"])
@Index("idx_event_store_type", ["type"])
@Index("idx_event_store_aggregate", ["aggregateType", "aggregateId"])
export class EventStoreOrmEntity {
  @PrimaryGeneratedColumn("increment", { type: "bigint", name: "global_seq" })
  globalSeq!: string;

  @Column({ type: "uuid", name: "event_id" })
  eventId!: string;

  @Column({ type: "varchar", length: 96, nullable: true })
  reference!: string | null;

  @Column({ type: "varchar", length: 160, name: "stream_id" })
  streamId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "varchar", length: 160 })
  type!: string;

  @Column({ type: "varchar", length: 96, name: "aggregate_type" })
  aggregateType!: string;

  @Column({ type: "varchar", length: 96, name: "aggregate_id" })
  aggregateId!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: "timestamptz", name: "occurred_at" })
  occurredAt!: Date;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
`;

  await writeFile(path.join(entitiesPath, 'event-store.orm-entity.ts'), eventStoreEntityContent);

  const outboxEntityContent = `import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { OutboxEventStatus } from "../event-backbone.types";

@Entity({ name: "outbox_events" })
@Index("idx_outbox_events_status_available", ["status", "availableAt"])
@Index("idx_outbox_events_aggregate", ["aggregateType", "aggregateId"])
@Index("idx_outbox_events_reference", ["reference"], {
  unique: true,
  where: '"reference" IS NOT NULL',
})
export class OutboxEventOrmEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar", length: 96, nullable: true })
  reference!: string | null;

  @Column({ type: "varchar", length: 160, name: "event_type" })
  eventType!: string;

  @Column({ type: "varchar", length: 160 })
  source!: string;

  @Column({ type: "varchar", length: 96, name: "aggregate_type" })
  aggregateType!: string;

  @Column({ type: "varchar", length: 96, name: "aggregate_id" })
  aggregateId!: string;

  @Column({ type: "varchar", length: 160, name: "stream_id" })
  streamId!: string;

  @Column({ type: "varchar", length: 160, nullable: true })
  subject!: string | null;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({
    type: "varchar",
    length: 20,
    default: OutboxEventStatus.Pending,
  })
  status!: OutboxEventStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "timestamptz", name: "available_at" })
  availableAt!: Date;

  @Column({ type: "timestamptz", name: "occurred_at" })
  occurredAt!: Date;

  @Column({ type: "timestamptz", name: "published_at", nullable: true })
  publishedAt!: Date | null;

  @Column({ type: "text", name: "last_error", nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
`;

  await writeFile(path.join(entitiesPath, 'outbox-event.orm-entity.ts'), outboxEntityContent);

  const checkpointEntityContent = `import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "projection_checkpoints" })
export class ProjectionCheckpointOrmEntity {
  @PrimaryColumn({ type: "varchar", length: 120 })
  projection!: string;

  @Column({ type: "bigint", name: "last_seq", default: "0" })
  lastSeq!: string;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
`;

  await writeFile(
    path.join(entitiesPath, 'projection-checkpoint.orm-entity.ts'),
    checkpointEntityContent,
  );

  const eventStoreServiceContent = `import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, MoreThan } from "typeorm";
import {
  AppendDomainEventsInput,
  StoredDomainEvent,
} from "./event-backbone.types";
import { EventStreamConcurrencyError } from "./event-backbone.errors";
import { EventStoreOrmEntity } from "./entities/event-store.orm-entity";
import { ProjectionCheckpointOrmEntity } from "./entities/projection-checkpoint.orm-entity";

@Injectable()
export class EventStoreService {
  constructor(private readonly dataSource: DataSource) {}

  async append(
    input: AppendDomainEventsInput,
    manager: EntityManager,
  ): Promise<StoredDomainEvent[]> {
    this.assertActiveTransaction(manager);

    const currentVersion = await this.currentVersion(input.streamId, manager);
    if (
      typeof input.expectedVersion === "number" &&
      input.expectedVersion !== currentVersion
    ) {
      throw new EventStreamConcurrencyError(
        input.streamId,
        input.expectedVersion,
        currentVersion,
      );
    }

    const repository = manager.getRepository(EventStoreOrmEntity);
    const entities = input.events.map((event, index) =>
      repository.create({
        eventId: randomUUID(),
        reference: event.reference ?? null,
        streamId: input.streamId,
        version: currentVersion + index + 1,
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        metadata: event.metadata ?? {},
        occurredAt: event.occurredAt ?? new Date(),
      }),
    );

    try {
      const saved = await repository.save(entities);
      return saved.map((entity) => this.toStoredEvent(entity));
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      throw new EventStreamConcurrencyError(
        input.streamId,
        input.expectedVersion,
        currentVersion,
      );
    }
  }

  async currentVersion(streamId: string, manager?: EntityManager): Promise<number> {
    const repository = (manager ?? this.dataSource.manager).getRepository(EventStoreOrmEntity);
    const latest = await repository.findOne({
      where: { streamId },
      order: { version: "DESC" },
    });

    return latest?.version ?? 0;
  }

  async readStream(streamId: string): Promise<StoredDomainEvent[]> {
    const events = await this.dataSource.getRepository(EventStoreOrmEntity).find({
      where: { streamId },
      order: { version: "ASC" },
    });

    return events.map((event) => this.toStoredEvent(event));
  }

  async readAfter(globalSeq: string, limit = 100): Promise<StoredDomainEvent[]> {
    const events = await this.dataSource.getRepository(EventStoreOrmEntity).find({
      where: { globalSeq: MoreThan(globalSeq) },
      order: { globalSeq: "ASC" },
      take: limit,
    });

    return events.map((event) => this.toStoredEvent(event));
  }

  async checkpoint(projection: string, lastSeq: string): Promise<void> {
    await this.dataSource.getRepository(ProjectionCheckpointOrmEntity).upsert(
      { projection, lastSeq },
      ["projection"],
    );
  }

  async checkpointFor(projection: string): Promise<string> {
    const checkpoint = await this.dataSource
      .getRepository(ProjectionCheckpointOrmEntity)
      .findOne({ where: { projection } });

    return checkpoint?.lastSeq ?? "0";
  }

  private assertActiveTransaction(manager: EntityManager): void {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error("Event store append must run inside an active transaction");
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }

  private toStoredEvent(entity: EventStoreOrmEntity): StoredDomainEvent {
    return {
      globalSeq: entity.globalSeq,
      eventId: entity.eventId,
      reference: entity.reference,
      streamId: entity.streamId,
      version: entity.version,
      type: entity.type,
      aggregateType: entity.aggregateType,
      aggregateId: entity.aggregateId,
      payload: entity.payload,
      metadata: entity.metadata,
      occurredAt: entity.occurredAt,
      createdAt: entity.createdAt,
    };
  }
}
`;

  await writeFile(path.join(eventBackbonePath, 'event-store.service.ts'), eventStoreServiceContent);

  const outboxServiceContent = `import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  OutboxEventStatus,
  OutboxPublishInput,
} from "./event-backbone.types";
import { OutboxTransactionRequiredError } from "./event-backbone.errors";
import { OutboxEventOrmEntity } from "./entities/outbox-event.orm-entity";

@Injectable()
export class OutboxService {
  constructor(private readonly dataSource: DataSource) {}

  async enqueue(
    input: OutboxPublishInput,
    manager: EntityManager,
  ): Promise<OutboxEventOrmEntity> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new OutboxTransactionRequiredError();
    }

    const now = new Date();
    const repository = manager.getRepository(OutboxEventOrmEntity);
    const event = repository.create({
      id: randomUUID(),
      reference: input.reference ?? null,
      eventType: input.type,
      source: input.source,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      streamId: input.streamId,
      subject: input.subject ?? null,
      payload: input.payload,
      metadata: input.metadata ?? {},
      status: OutboxEventStatus.Pending,
      attempts: 0,
      availableAt: now,
      occurredAt: input.occurredAt ?? now,
      publishedAt: null,
      lastError: null,
    });

    return repository.save(event);
  }

  async enqueueInTransaction<T>(
    work: (manager: EntityManager) => Promise<{ result: T; event: OutboxPublishInput }>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const { result, event } = await work(manager);
      await this.enqueue(event, manager);
      return result;
    });
  }
}
`;

  await writeFile(path.join(eventBackbonePath, 'outbox.service.ts'), outboxServiceContent);

  const noopPublisherContent = `import { Injectable, Logger } from "@nestjs/common";
import { EventBackboneEnvelope, EventBackbonePublisher } from "../event-backbone.types";

@Injectable()
export class NoopEventPublisher implements EventBackbonePublisher {
  private readonly logger = new Logger(NoopEventPublisher.name);

  async publish(envelope: EventBackboneEnvelope): Promise<void> {
    this.logger.debug(
      "Event backbone publish skipped because Pulsar is disabled: " + envelope.type,
    );
  }
}
`;

  await writeFile(path.join(publishersPath, 'noop-event.publisher.ts'), noopPublisherContent);

  const pulsarPublisherContent = `import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventBackboneEnvelope, EventBackbonePublisher } from "../event-backbone.types";
import { EVENT_BACKBONE_ENV } from "../event-backbone.constants";

type PulsarModule = typeof import("pulsar-client");
type PulsarClient = import("pulsar-client").Client;
type PulsarProducer = import("pulsar-client").Producer;

@Injectable()
export class PulsarEventPublisher implements EventBackbonePublisher, OnModuleDestroy {
  private readonly logger = new Logger(PulsarEventPublisher.name);
  private pulsar?: PulsarModule;
  private client?: PulsarClient;
  private readonly producers = new Map<string, PulsarProducer>();

  constructor(private readonly configService: ConfigService) {}

  async publish(envelope: EventBackboneEnvelope): Promise<void> {
    const producer = await this.producerFor(envelope);
    await producer.send({
      data: Buffer.from(JSON.stringify(envelope)),
      eventTimestamp: Date.parse(envelope.occurredAt),
      properties: {
        event_id: envelope.id,
        event_type: envelope.type,
        aggregate_type: envelope.aggregateType,
        aggregate_id: envelope.aggregateId,
        reference: envelope.reference ?? "",
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    for (const producer of this.producers.values()) {
      await producer.close();
    }
    this.producers.clear();
    await this.client?.close();
  }

  private async producerFor(envelope: EventBackboneEnvelope): Promise<PulsarProducer> {
    const topic = this.topicFor(envelope);
    const cached = this.producers.get(topic);
    if (cached) {
      return cached;
    }

    const client = await this.getClient();
    const producer = await client.createProducer({ topic });
    this.producers.set(topic, producer);
    return producer;
  }

  private async getClient(): Promise<PulsarClient> {
    if (this.client) {
      return this.client;
    }

    this.pulsar = await import("pulsar-client");
    const serviceUrl =
      this.configService.get<string>(EVENT_BACKBONE_ENV.pulsarServiceUrl) ??
      "pulsar://localhost:6650";

    this.logger.log("Connecting event backbone to Pulsar at " + serviceUrl);
    this.client = new this.pulsar.Client({ serviceUrl });
    return this.client;
  }

  private topicFor(envelope: EventBackboneEnvelope): string {
    const tenant = this.configService.get<string>(EVENT_BACKBONE_ENV.pulsarTenant) ?? "public";
    const namespace =
      this.configService.get<string>(EVENT_BACKBONE_ENV.pulsarNamespace) ?? "default";
    const prefix = this.configService.get<string>(EVENT_BACKBONE_ENV.pulsarTopicPrefix) ?? "";
    const eventType = envelope.type.replace(/[^a-zA-Z0-9._-]/g, ".").toLowerCase();

    return "persistent://" + tenant + "/" + namespace + "/" + prefix + eventType;
  }
}
`;

  await writeFile(path.join(publishersPath, 'pulsar-event.publisher.ts'), pulsarPublisherContent);

  const relayServiceContent = `import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { EVENT_BACKBONE_ENV, EVENT_BACKBONE_PUBLISHER } from "./event-backbone.constants";
import {
  EventBackboneEnvelope,
  EventBackbonePublisher,
  OutboxEventStatus,
} from "./event-backbone.types";
import { OutboxEventOrmEntity } from "./entities/outbox-event.orm-entity";

interface ClaimedOutboxRow {
  id: string;
  reference: string | null;
  event_type: string;
  source: string;
  aggregate_type: string;
  aggregate_id: string;
  stream_id: string;
  subject: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  attempts: number;
  occurred_at: Date | string;
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @Inject(EVENT_BACKBONE_PUBLISHER)
    private readonly publisher: EventBackbonePublisher,
  ) {}

  @Interval(1000)
  async flush(): Promise<void> {
    if (this.running || !this.enabled()) {
      return;
    }

    this.running = true;
    try {
      const rows = await this.claimBatch();
      for (const row of rows) {
        await this.publishRow(row);
      }
    } finally {
      this.running = false;
    }
  }

  private enabled(): boolean {
    return this.configService.get<string>(EVENT_BACKBONE_ENV.relayEnabled, "true") !== "false";
  }

  private async claimBatch(): Promise<ClaimedOutboxRow[]> {
    const batchSize = this.integerEnv(EVENT_BACKBONE_ENV.relayBatchSize, 50);
    const maxAttempts = this.integerEnv(EVENT_BACKBONE_ENV.relayMaxAttempts, 10);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        "UPDATE outbox_events " +
          "SET status = $1, attempts = attempts + 1, updated_at = now() " +
          "WHERE id IN (" +
          "SELECT id FROM outbox_events " +
          "WHERE status IN ($2, $3) AND available_at <= now() AND attempts < $4 " +
          "ORDER BY available_at ASC " +
          "LIMIT $5 " +
          "FOR UPDATE SKIP LOCKED" +
          ") RETURNING *",
        [
          OutboxEventStatus.Publishing,
          OutboxEventStatus.Pending,
          OutboxEventStatus.Failed,
          maxAttempts,
          batchSize,
        ],
      );

      return rows as ClaimedOutboxRow[];
    });
  }

  private async publishRow(row: ClaimedOutboxRow): Promise<void> {
    const repository = this.dataSource.getRepository(OutboxEventOrmEntity);

    try {
      await this.publisher.publish(this.envelopeFromRow(row));
      await repository.update(row.id, {
        status: OutboxEventStatus.Published,
        publishedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const maxAttempts = this.integerEnv(EVENT_BACKBONE_ENV.relayMaxAttempts, 10);
      const nextStatus =
        row.attempts >= maxAttempts ? OutboxEventStatus.Failed : OutboxEventStatus.Pending;
      const delayMs = this.integerEnv(EVENT_BACKBONE_ENV.relayRetryBaseMs, 30000) * row.attempts;

      await repository.update(row.id, {
        status: nextStatus,
        availableAt: new Date(Date.now() + delayMs),
        lastError: message,
      });

      this.logger.warn("Failed to publish outbox event " + row.id + ": " + message);
    }
  }

  private envelopeFromRow(row: ClaimedOutboxRow): EventBackboneEnvelope {
    const occurredAt =
      row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at;

    return {
      id: row.id,
      reference: row.reference ?? undefined,
      type: row.event_type,
      source: row.source,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      streamId: row.stream_id,
      subject: row.subject ?? undefined,
      payload: row.payload,
      metadata: row.metadata ?? {},
      occurredAt,
    };
  }

  private integerEnv(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
`;

  await writeFile(path.join(eventBackbonePath, 'outbox-relay.service.ts'), relayServiceContent);

  const moduleContent = `import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessReferenceModule } from "../business-references";
import { EVENT_BACKBONE_ENV, EVENT_BACKBONE_PUBLISHER } from "./event-backbone.constants";
import { EventStoreService } from "./event-store.service";
import { OutboxRelayService } from "./outbox-relay.service";
import { OutboxService } from "./outbox.service";
import { EventStoreOrmEntity } from "./entities/event-store.orm-entity";
import { OutboxEventOrmEntity } from "./entities/outbox-event.orm-entity";
import { ProjectionCheckpointOrmEntity } from "./entities/projection-checkpoint.orm-entity";
import { NoopEventPublisher } from "./publishers/noop-event.publisher";
import { PulsarEventPublisher } from "./publishers/pulsar-event.publisher";

@Module({
  imports: [
    ConfigModule,
    BusinessReferenceModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      EventStoreOrmEntity,
      OutboxEventOrmEntity,
      ProjectionCheckpointOrmEntity,
    ]),
  ],
  providers: [
    EventStoreService,
    OutboxService,
    OutboxRelayService,
    {
      provide: EVENT_BACKBONE_PUBLISHER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pulsarEnabled =
          configService.get<string>(EVENT_BACKBONE_ENV.pulsarEnabled) === "true";
        return pulsarEnabled
          ? new PulsarEventPublisher(configService)
          : new NoopEventPublisher();
      },
    },
  ],
  exports: [EventStoreService, OutboxService, EVENT_BACKBONE_PUBLISHER],
})
export class EventBackboneModule {}
`;

  await writeFile(path.join(eventBackbonePath, 'event-backbone.module.ts'), moduleContent);

  const indexContent = `export * from "./event-backbone.constants";
export * from "./event-backbone.env";
export * from "./event-backbone.errors";
export * from "./event-backbone.types";
export * from "./event-store.service";
export * from "./outbox.service";
export * from "./event-backbone.module";
export * from "./entities/event-store.orm-entity";
export * from "./entities/outbox-event.orm-entity";
export * from "./entities/projection-checkpoint.orm-entity";
`;

  await writeFile(path.join(eventBackbonePath, 'index.ts'), indexContent);

  const timestamp = Date.now();
  const migrationName = `CreateEventBackboneTables${timestamp}`;
  const migrationContent = `import { MigrationInterface, QueryRunner } from "typeorm";

export class ${migrationName} implements MigrationInterface {
  name = "${migrationName}";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE IF NOT EXISTS "event_store" ("global_seq" bigserial PRIMARY KEY, "event_id" uuid NOT NULL, "reference" varchar(96), "stream_id" varchar(160) NOT NULL, "version" int NOT NULL, "type" varchar(160) NOT NULL, "aggregate_type" varchar(96) NOT NULL, "aggregate_id" varchar(96) NOT NULL, "payload" jsonb NOT NULL, "metadata" jsonb NOT NULL DEFAULT \\'{}\\'::jsonb, "occurred_at" timestamptz NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "uq_event_store_stream_version" UNIQUE ("stream_id", "version"))');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_event_store_stream" ON "event_store" ("stream_id")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_event_store_type" ON "event_store" ("type")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_event_store_aggregate" ON "event_store" ("aggregate_type", "aggregate_id")');

    await queryRunner.query('CREATE TABLE IF NOT EXISTS "outbox_events" ("id" uuid PRIMARY KEY, "reference" varchar(96), "event_type" varchar(160) NOT NULL, "source" varchar(160) NOT NULL, "aggregate_type" varchar(96) NOT NULL, "aggregate_id" varchar(96) NOT NULL, "stream_id" varchar(160) NOT NULL, "subject" varchar(160), "payload" jsonb NOT NULL, "metadata" jsonb NOT NULL DEFAULT \\'{}\\'::jsonb, "status" varchar(20) NOT NULL DEFAULT \\'PENDING\\', "attempts" int NOT NULL DEFAULT 0, "available_at" timestamptz NOT NULL, "occurred_at" timestamptz NOT NULL, "published_at" timestamptz, "last_error" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "chk_outbox_events_status" CHECK ("status" IN (\\'PENDING\\', \\'PUBLISHING\\', \\'PUBLISHED\\', \\'FAILED\\')))');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_outbox_events_status_available" ON "outbox_events" ("status", "available_at")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_outbox_events_aggregate" ON "outbox_events" ("aggregate_type", "aggregate_id")');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_outbox_events_reference" ON "outbox_events" ("reference") WHERE "reference" IS NOT NULL');

    await queryRunner.query('CREATE TABLE IF NOT EXISTS "projection_checkpoints" ("projection" varchar(120) PRIMARY KEY, "last_seq" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL DEFAULT now())');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "projection_checkpoints"');
    await queryRunner.query('DROP TABLE IF EXISTS "outbox_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "event_store"');
  }
}
`;

  await writeFile(
    path.join(migrationsPath, `${timestamp}-CreateEventBackboneTables.ts`),
    migrationContent,
  );

  console.log(chalk.green('  ✓ Business reference sidecar recipe installed'));
  console.log(chalk.green('  ✓ Joi environment schema fragment'));
  console.log(chalk.green('  ✓ Postgres event store entities and service'));
  console.log(chalk.green('  ✓ Transactional outbox service and relay'));
  console.log(chalk.green('  ✓ Pulsar publisher adapter with no-op fallback'));
  console.log(chalk.green('  ✓ TypeORM migration for event backbone tables'));
}
