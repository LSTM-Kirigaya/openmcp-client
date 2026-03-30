import { Command } from 'commander';
import {
  gatewayCommand,
  webCommand,
  startCommand,
  mcpCommand,
  cloudCommand,
  llmCommand,
  settingCmd,
  skillsCmd,
  validationCmd
} from './commands/index.js';
import { HELP_PROGRAM_AFTER } from './lib/help-text.js';

const program = new Command();

program
  .name('openmcp-cli')
  .description('OpenMCP CLI — Gateway 管理与 service 全量能力（WebSocket 与 VSCode / Web UI 同源）')
  .version('0.2.0')
  .addHelpText('after', HELP_PROGRAM_AFTER)
  .addCommand(gatewayCommand)
  .addCommand(webCommand)
  .addCommand(startCommand)
  .addCommand(mcpCommand)
  .addCommand(cloudCommand)
  .addCommand(llmCommand)
  .addCommand(settingCmd)
  .addCommand(skillsCmd)
  .addCommand(validationCmd);

program.parse();
