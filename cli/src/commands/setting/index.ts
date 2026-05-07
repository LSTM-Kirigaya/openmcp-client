import { Command } from 'commander';
import { generalCommand } from './general.js';
import { llmCommand } from './llm.js';

export const settingCommand = new Command('setting')
  .description('Settings: LLM API and general configuration');

settingCommand.addCommand(llmCommand);
settingCommand.addCommand(generalCommand);
