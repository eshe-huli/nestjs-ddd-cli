import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { applyEventBackboneRecipe } from '../../src/commands/recipes/event-backbone.recipe';

describe('event backbone recipe', () => {
  const testDir = path.join(__dirname, '../.test-event-backbone-output');

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('generates replay-safe outbox and relay contracts', async () => {
    await fs.ensureDir(testDir);
    await applyEventBackboneRecipe(testDir);

    const root = path.join(testDir, 'src/shared/event-backbone');
    const types = await fs.readFile(path.join(root, 'event-backbone.types.ts'), 'utf-8');
    const envSchema = await fs.readFile(path.join(root, 'event-backbone.env.ts'), 'utf-8');
    const constants = await fs.readFile(path.join(root, 'event-backbone.constants.ts'), 'utf-8');
    const relayHttpPublisher = await fs.readFile(
      path.join(root, 'publishers/relay-http.publisher.ts'),
      'utf-8',
    );
    const eventBackboneModule = await fs.readFile(
      path.join(root, 'event-backbone.module.ts'),
      'utf-8',
    );
    const outbox = await fs.readFile(path.join(root, 'outbox.service.ts'), 'utf-8');
    const relay = await fs.readFile(path.join(root, 'outbox-relay.service.ts'), 'utf-8');
    const migrationDirectory = path.join(testDir, 'src/migrations');
    const migrations = await fs.readdir(migrationDirectory);
    const [migrationFile] = migrations;
    expect(migrationFile).toBeDefined();
    const migration = await fs.readFile(path.join(migrationDirectory, migrationFile!), 'utf-8');

    expect(types).toContain('eventId: string;');
    expect(types).toContain('version: number;');
    expect(types).toContain('schemaVersion: number;');
    expect(types).toContain('piiClassification?: EventPiiClassification;');
    expect(constants).toContain('relayHttp: "relay-http"');
    expect(envSchema).toContain('.default("none")');
    expect(envSchema).toContain('EVENT_BACKBONE_RELAY_HTTP_URL');
    expect(envSchema).toContain('EVENT_BACKBONE_RELAY_SERVICE_CREDENTIAL');
    expect(relayHttpPublisher).toContain(
      'class RelayHttpPublisher implements EventBackbonePublisher',
    );
    expect(relayHttpPublisher).toContain('"/api/v1/events"');
    expect(relayHttpPublisher).toContain('Authorization: "Bearer " + machineToken');
    expect(relayHttpPublisher).toContain('AbortSignal.timeout(timeoutMs)');
    expect(relayHttpPublisher).toContain('"Idempotency-Key": envelope.id');
    expect(relayHttpPublisher).toContain('reference: envelope.reference || envelope.id');
    expect(relayHttpPublisher).toContain('status === 408 || status === 425 || status === 429');
    expect(eventBackboneModule).toContain('new RelayHttpPublisher(configService)');
    expect(eventBackboneModule).toContain('new PulsarEventPublisher(configService)');
    expect(eventBackboneModule).toContain('EVENT_BACKBONE_TRANSPORT.none');
    expect(outbox).toContain('id: input.eventId');
    expect(outbox).toContain('version: input.version');
    expect(outbox).not.toContain('id: randomUUID()');
    expect(relay).toContain('EVENT_BACKBONE_TRANSPORT.none');
    expect(relay).toContain('schemaVersion');
    expect(relay).toContain("updated_at < now() - interval '5 minutes'");
    expect(relay).toContain('Array.isArray(result[0]) ? result[0] : result');
    expect(relay).toContain('version: row.version');
    expect(migration).toContain('idx_event_store_event_id');
    expect(migration).toContain('"version" int NOT NULL');
  });
});
