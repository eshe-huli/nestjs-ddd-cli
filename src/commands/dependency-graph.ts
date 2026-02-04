import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { writeFile } from '../utils/file.utils';

export interface DependencyGraphOptions {
  output?: string;
  format?: 'text' | 'json' | 'mermaid' | 'dot';
  showCircular?: boolean;
}

interface ModuleNode {
  name: string;
  path: string;
  imports: string[];
  exports: string[];
  providers: string[];
  controllers: string[];
}

interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'inject' | 'extends';
}

interface CircularDependency {
  cycle: string[];
  severity: 'error' | 'warning';
}

interface DependencyReport {
  modules: ModuleNode[];
  edges: DependencyEdge[];
  circularDependencies: CircularDependency[];
  metrics: {
    totalModules: number;
    totalEdges: number;
    avgDependencies: number;
    maxDependencies: { module: string; count: number };
    orphanModules: string[];
  };
}

export async function analyzeDependencies(basePath: string, options: DependencyGraphOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🔍 Analyzing Module Dependencies...\n'));

  const modulesPath = path.join(basePath, 'src/modules');
  const sharedPath = path.join(basePath, 'src/shared');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.red('❌ No modules directory found.'));
    return;
  }

  const report = await buildDependencyReport(modulesPath, sharedPath);

  // Print or export report
  switch (options.format) {
    case 'json':
      await exportJsonReport(basePath, report, options.output);
      break;
    case 'mermaid':
      await exportMermaidDiagram(basePath, report, options.output);
      break;
    case 'dot':
      await exportDotGraph(basePath, report, options.output);
      break;
    default:
      printTextReport(report, options.showCircular);
  }
}

async function buildDependencyReport(modulesPath: string, sharedPath: string): Promise<DependencyReport> {
  const modules: ModuleNode[] = [];
  const edges: DependencyEdge[] = [];

  // Scan module directories
  const moduleDirs = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of moduleDirs) {
    const modulePath = path.join(modulesPath, moduleName);
    const moduleNode = await analyzeModule(modulePath, moduleName);

    if (moduleNode) {
      modules.push(moduleNode);
    }
  }

  // Add shared modules
  if (fs.existsSync(sharedPath)) {
    const sharedDirs = fs.readdirSync(sharedPath).filter(f =>
      fs.statSync(path.join(sharedPath, f)).isDirectory()
    );

    for (const sharedName of sharedDirs) {
      const sharedModulePath = path.join(sharedPath, sharedName);
      const moduleFile = findModuleFile(sharedModulePath);

      if (moduleFile) {
        const moduleNode = await analyzeModule(sharedModulePath, `shared/${sharedName}`);
        if (moduleNode) {
          modules.push(moduleNode);
        }
      }
    }
  }

  // Build edges from imports
  for (const module of modules) {
    for (const importedModule of module.imports) {
      edges.push({
        from: module.name,
        to: importedModule,
        type: 'import',
      });
    }
  }

  // Detect circular dependencies
  const circularDependencies = detectCircularDependencies(modules, edges);

  // Calculate metrics
  const metrics = calculateMetrics(modules, edges);

  return { modules, edges, circularDependencies, metrics };
}

