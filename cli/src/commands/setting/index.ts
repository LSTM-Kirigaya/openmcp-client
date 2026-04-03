import { Command } from 'commander';
import { generalCommand } from './general.js';
import { llmCommand } from './llm.js';
import { cloudCommand } from './cloud.js';

export const settingCommand = new Command('setting')
  .description('设置管理：大模型 API、通用配置、云端账号与项目');

settingCommand.addCommand(llmCommand);
settingCommand.addCommand(generalCommand);
settingCommand.addCommand(cloudCommand);
