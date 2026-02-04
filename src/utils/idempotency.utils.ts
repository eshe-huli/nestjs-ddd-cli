/**
 * Idempotency & Consistency System
 * Tracks generated files and ensures safe re-generation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface GenerationManifest {
  version: string;
  generatedAt: string;
  lastModified: string;
  generator: string;
  entities: EntityManifest[];
  files: FileManifest[];
  checksums: Record<string, string>;
}

export interface EntityManifest {
  name: string;
  module: string;
  fields: string[];
  relations: string[];
  generatedFiles: string[];
  hash: string;
  generatedAt: string;
}

export interface FileManifest {
  path: string;
  type: 'entity' | 'dto' | 'service' | 'controller' | 'repository' | 'module' | 'test' | 'other';
  entity?: string;
  module?: string;
  hash: string;
  generatedAt: string;
  modifiedAt?: string;
  isModified: boolean;
  mergeStrategy: MergeStrategy;
}

export type MergeStrategy = 'overwrite' | 'skip' | 'merge' | 'backup' | 'prompt';

export interface GenerationPlan {
  create: FileOperation[];
  update: FileOperation[];
  skip: FileOperation[];
  conflict: FileOperation[];
}

export interface FileOperation {
  path: string;
  action: 'create' | 'update' | 'skip' | 'conflict' | 'backup';
  reason?: string;
  content?: string;
  existingHash?: string;
  newHash?: string;
}

const MANIFEST_FILE = '.ddd/generation-manifest.json';
const HISTORY_DIR = '.ddd/history';

/**
 * Load or create generation manifest
 */
export function loadManifest(basePath: string): GenerationManifest {
  const manifestPath = path.join(basePath, MANIFEST_FILE);

  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  return createEmptyManifest();
}

/**
 * Create an empty manifest
 */
export function createEmptyManifest(): GenerationManifest {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    generator: 'nestjs-ddd-cli',
    entities: [],
    files: [],
    checksums: {},
  };
}

/**
 * Save manifest to disk
 */
