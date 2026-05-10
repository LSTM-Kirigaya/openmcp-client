import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';
import { HELP_SKILLS } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const skillsCmd = new Command('skills')
  .description('Built-in skill package list and file reading (SkillController).')
  .addHelpText('after', HELP_SKILLS);

gw(
  skillsCmd
    .command('list')
    .description('List skills')
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
    .description('Load skill content')
    .option('--skill-name <name>', 'Skill name')
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
    .description('Read file inside skill package')
    .requiredOption('--skill-name <name>', 'Skill name')
    .requiredOption('--file-path <path>', 'Relative path inside package')
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
