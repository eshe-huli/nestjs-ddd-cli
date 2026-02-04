import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface RecipePlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies: string[];
  devDependencies: string[];
  apply: (basePath: string, options?: Record<string, any>) => Promise<void>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  dependencies: string[];
  devDependencies: string[];
  options?: Array<{
    name: string;
    type: 'string' | 'boolean' | 'number';
    description: string;
    default?: any;
    required?: boolean;
  }>;
}

export interface PluginRegistryEntry {
  name: string;
  path: string;
  manifest: PluginManifest;
  enabled: boolean;
}

class RecipePluginManager {
  private plugins: Map<string, PluginRegistryEntry> = new Map();
  private pluginsDir: string;

  constructor(basePath: string = process.cwd()) {
    this.pluginsDir = path.join(basePath, '.ddd/plugins');
  }

  async initialize(): Promise<void> {
    await ensureDir(this.pluginsDir);
    await this.loadPlugins();
  }

  async loadPlugins(): Promise<void> {
    if (!fs.existsSync(this.pluginsDir)) return;

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = path.join(this.pluginsDir, entry.name);
      const manifestPath = path.join(pluginPath, 'manifest.json');

      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest: PluginManifest = JSON.parse(
          fs.readFileSync(manifestPath, 'utf-8')
        );

        this.plugins.set(manifest.name, {
          name: manifest.name,
          path: pluginPath,
          manifest,
          enabled: true,
        });
      } catch (error) {
        console.warn(chalk.yellow(`Failed to load plugin: ${entry.name}`));
      }
    }
  }

  getPlugin(name: string): PluginRegistryEntry | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values());
  }

  async installPlugin(source: string): Promise<void> {
    console.log(chalk.blue(`Installing plugin from: ${source}`));

    // Support local path or npm package
    if (source.startsWith('.') || source.startsWith('/')) {
      await this.installLocalPlugin(source);
    } else {
      await this.installNpmPlugin(source);
    }
  }

  private async installLocalPlugin(sourcePath: string): Promise<void> {
    const absolutePath = path.resolve(sourcePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Plugin path not found: ${absolutePath}`);
    }

    const manifestPath = path.join(absolutePath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Plugin manifest.json not found');
    }

    const manifest: PluginManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf-8')
    );

    const targetPath = path.join(this.pluginsDir, manifest.name);

    // Copy plugin files
    await this.copyDirectory(absolutePath, targetPath);

    this.plugins.set(manifest.name, {
      name: manifest.name,
      path: targetPath,
      manifest,
      enabled: true,
    });

    console.log(chalk.green(`✓ Installed plugin: ${manifest.name}@${manifest.version}`));
  }

  private async installNpmPlugin(packageName: string): Promise<void> {
    // For npm plugins, we'd need to use npm/yarn to install
    // This is a simplified version
    console.log(chalk.yellow('NPM plugin installation not yet implemented.'));
    console.log(chalk.gray(`Would install: ${packageName}`));
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await ensureDir(dest);

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async uninstallPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    // Remove plugin directory
    fs.rmSync(plugin.path, { recursive: true, force: true });
    this.plugins.delete(name);

    console.log(chalk.green(`✓ Uninstalled plugin: ${name}`));
  }

  async runPlugin(name: string, basePath: string, options?: Record<string, any>): Promise<void> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (!plugin.enabled) {
      throw new Error(`Plugin is disabled: ${name}`);
    }

    const mainPath = path.join(plugin.path, plugin.manifest.main);

    if (!fs.existsSync(mainPath)) {
      throw new Error(`Plugin main file not found: ${mainPath}`);
    }

    console.log(chalk.blue(`Running plugin: ${name}`));

    try {
      // Load and execute plugin
      const pluginModule = require(mainPath);
      const applyFn = pluginModule.apply || pluginModule.default?.apply;

      if (typeof applyFn !== 'function') {
        throw new Error('Plugin does not export an apply function');
      }

      await applyFn(basePath, options);
      console.log(chalk.green(`✓ Plugin ${name} completed successfully`));
    } catch (error) {
      console.error(chalk.red(`Plugin ${name} failed:`), error);
      throw error;
    }
  }

  enablePlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = true;
      console.log(chalk.green(`✓ Enabled plugin: ${name}`));
    }
  }

  disablePlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = false;
      console.log(chalk.yellow(`✓ Disabled plugin: ${name}`));
    }
  }
}

// Export singleton instance factory
export function createPluginManager(basePath?: string): RecipePluginManager {
  return new RecipePluginManager(basePath);
}

// CLI commands for plugin management
export async function listPlugins(basePath: string): Promise<void> {
  const manager = createPluginManager(basePath);
  await manager.initialize();

  const plugins = manager.listPlugins();

  if (plugins.length === 0) {
    console.log(chalk.gray('\nNo plugins installed.'));
    console.log(chalk.gray('Install a plugin: ddd plugin install <path-or-package>'));
    return;
  }

  console.log(chalk.bold.blue('\n📦 Installed Recipe Plugins\n'));

  for (const plugin of plugins) {
    const status = plugin.enabled ? chalk.green('●') : chalk.gray('○');
    console.log(`${status} ${chalk.cyan(plugin.name)} v${plugin.manifest.version}`);
    console.log(chalk.gray(`  ${plugin.manifest.description}`));

    if (plugin.manifest.dependencies.length > 0) {
      console.log(chalk.gray(`  deps: ${plugin.manifest.dependencies.join(', ')}`));
    }
  }
}

export async function installPluginCommand(basePath: string, source: string): Promise<void> {
  const manager = createPluginManager(basePath);
  await manager.initialize();
  await manager.installPlugin(source);
}

export async function uninstallPluginCommand(basePath: string, name: string): Promise<void> {
  const manager = createPluginManager(basePath);
  await manager.initialize();
  await manager.uninstallPlugin(name);
}

export async function runPluginCommand(
  basePath: string,
  name: string,
  options?: Record<string, any>
): Promise<void> {
  const manager = createPluginManager(basePath);
  await manager.initialize();
  await manager.runPlugin(name, basePath, options);
}

// Plugin scaffold generator
export async function scaffoldPlugin(basePath: string, name: string): Promise<void> {
  const pluginPath = path.join(basePath, '.ddd/plugins', name);

  if (fs.existsSync(pluginPath)) {
    console.log(chalk.red(`Plugin "${name}" already exists.`));
    return;
  }

  await ensureDir(pluginPath);

  // Create manifest
  const manifest: PluginManifest = {
    name,
    version: '1.0.0',
    description: `Custom recipe plugin: ${name}`,
    main: 'index.js',
    dependencies: [],
    devDependencies: [],
    options: [
      {
        name: 'example',
        type: 'string',
        description: 'An example option',
        default: 'default-value',
      },
    ],
  };

  await writeFile(
    path.join(pluginPath, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Create main file
  const mainContent = `/**
 * Custom Recipe Plugin: ${name}
 *
 * This plugin is loaded and executed by the DDD CLI.
 * Implement the apply function to add your custom recipe logic.
 */

const fs = require('fs');
const path = require('path');

/**
 * Apply the recipe to the target project
 * @param {string} basePath - The root path of the target project
 * @param {object} options - Options passed from CLI or config
 */
async function apply(basePath, options = {}) {
  console.log('Applying ${name} recipe...');
  console.log('Options:', options);

  const sharedPath = path.join(basePath, 'src/shared');
  const targetPath = path.join(sharedPath, '${name}');

  // Create directory
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  // Generate your files here
  const exampleContent = \`// Generated by ${name} plugin
export const example = '${name}';
\`;

  fs.writeFileSync(
    path.join(targetPath, 'index.ts'),
    exampleContent
  );

  console.log('✓ ${name} recipe applied successfully!');
}

module.exports = { apply };
`;

  await writeFile(path.join(pluginPath, 'index.js'), mainContent);

  console.log(chalk.green(`\n✓ Created plugin scaffold: ${name}`));
  console.log(chalk.gray(`  Path: ${pluginPath}`));
  console.log(chalk.gray(`  Edit index.js to implement your recipe logic`));
}

// Check for conflicts between plugins and built-in recipes
export function checkPluginConflicts(
  pluginName: string,
  builtInRecipes: string[]
): string[] {
  const conflicts: string[] = [];

  if (builtInRecipes.includes(pluginName)) {
    conflicts.push(`Plugin "${pluginName}" conflicts with built-in recipe of the same name`);
  }

  return conflicts;
}
