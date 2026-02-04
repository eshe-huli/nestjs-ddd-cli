import chalk from 'chalk';

export interface TimingEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  children: TimingEntry[];
}

export interface PerformanceReport {
  totalDuration: number;
  entries: TimingEntry[];
  slowOperations: Array<{ name: string; duration: number }>;
}

class PerformanceTracker {
  private entries: TimingEntry[] = [];
  private stack: TimingEntry[] = [];
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

  start(name: string): void {
    if (!this.enabled) return;

    const entry: TimingEntry = {
      name,
      startTime: performance.now(),
      children: [],
    };

    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].children.push(entry);
    } else {
      this.entries.push(entry);
    }

    this.stack.push(entry);
  }

  end(name: string): number {
    if (!this.enabled) return 0;

    const entry = this.stack.pop();
    if (!entry || entry.name !== name) {
      console.warn(`Performance timing mismatch: expected ${entry?.name}, got ${name}`);
      return 0;
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    return entry.duration;
  }

  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      return await fn();
    } finally {
      this.end(name);
    }
  }

  measureSync<T>(name: string, fn: () => T): T {
    this.start(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }

  getReport(): PerformanceReport {
    const totalDuration = this.entries.reduce(
      (sum, e) => sum + (e.duration || 0),
      0
    );

    const slowOperations = this.findSlowOperations(this.entries, 100);

    return {
      totalDuration,
      entries: this.entries,
      slowOperations: slowOperations.sort((a, b) => b.duration - a.duration).slice(0, 10),
    };
  }

  private findSlowOperations(entries: TimingEntry[], threshold: number): Array<{ name: string; duration: number }> {
    const slow: Array<{ name: string; duration: number }> = [];

    for (const entry of entries) {
      if (entry.duration && entry.duration > threshold) {
        slow.push({ name: entry.name, duration: entry.duration });
      }
      if (entry.children.length > 0) {
        slow.push(...this.findSlowOperations(entry.children, threshold));
      }
    }

    return slow;
  }

  printReport(): void {
    if (!this.enabled || this.entries.length === 0) return;

    const report = this.getReport();

    console.log(chalk.bold.blue('\n⏱️  Performance Report\n'));
    console.log(chalk.gray('─'.repeat(50)));

    this.printEntries(this.entries, 0);

    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.bold(`Total: ${formatDuration(report.totalDuration)}`));

    if (report.slowOperations.length > 0) {
      console.log(chalk.yellow('\n⚠️  Slow Operations (>100ms):'));
      for (const op of report.slowOperations.slice(0, 5)) {
        console.log(chalk.yellow(`  • ${op.name}: ${formatDuration(op.duration)}`));
      }
    }

    console.log();
  }

  private printEntries(entries: TimingEntry[], depth: number): void {
    const indent = '  '.repeat(depth);

    for (const entry of entries) {
      const duration = entry.duration || 0;
      const color = duration > 500 ? chalk.red :
                    duration > 100 ? chalk.yellow : chalk.green;

      console.log(`${indent}${entry.name}: ${color(formatDuration(duration))}`);

      if (entry.children.length > 0) {
        this.printEntries(entry.children, depth + 1);
      }
    }
  }

  reset(): void {
    this.entries = [];
    this.stack = [];
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

// Singleton instance
export const perf = new PerformanceTracker();

// Decorator for measuring method performance
export function Timed(name?: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const timerName = name || `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (...args: any[]) {
      return perf.measure(timerName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// Utility to wrap any async function with timing
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return perf.measure(name, fn);
}

export function timedSync<T>(name: string, fn: () => T): T {
  return perf.measureSync(name, fn);
}
