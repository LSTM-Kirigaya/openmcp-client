import { Command } from 'commander';
import { mcpServerCommand } from './server.js';
import { mcpSessionCommand } from './session.js';

export const mcpCommand = new Command('mcp')
  .description('MCP Server and session management')
  .addHelpText('after', `
Quick start:
  openmcp-cli mcp server list
  openmcp-cli mcp server add --file config.json
  openmcp-cli mcp server edit --id <ID> --file patch.json
  openmcp-cli mcp session connect --id <ID>
  openmcp-cli mcp session list
  openmcp-cli mcp session disconnect
`);

mcpCommand.addCommand(mcpServerCommand);
mcpCommand.addCommand(mcpSessionCommand);
