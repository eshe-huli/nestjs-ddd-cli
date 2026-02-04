import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface FileOperation {
  type: 'create' | 'modify' | 'delete';
  path: string;
  originalContent?: string;
  newContent?: string;
  timestamp: number;
}

export interface Transaction {
  id: string;
  name: string;
  startedAt: Date;
  operations: FileOperation[];
  status: 'pending' | 'committed' | 'rolled_back' | 'failed';
}

class TransactionManager {
  private currentTransaction: Transaction | null = null;
  private transactionHistory: Transaction[] = [];
  private enabled: boolean = false;

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  begin(name: string): string {
    if (!this.enabled) return '';

    if (this.currentTransaction) {
      throw new Error('Transaction already in progress. Commit or rollback first.');
    }

    const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentTransaction = {
      id,
      name,
      startedAt: new Date(),
      operations: [],
      status: 'pending',
    };

    console.log(chalk.gray(`  [Transaction: ${name}]`));
    return id;
  }

  recordCreate(filePath: string): void {
    if (!this.enabled || !this.currentTransaction) return;

    this.currentTransaction.operations.push({
      type: 'create',
      path: filePath,
      timestamp: Date.now(),
    });
  }

  recordModify(filePath: string, originalContent: string): void {
    if (!this.enabled || !this.currentTransaction) return;

    // Check if we already recorded this file
    const existing = this.currentTransaction.operations.find(
      op => op.path === filePath && op.type === 'modify'
    );

    if (!existing) {
      this.currentTransaction.operations.push({
        type: 'modify',
        path: filePath,
        originalContent,
        timestamp: Date.now(),
      });
    }
  }

  recordDelete(filePath: string, originalContent: string): void {
    if (!this.enabled || !this.currentTransaction) return;

    this.currentTransaction.operations.push({
      type: 'delete',
      path: filePath,
      originalContent,
      timestamp: Date.now(),
    });
  }

  async commit(): Promise<void> {
    if (!this.enabled || !this.currentTransaction) return;

    this.currentTransaction.status = 'committed';
    this.transactionHistory.push(this.currentTransaction);

    const opCount = this.currentTransaction.operations.length;
    console.log(chalk.green(`  ✓ Committed: ${opCount} file operations`));

    this.currentTransaction = null;
  }

  async rollback(reason?: string): Promise<void> {
    if (!this.currentTransaction) {
      console.log(chalk.yellow('No active transaction to rollback.'));
      return;
    }

    console.log(chalk.yellow(`\n⚠️  Rolling back transaction: ${this.currentTransaction.name}`));
    if (reason) {
      console.log(chalk.yellow(`   Reason: ${reason}`));
    }

    const operations = [...this.currentTransaction.operations].reverse();
    let rolledBack = 0;
    let failed = 0;

    for (const op of operations) {
      try {
        switch (op.type) {
          case 'create':
            // Delete created file
            if (fs.existsSync(op.path)) {
              fs.unlinkSync(op.path);
              // Try to remove empty parent directories
              this.cleanEmptyDirs(path.dirname(op.path));
            }
            break;

          case 'modify':
            // Restore original content
            if (op.originalContent !== undefined) {
              fs.writeFileSync(op.path, op.originalContent);
            }
            break;

          case 'delete':
            // Recreate deleted file
            if (op.originalContent !== undefined) {
              const dir = path.dirname(op.path);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(op.path, op.originalContent);
            }
            break;
        }
        rolledBack++;
      } catch (error) {
        failed++;
        console.log(chalk.red(`   Failed to rollback: ${op.path}`));
      }
    }

    this.currentTransaction.status = 'rolled_back';
    this.transactionHistory.push(this.currentTransaction);

    console.log(chalk.yellow(`   Rolled back ${rolledBack} operations${failed > 0 ? `, ${failed} failed` : ''}`));

    this.currentTransaction = null;
  }

  private cleanEmptyDirs(dir: string): void {
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        // Recursively check parent
        const parent = path.dirname(dir);
        if (parent !== dir) {
          this.cleanEmptyDirs(parent);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  getHistory(): Transaction[] {
    return [...this.transactionHistory];
  }

  getCurrentTransaction(): Transaction | null {
    return this.currentTransaction;
  }

  printHistory(): void {
    if (this.transactionHistory.length === 0) {
      console.log(chalk.gray('No transaction history.'));
      return;
    }

    console.log(chalk.bold.blue('\n📜 Transaction History\n'));

    for (const txn of this.transactionHistory.slice(-10)) {
      const statusIcon = txn.status === 'committed' ? '✓' :
                         txn.status === 'rolled_back' ? '↩' : '✗';
      const statusColor = txn.status === 'committed' ? chalk.green :
                          txn.status === 'rolled_back' ? chalk.yellow : chalk.red;

      console.log(statusColor(`  ${statusIcon} ${txn.name}`));
      console.log(chalk.gray(`    ${txn.operations.length} operations at ${txn.startedAt.toISOString()}`));
    }
  }
}

// Singleton instance
export const txn = new TransactionManager();

// Wrapper for file operations with automatic rollback support
export async function withTransaction<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  txn.begin(name);

  try {
    const result = await fn();
    await txn.commit();
    return result;
  } catch (error) {
    await txn.rollback(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Enhanced file utilities with transaction support
export function createFileWithRollback(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
  txn.recordCreate(filePath);
}

export function modifyFileWithRollback(filePath: string, content: string): void {
  let originalContent = '';
  if (fs.existsSync(filePath)) {
    originalContent = fs.readFileSync(filePath, 'utf-8');
  }

  fs.writeFileSync(filePath, content);
  txn.recordModify(filePath, originalContent);
}

export function deleteFileWithRollback(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const originalContent = fs.readFileSync(filePath, 'utf-8');
  fs.unlinkSync(filePath);
  txn.recordDelete(filePath, originalContent);
}

// Recovery utilities
export interface RecoveryPoint {
  id: string;
  name: string;
  createdAt: Date;
  files: Array<{ path: string; content: string }>;
}

export function createRecoveryPoint(basePath: string, name: string, patterns: string[]): RecoveryPoint {
  const point: RecoveryPoint = {
    id: `rp_${Date.now()}`,
    name,
    createdAt: new Date(),
    files: [],
  };

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDir(fullPath);
        }
      } else {
        const matches = patterns.some(p => {
          const regex = new RegExp(p.replace(/\*/g, '.*'));
          return regex.test(fullPath);
        });

        if (matches) {
          point.files.push({
            path: fullPath,
            content: fs.readFileSync(fullPath, 'utf-8'),
          });
        }
      }
    }
  }

  scanDir(basePath);

  console.log(chalk.green(`✓ Recovery point created: ${name} (${point.files.length} files)`));
  return point;
}

export function restoreFromRecoveryPoint(point: RecoveryPoint): void {
  console.log(chalk.yellow(`\n⚠️  Restoring from recovery point: ${point.name}`));

  let restored = 0;
  for (const file of point.files) {
    try {
      const dir = path.dirname(file.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file.path, file.content);
      restored++;
    } catch (error) {
      console.log(chalk.red(`   Failed to restore: ${file.path}`));
    }
  }

  console.log(chalk.green(`   Restored ${restored}/${point.files.length} files`));
}
