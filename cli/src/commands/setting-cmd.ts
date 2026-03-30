import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_SETTING } from '../lib/help-text.js';

type GatewayResponse = {
  code: number;
  msg?: unknown;
};

type SettingBridge = {
  commandRequest(command: string, data: Record<string, unknown>): Promise<GatewayResponse>;
};

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function assertSettingObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('当前 settings 不是 JSON 对象');
  }
  return value as Record<string, unknown>;
}

async function loadCurrentSettings(bridge: SettingBridge) {
  const res = await bridge.commandRequest('setting/load', {});
  if (res.code !== 200) {
    return { res };
  }
  return {
    res,
    settings: assertSettingObject(res.msg)
  };
}

function parseSettingValue(options: { value?: string; json?: string }): unknown {
  if (options.value !== undefined && options.json !== undefined) {
    throw new Error('--value 与 --json 只能二选一');
  }
  if (options.json !== undefined) {
    try {
      return JSON.parse(options.json);
    } catch {
      throw new Error('Invalid JSON for --json');
    }
  }
  if (options.value === undefined) {
    throw new Error('请通过 --value 或 --json 提供要写入的值');
  }
  try {
    return JSON.parse(options.value);
  } catch {
    return options.value;
  }
}

export const settingCmd = new Command('setting')
  .description('读写全局应用设置（SettingController）。')
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
    .command('list')
    .description('查看当前全部设置（等价于 load）')
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
    .command('set')
    .description('单项修改设置（顶层字段）')
    .requiredOption('--key <name>', '设置键名，例如 MCP_TIMEOUT_SEC')
    .option('--value <value>', '值；优先按 JSON 字面量解析，失败则按字符串处理')
    .option('--json <json>', '显式 JSON 值，适合对象、数组、字符串、数字、布尔和 null')
    .action(async (options) => {
      const nextValue = parseSettingValue(options);
      await withGateway(options.gateway, async (bridge) => {
        const { res: loadRes, settings } = await loadCurrentSettings(bridge);
        if (!settings) {
          printJson(loadRes);
          process.exitCode = 1;
          return;
        }
        const previousValue = settings[options.key];
        const saveRes = await bridge.commandRequest('setting/save', {
          ...settings,
          [options.key]: nextValue
        });
        if (saveRes.code !== 200) {
          printJson(saveRes);
          process.exitCode = 1;
          return;
        }
        printJson({
          code: 200,
          msg: 'Setting updated successfully',
          data: {
            key: options.key,
            previousValue,
            value: nextValue
          }
        });
      });
    })
);
