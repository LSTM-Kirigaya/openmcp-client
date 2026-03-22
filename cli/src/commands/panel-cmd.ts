import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_PANEL } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function mergeBody(options: { data?: string; file?: string; clientId?: string }): Record<string, unknown> {
  let body: Record<string, unknown> = {};
  if (options.data) body = { ...body, ...parseJsonData(options.data) };
  if (options.file) body = { ...body, ...readJsonFile(options.file) };
  if (options.clientId) body.clientId = options.clientId;
  return body;
}

export const panelCmd = new Command('panel')
  .description('面板状态与按 MCP 服务端区分的本地 JSON 配置（PanelController）。')
  .addHelpText('after', HELP_PANEL);

const clientOpts = (cmd: Command) =>
  cmd
    .option('-c, --client-id <id>', 'MCP clientId')
    .option('-d, --data <json>', '额外 JSON')
    .option('-f, --file <path>', 'JSON 文件（与面板保存结构一致）');

clientOpts(
  gw(
    panelCmd
      .command('save')
      .description('保存面板状态（panel/save）')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('panel/save', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('load')
      .description('加载面板状态（panel/load）')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('panel/load', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('system-prompt-set')
      .description('设置单条系统提示词')
      .requiredOption('--name <name>', '名称')
      .requiredOption('--content <text>', '内容')
      .action(async (options) => {
        const body = mergeBody(options);
        body.name = options.name;
        body.content = options.content;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('system-prompts/set', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('system-prompt-delete')
      .description('删除系统提示词')
      .requiredOption('--name <name>', '名称')
      .action(async (options) => {
        const body = mergeBody(options);
        body.name = options.name;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('system-prompts/delete', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('system-prompts-save')
      .description('批量保存系统提示词（prompts 数组）')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('system-prompts/save', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

gw(
  panelCmd
    .command('system-prompts-load')
    .description('加载全部系统提示词')
    .option('-c, --client-id <id>', 'MCP clientId')
    .action(async (options) => {
      const body: Record<string, unknown> = {};
      if (options.clientId) body.clientId = options.clientId;
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('system-prompts/load', body);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

clientOpts(
  gw(
    panelCmd
      .command('variables-save')
      .description('保存变量')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('variables/save', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('variables-load')
      .description('加载变量')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('variables/load', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('extraction-rules-save')
      .description('保存抽取规则')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('extraction-rules/save', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('extraction-rules-load')
      .description('加载抽取规则')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('extraction-rules/load', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('test-cases-save')
      .description('保存测试用例')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('test-cases/save', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('test-cases-load')
      .description('加载测试用例')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('test-cases/load', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('batch-validation-load')
      .description('加载批量验证存储')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('batch-validation/load', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);

clientOpts(
  gw(
    panelCmd
      .command('batch-validation-save')
      .description('保存批量验证存储')
      .action(async (options) => {
        const body = mergeBody(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('batch-validation/save', body);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      })
  )
);