export function saveManifest(basePath: string, manifest: GenerationManifest): void {
  const manifestPath = path.join(basePath, MANIFEST_FILE);
  const manifestDir = path.dirname(manifestPath);

  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  manifest.lastModified = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Calculate file hash
 */
export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Check if a file has been manually modified
 */
export function isFileModified(
  filePath: string,
  manifest: GenerationManifest
): boolean {
  const fileManifest = manifest.files.find(f => f.path === filePath);
  if (!fileManifest) return false;

  if (!fs.existsSync(filePath)) return false;

  const currentContent = fs.readFileSync(filePath, 'utf-8');
  const currentHash = calculateHash(currentContent);

  return currentHash !== fileManifest.hash;
}

/**
 * Plan generation operations with conflict detection
 */
export function planGeneration(
  basePath: string,
  filesToGenerate: Array<{ path: string; content: string; type: FileManifest['type'] }>,
  manifest: GenerationManifest,
  options: {
    mergeStrategy?: MergeStrategy;
    force?: boolean;
  } = {}
): GenerationPlan {
  const plan: GenerationPlan = {
    create: [],
    update: [],
    skip: [],
    conflict: [],
  };

  const strategy = options.mergeStrategy || 'prompt';

  for (const file of filesToGenerate) {
    const absolutePath = path.join(basePath, file.path);
    const newHash = calculateHash(file.content);
    const existingManifest = manifest.files.find(f => f.path === file.path);

    if (!fs.existsSync(absolutePath)) {
      // New file - create it
      plan.create.push({
        path: file.path,
        action: 'create',
        content: file.content,
        newHash,
      });
    } else {
      // File exists - check for conflicts
      const existingContent = fs.readFileSync(absolutePath, 'utf-8');
      const existingHash = calculateHash(existingContent);

      if (existingHash === newHash) {
        // Content is identical - skip
        plan.skip.push({
          path: file.path,
          action: 'skip',
          reason: 'Content unchanged',
        });
      } else if (existingManifest && existingHash === existingManifest.hash) {
        // File hasn't been modified since last generation - safe to update
        plan.update.push({
          path: file.path,
          action: 'update',
          content: file.content,
          existingHash,
          newHash,
        });
      } else if (options.force) {
        // Force overwrite
        plan.update.push({
          path: file.path,
          action: 'update',
          content: file.content,
          reason: 'Forced overwrite',
          existingHash,
          newHash,
        });
      } else {
        // File has been manually modified - conflict
        const operation: FileOperation = {
          path: file.path,
          action: 'conflict',
          content: file.content,
          reason: 'File has been manually modified',
          existingHash,
          newHash,
        };

        switch (strategy) {
          case 'overwrite':
            operation.action = 'update';
            plan.update.push(operation);
            break;
          case 'skip':
            operation.action = 'skip';
            plan.skip.push(operation);
            break;
          case 'backup':
            operation.action = 'backup';
            plan.update.push(operation);
            break;
          default:
            plan.conflict.push(operation);
        }
      }
    }
  }

  return plan;
}

/**
 * Execute a generation plan
 */
export function executePlan(
  basePath: string,
  plan: GenerationPlan,
  manifest: GenerationManifest
): { success: boolean; created: number; updated: number; skipped: number; errors: string[] } {
  const result = { success: true, created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  // Handle creates
  for (const op of plan.create) {
    try {
      const absolutePath = path.join(basePath, op.path);
      const dir = path.dirname(absolutePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(absolutePath, op.content!);

      // Update manifest
      manifest.files.push({
        path: op.path,
        type: detectFileType(op.path),
        hash: op.newHash!,
        generatedAt: new Date().toISOString(),
        isModified: false,
        mergeStrategy: 'prompt',
      });
      manifest.checksums[op.path] = op.newHash!;

      result.created++;
    } catch (error) {
      result.errors.push(`Failed to create ${op.path}: ${(error as Error).message}`);
      result.success = false;
    }
  }

  // Handle updates
  for (const op of plan.update) {
    try {
      const absolutePath = path.join(basePath, op.path);

      // Backup if requested
      if (op.action === 'backup') {
        backupFile(basePath, op.path);
      }

      fs.writeFileSync(absolutePath, op.content!);

      // Update manifest
      const existingManifest = manifest.files.find(f => f.path === op.path);
      if (existingManifest) {
        existingManifest.hash = op.newHash!;
        existingManifest.modifiedAt = new Date().toISOString();
        existingManifest.isModified = false;
      }
      manifest.checksums[op.path] = op.newHash!;

      result.updated++;
    } catch (error) {
      result.errors.push(`Failed to update ${op.path}: ${(error as Error).message}`);
      result.success = false;
    }
  }

  result.skipped = plan.skip.length;

  return result;
}

/**
 * Backup a file before overwriting
 */
export function backupFile(basePath: string, filePath: string): string {
  const historyDir = path.join(basePath, HISTORY_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(historyDir, `${filePath}.${timestamp}.bak`);

  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const originalPath = path.join(basePath, filePath);
  if (fs.existsSync(originalPath)) {
    fs.copyFileSync(originalPath, backupPath);
  }

  return backupPath;
}

/**
 * Restore a file from backup
 */
export function restoreFile(basePath: string, filePath: string, backupTimestamp?: string): boolean {
  const historyDir = path.join(basePath, HISTORY_DIR);

  if (backupTimestamp) {
    const backupPath = path.join(historyDir, `${filePath}.${backupTimestamp}.bak`);
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, path.join(basePath, filePath));
      return true;
    }
    return false;
  }

  // Find most recent backup
  const backupPattern = new RegExp(`^${escapeRegex(filePath)}\\..*\\.bak$`);
  const backups = findBackups(historyDir, backupPattern);

  if (backups.length > 0) {
    const mostRecent = backups.sort().pop()!;
    fs.copyFileSync(mostRecent, path.join(basePath, filePath));
    return true;
  }

  return false;
}

/**
 * Find backup files matching a pattern
 */
function findBackups(dir: string, pattern: RegExp): string[] {
  const backups: string[] = [];

  function scan(d: string) {
    if (!fs.existsSync(d)) return;

    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (pattern.test(entry.name)) {
        backups.push(fullPath);
      }
    }
  }

  scan(dir);
  return backups;
}

/**
 * Register an entity in the manifest
 */
export function registerEntity(
  manifest: GenerationManifest,
  entity: {
    name: string;
    module: string;
    fields: string[];
    relations: string[];
    generatedFiles: string[];
  }
): void {
  const hash = calculateHash(JSON.stringify({ ...entity, timestamp: Date.now() }));

  const existingIndex = manifest.entities.findIndex(
    e => e.name === entity.name && e.module === entity.module
  );

  const entityManifest: EntityManifest = {
    ...entity,
    hash,
    generatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    manifest.entities[existingIndex] = entityManifest;
  } else {
    manifest.entities.push(entityManifest);
  }
}

/**
 * Check if an entity was previously generated
 */
export function wasEntityGenerated(
  manifest: GenerationManifest,
  entityName: string,
  moduleName: string
): boolean {
  return manifest.entities.some(
    e => e.name === entityName && e.module === moduleName
  );
}

/**
 * Get entity manifest
 */
export function getEntityManifest(
  manifest: GenerationManifest,
  entityName: string,
  moduleName: string
): EntityManifest | undefined {
  return manifest.entities.find(
    e => e.name === entityName && e.module === moduleName
  );
}

/**
 * Detect file type from path
 */
function detectFileType(filePath: string): FileManifest['type'] {
  if (filePath.includes('.entity.ts')) return 'entity';
  if (filePath.includes('.dto.ts')) return 'dto';
  if (filePath.includes('.service.ts')) return 'service';
  if (filePath.includes('.controller.ts')) return 'controller';
  if (filePath.includes('.repository.ts')) return 'repository';
  if (filePath.includes('.module.ts')) return 'module';
  if (filePath.includes('.spec.ts') || filePath.includes('.test.ts')) return 'test';
  return 'other';
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clean up old backups (keep last N)
 */
export function cleanupBackups(basePath: string, keepLast: number = 10): number {
  const historyDir = path.join(basePath, HISTORY_DIR);
  if (!fs.existsSync(historyDir)) return 0;

  const backupsByFile = new Map<string, string[]>();

  function scan(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('.bak')) {
        const originalName = entry.name.replace(/\.\d{4}-\d{2}-\d{2}T.*\.bak$/, '');
        const existing = backupsByFile.get(originalName) || [];
        existing.push(fullPath);
        backupsByFile.set(originalName, existing);
      }
    }
  }

  scan(historyDir);

  let deleted = 0;
  for (const [, backups] of backupsByFile) {
    const sorted = backups.sort().reverse();
    for (const backup of sorted.slice(keepLast)) {
      fs.unlinkSync(backup);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Generate a summary of what will change
 */
export function summarizePlan(plan: GenerationPlan): string {
  const lines: string[] = [];

  if (plan.create.length > 0) {
    lines.push(`Create ${plan.create.length} files:`);
    for (const op of plan.create.slice(0, 5)) {
      lines.push(`  + ${op.path}`);
    }
    if (plan.create.length > 5) {
      lines.push(`  ... and ${plan.create.length - 5} more`);
    }
  }

  if (plan.update.length > 0) {
    lines.push(`Update ${plan.update.length} files:`);
    for (const op of plan.update.slice(0, 5)) {
      lines.push(`  ~ ${op.path}`);
    }
    if (plan.update.length > 5) {
      lines.push(`  ... and ${plan.update.length - 5} more`);
    }
  }

  if (plan.conflict.length > 0) {
    lines.push(`Conflicts in ${plan.conflict.length} files:`);
    for (const op of plan.conflict) {
      lines.push(`  ! ${op.path} (${op.reason})`);
    }
  }

  if (plan.skip.length > 0) {
    lines.push(`Skip ${plan.skip.length} unchanged files`);
  }

  return lines.join('\n');
}
