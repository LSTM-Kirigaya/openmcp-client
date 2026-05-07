import { Command } from 'commander';
import {
  settingCommand,
  debugCommand,
  mcpCommand,
  gatewayCommand,
  webCommand,
  startCommand
} from './commands/index.js';
import { HELP_PROGRAM_AFTER } from './lib/help-text.js';

const program = new Command();

program
  .name('openmcp')
  .description('OpenMCP CLI — Gateway 管理与 MCP 全量能力')
  .version('0.2.0')
  .addHelpText('after', HELP_PROGRAM_AFTER)
  .addCommand(settingCommand)
  .addCommand(mcpCommand)
  .addCommand(debugCommand)
  .addCommand(gatewayCommand)
  .addCommand(webCommand)
  .addCommand(startCommand);

program.parse();
