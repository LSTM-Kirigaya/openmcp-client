import { Command } from 'commander';
import {
  gatewayCommand,
  webCommand,
  startCommand,
  authCommand,
  rpcCommand,
  mcpCommand,
  llmCommand,
  settingCmd,
  panelCmd,
  skillsCmd,
  feedbackCmd,
  batchValidationCmd,
  debuggerCmd,
  ocrCmd
} from './commands/index.js';

const program = new Command();

program
  .name('openmcp-cli')
  .description('OpenMCP CLI — Gateway 管理与 service 全量能力（WebSocket 与 VSCode / Web UI 同源）')
  .version('0.2.0')
  .addCommand(gatewayCommand)
  .addCommand(webCommand)
  .addCommand(startCommand)
  .addCommand(authCommand)
  .addCommand(rpcCommand)
  .addCommand(mcpCommand)
  .addCommand(llmCommand)
  .addCommand(settingCmd)
  .addCommand(panelCmd)
  .addCommand(skillsCmd)
  .addCommand(feedbackCmd)
  .addCommand(batchValidationCmd)
  .addCommand(debuggerCmd)
  .addCommand(ocrCmd);

program.parse();
