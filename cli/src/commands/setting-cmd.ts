import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_SETTING } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const settingCmd = new Command('setting')
  .description('读写全局应用设置与引导状态（SettingController）。')
  .addHelpText('after', HELP_SETTING);

gw(
  settingCmd
    .command('load')
    .description('加载设置')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/load', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  settingCmd
    .command('save')
    .description('保存设置（整包对象）')
    .option('-f, --file <path>', 'JSON 文件')
    .option('-d, --data <json>', '内联 JSON')
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonFile(options.file) };
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/save', body);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  settingCmd
    .command('set-tour')
    .description('设置引导状态')
    .requiredOption('--user-has-read-guide <bool>', 'true 或 false')
    .action(async (options) => {
      const read = String(options.userHasReadGuide).toLowerCase() === 'true';
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/set-tour', {
          userHasReadGuide: read
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  settingCmd
    .command('get-tour')
    .description('获取引导状态')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/get-tour', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
