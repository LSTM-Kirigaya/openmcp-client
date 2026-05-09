import { Command } from 'commander';
import { mcpServerCommand } from './server.js';
import { mcpSessionCommand } from './session.js';

export const mcpCommand = new Command('mcp')
  .description('MCP Server and session management')
  .addHelpText('after', `
Quick start:
  openmcp mcp server list
  openmcp mcp server add --file config.json
  openmcp mcp server edit --id <ID> --file patch.json
  openmcp mcp session connect --id <ID>
  openmcp mcp session list
  openmcp mcp session disconnect
`);

mcpCommand.addCommand(mcpServerCommand);
mcpCommand.addCommand(mcpSessionCommand);