async function analyzeModule(modulePath: string, moduleName: string): Promise<ModuleNode | null> {
  const moduleFile = findModuleFile(modulePath);

  if (!moduleFile) {
    return null;
  }

  const content = fs.readFileSync(moduleFile, 'utf-8');

  const node: ModuleNode = {
    name: moduleName,
    path: moduleFile,
    imports: [],
    exports: [],
    providers: [],
    controllers: [],
  };

  // Extract imports array
  const importsMatch = content.match(/imports:\s*\[([\s\S]*?)\]/);
  if (importsMatch) {
    const importsContent = importsMatch[1];
    // Extract module names (both direct and forRoot/forFeature)
    const moduleRefs = importsContent.match(/(\w+)(?:Module)?(?:\.forRoot|\.forFeature|\.register)?\s*\(/g) || [];
    const directModules = importsContent.match(/(\w+Module)/g) || [];

    const allImports = [...new Set([
      ...moduleRefs.map(m => m.replace(/[(.]/g, '')),
      ...directModules,
    ])].filter(m => m !== 'Module' && !m.startsWith('forRoot'));

    node.imports = allImports;
  }

  // Extract exports array
  const exportsMatch = content.match(/exports:\s*\[([\s\S]*?)\]/);
  if (exportsMatch) {
    const exportsContent = exportsMatch[1];
    const exported = exportsContent.match(/\w+/g) || [];
    node.exports = exported;
  }

  // Extract providers array
  const providersMatch = content.match(/providers:\s*\[([\s\S]*?)\]/);
  if (providersMatch) {
    const providersContent = providersMatch[1];
    const providers = providersContent.match(/\w+(?:Service|Repository|Factory|Handler|Guard|Interceptor)/g) || [];
    node.providers = [...new Set(providers)];
  }

  // Extract controllers array
  const controllersMatch = content.match(/controllers:\s*\[([\s\S]*?)\]/);
  if (controllersMatch) {
    const controllersContent = controllersMatch[1];
    const controllers = controllersContent.match(/\w+(?:Controller|Resolver)/g) || [];
    node.controllers = controllers;
  }

  return node;
}

function findModuleFile(dir: string): string | null {
  const files = fs.readdirSync(dir);
  const moduleFile = files.find(f => f.endsWith('.module.ts'));
  return moduleFile ? path.join(dir, moduleFile) : null;
}

function detectCircularDependencies(modules: ModuleNode[], edges: DependencyEdge[]): CircularDependency[] {
  const circular: CircularDependency[] = [];
  const adjacency = new Map<string, string[]>();

  // Build adjacency list
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    adjacency.get(edge.from)!.push(edge.to);
  }

  // DFS to detect cycles
  function findCycles(node: string, visited: Set<string>, path: string[]): void {
    if (path.includes(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node];
      circular.push({
        cycle,
        severity: cycle.length <= 2 ? 'error' : 'warning',
      });
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      findCycles(neighbor, visited, [...path, node]);
    }
  }

  for (const module of modules) {
    findCycles(module.name, new Set(), []);
  }

  // Deduplicate cycles
  const uniqueCycles = circular.filter((c, i, arr) => {
    const normalized = [...c.cycle].sort().join(',');
    return arr.findIndex(x => [...x.cycle].sort().join(',') === normalized) === i;
  });

  return uniqueCycles;
}

function calculateMetrics(modules: ModuleNode[], edges: DependencyEdge[]): DependencyReport['metrics'] {
  const dependencyCount = new Map<string, number>();

  for (const module of modules) {
    dependencyCount.set(module.name, module.imports.length);
  }

  const counts = Array.from(dependencyCount.values());
  const avgDependencies = counts.length > 0
    ? counts.reduce((a, b) => a + b, 0) / counts.length
    : 0;

  let maxDependencies = { module: '', count: 0 };
  for (const [module, count] of dependencyCount) {
    if (count > maxDependencies.count) {
      maxDependencies = { module, count };
    }
  }

  // Find orphan modules (no imports and not imported by anyone)
  const importedModules = new Set(edges.map(e => e.to));
  const importingModules = new Set(edges.map(e => e.from));
  const orphanModules = modules
    .filter(m => !importedModules.has(m.name) && m.imports.length === 0)
    .map(m => m.name);

  return {
    totalModules: modules.length,
    totalEdges: edges.length,
    avgDependencies: Math.round(avgDependencies * 100) / 100,
    maxDependencies,
    orphanModules,
  };
}

function printTextReport(report: DependencyReport, showCircular?: boolean): void {
  console.log(chalk.bold('📊 Dependency Analysis Report\n'));

  // Metrics
  console.log(chalk.cyan('Metrics:'));
  console.log(`  Total Modules: ${report.metrics.totalModules}`);
  console.log(`  Total Dependencies: ${report.metrics.totalEdges}`);
  console.log(`  Avg Dependencies/Module: ${report.metrics.avgDependencies}`);
  console.log(`  Most Dependencies: ${report.metrics.maxDependencies.module} (${report.metrics.maxDependencies.count})`);

  if (report.metrics.orphanModules.length > 0) {
    console.log(chalk.yellow(`  Orphan Modules: ${report.metrics.orphanModules.join(', ')}`));
  }

  // Module list
  console.log(chalk.bold('\n📦 Modules:\n'));

  for (const module of report.modules) {
    console.log(chalk.cyan(`  ${module.name}`));
    if (module.imports.length > 0) {
      console.log(chalk.gray(`    → imports: ${module.imports.join(', ')}`));
    }
    if (module.providers.length > 0) {
      console.log(chalk.gray(`    → providers: ${module.providers.slice(0, 5).join(', ')}${module.providers.length > 5 ? '...' : ''}`));
    }
  }

  // Circular dependencies
  if (report.circularDependencies.length > 0) {
    console.log(chalk.bold.red('\n⚠️  Circular Dependencies Detected:\n'));

    for (const circular of report.circularDependencies) {
      const color = circular.severity === 'error' ? chalk.red : chalk.yellow;
      console.log(color(`  ${circular.cycle.join(' → ')}`));
    }

    console.log(chalk.yellow('\n  Circular dependencies can cause:'));
    console.log(chalk.yellow('  • Runtime errors during module initialization'));
    console.log(chalk.yellow('  • Undefined dependencies at injection time'));
    console.log(chalk.yellow('  • Difficult-to-debug issues'));
  } else {
    console.log(chalk.green('\n✅ No circular dependencies detected.'));
  }
}

async function exportJsonReport(basePath: string, report: DependencyReport, output?: string): Promise<void> {
  const outputPath = path.join(basePath, output || 'dependency-report.json');
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(chalk.green(`✓ JSON report exported to ${outputPath}`));
}

async function exportMermaidDiagram(basePath: string, report: DependencyReport, output?: string): Promise<void> {
  let mermaid = 'graph TD\n';

  // Add nodes
  for (const module of report.modules) {
    const sanitizedName = module.name.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `  ${sanitizedName}[${module.name}]\n`;
  }

  mermaid += '\n';

  // Add edges
  for (const edge of report.edges) {
    const from = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const to = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `  ${from} --> ${to}\n`;
  }

  // Highlight circular dependencies
  if (report.circularDependencies.length > 0) {
    mermaid += '\n  %% Circular dependencies\n';
    for (const circular of report.circularDependencies) {
      for (const node of circular.cycle) {
        const sanitized = node.replace(/[^a-zA-Z0-9]/g, '_');
        mermaid += `  style ${sanitized} fill:#f66\n`;
      }
    }
  }

  const outputPath = path.join(basePath, output || 'dependency-graph.mmd');
  await writeFile(outputPath, mermaid);
  console.log(chalk.green(`✓ Mermaid diagram exported to ${outputPath}`));
  console.log(chalk.gray('  View at: https://mermaid.live'));
}

async function exportDotGraph(basePath: string, report: DependencyReport, output?: string): Promise<void> {
  let dot = 'digraph Dependencies {\n';
  dot += '  rankdir=TB;\n';
  dot += '  node [shape=box, style=rounded];\n\n';

  // Add nodes
  for (const module of report.modules) {
    const sanitizedName = module.name.replace(/[^a-zA-Z0-9]/g, '_');
    const isCircular = report.circularDependencies.some(c => c.cycle.includes(module.name));
    const color = isCircular ? ', color=red' : '';
    dot += `  ${sanitizedName} [label="${module.name}"${color}];\n`;
  }

  dot += '\n';

  // Add edges
  for (const edge of report.edges) {
    const from = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const to = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    dot += `  ${from} -> ${to};\n`;
  }

  dot += '}\n';

  const outputPath = path.join(basePath, output || 'dependency-graph.dot');
  await writeFile(outputPath, dot);
  console.log(chalk.green(`✓ DOT graph exported to ${outputPath}`));
  console.log(chalk.gray('  Generate image: dot -Tpng dependency-graph.dot -o dependency-graph.png'));
}
