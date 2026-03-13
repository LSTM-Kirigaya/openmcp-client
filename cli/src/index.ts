#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { devCommand } from './commands/dev.js';
import { startCommand } from './commands/start.js';
import { updateCommand } from './commands/update.js';
import { version } from './utils/version.js';

const program = new Command();

program
  .name('openmcp-cli')
  .description('CLI tool for OpenMCP - Quickly setup and run OpenMCP development environment')
  .version(version, '-v, --version', 'Display version number');

// Init command - Initialize a new OpenMCP project
program
  .command('init')
  .description('Initialize a new OpenMCP project in the current directory')
  .argument('[project-name]', 'Name of the project directory to create', 'openmcp-project')
  .option('-t, --template <template>', 'Project template to use', 'default')
  .option('-f, --force', 'Force overwrite if directory exists', false)
  .action(initCommand);

// Dev command - Start development servers
program
  .command('dev')
  .description('Start OpenMCP in development mode (service + renderer)')
  .argument('[project-path]', 'Path to the OpenMCP project', '.')
  .option('-s, --service-only', 'Start only the service (backend)', false)
  .option('-r, --renderer-only', 'Start only the renderer (frontend)', false)
  .option('-p, --port <port>', 'Service port number', '8282')
  .action(devCommand);

// Start command - Start production servers
program
  .command('start')
  .description('Start OpenMCP in production mode')
  .argument('[project-path]', 'Path to the OpenMCP project', '.')
  .option('-p, --port <port>', 'Service port number', '8282')
  .action(startCommand);

// Update command - Update OpenMCP to latest version
program
  .command('update')
  .description('Update OpenMCP project to the latest version')
  .argument('[project-path]', 'Path to the OpenMCP project', '.')
  .option('-c, --check', 'Check for updates without applying', false)
  .action(updateCommand);

// Help command enhancement
program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log('  $ openmcp-cli init my-project        # Create a new project');
  console.log('  $ cd my-project && openmcp-cli dev   # Start development servers');
  console.log('  $ openmcp-cli dev -s                 # Start only backend service');
  console.log('  $ openmcp-cli start                  # Start production mode');
  console.log('');
  console.log(chalk.cyan('Documentation:'));
  console.log('  https://openmcp.kirigaya.cn');
  console.log('');
});

// Parse arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
