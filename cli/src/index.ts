import { Command } from 'commander';
import {
  gatewayCommand,
  webCommand,
  startCommand,
  projectCommand,
  authCommand
} from './commands/index.js';

const program = new Command();

program
  .name('openmcp-cli')
  .description('OpenMCP CLI - MCP Server Gateway & Debug Tool')
  .version('0.1.0')
  .addCommand(gatewayCommand)
  .addCommand(webCommand)
  .addCommand(startCommand)
  .addCommand(projectCommand)
  .addCommand(authCommand);

program.parse();
