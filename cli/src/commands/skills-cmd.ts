import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';
import { HELP_SKILLS } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const skillsCmd = new Command('skills')
  .description('内置技能包列表与文件读取（SkillController）。')
  .addHelpText('after', HELP_SKILLS);

gw(
  skillsCmd
    .command('list')
    .description('列出技能')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('skills/list', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  skillsCmd
    .command('load')
    .description('加载技能内容')
    .option('--skill-name <name>', '技能名')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('skills/load', {
          skillName: options.skillName
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  skillsCmd
    .command('read-file')
    .description('读取技能包内文件')
    .requiredOption('--skill-name <name>', '技能名')
    .requiredOption('--file-path <path>', '包内相对路径')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('skills/read-file', {
          skill_name: options.skillName,
          file_path: options.filePath
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
