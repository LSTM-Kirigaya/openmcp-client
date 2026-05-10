import { Command } from 'commander';
import { resourceCommand } from './resource.js';
import { promptCommand } from './prompt.js';
import { toolCommand } from './tool.js';
import { chatCommand } from './chat.js';
import { batchCommand } from './batch.js';
import { mcpRawCommand } from './mcp.js';

export const debugCommand = new Command('debug')
  .description('MCP debugging and testing: resources, prompts, tools, chat, batch validation, protocol commands');

debugCommand.addCommand(resourceCommand);
debugCommand.addCommand(promptCommand);
debugCommand.addCommand(toolCommand);
debugCommand.addCommand(chatCommand);
debugCommand.addCommand(batchCommand);
debugCommand.addCommand(mcpRawCommand);
