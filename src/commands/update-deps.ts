import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  checkOutdatedDependencies,
  updateDependencies,
} from '../utils/dependency.utils';

export interface UpdateDepsOptions {
  path?: string;
  all?: boolean;
}

export async function updateDeps(options: UpdateDepsOptions = {}) {
  try {
    const projectPath = options.path || process.cwd();
    
    console.log(chalk.blue('Checking for outdated dependencies...'));
    
    const outdatedDeps = await checkOutdatedDependencies(projectPath);
    const outdatedPackages = Object.keys(outdatedDeps);
    
    if (outdatedPackages.length === 0) {
      console.log(chalk.green('✅ All dependencies are up to date!'));
      return;
    }
    
    console.log(chalk.yellow(`Found ${outdatedPackages.length} outdated dependencies:`));
    
    for (const pkg of outdatedPackages) {
      const info = outdatedDeps[pkg];
      if (info) {
        const { current, latest, type } = info;
        console.log(
          chalk.yellow(`  ${pkg}: ${current} → ${latest} (${type})`)
        );
      }
    }
    
    let packagesToUpdate: string[] = [];
    
    if (options.all) {
      packagesToUpdate = outdatedPackages;
    } else {
      const { selectedPackages } = await inquirer.prompt<{selectedPackages: string[]}>(
        [
          {
            type: 'checkbox',
            name: 'selectedPackages',
            message: 'Select packages to update:',
            choices: outdatedPackages.map(pkg => {
              const info = outdatedDeps[pkg];
              return {
                name: info ? `${pkg}: ${info.current} → ${info.latest}` : pkg,
                value: pkg,
                checked: true,
              };
            }),
          },
        ]
      );
      
      packagesToUpdate = selectedPackages;
    }
    
    if (packagesToUpdate.length === 0) {
      console.log(chalk.yellow('No packages selected for update.'));
      return;
    }
    
    await updateDependencies(projectPath, packagesToUpdate);
    
  } catch (error) {
    console.error(chalk.red('Error:'), (error as Error).message);
    process.exit(1);
  }
}