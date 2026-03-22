import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_DEBUGGER } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const debuggerCmd = new Command('debugger-mcp')
  .description('OpenMCP 调试器 MCP 子进程配置（DebuggerMcpController）。')
  .addHelpText('after', HELP_DEBUGGER);

gw(
  debuggerCmd
    .command('load')
    .description('加载配置')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('debugger-mcp/load', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  debuggerCmd
    .command('save')
    .description('保存并应用配置')
    .option('-f, --file <path>', 'JSON：enabled, port, enabledTools')
    .option('-d, --data <json>', '内联 JSON')
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonFile(options.file) };
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('debugger-mcp/save', body, 120000);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  debuggerCmd
    .command('connection-info')
    .description('当前连接信息')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('debugger-mcp/connection-info', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  debuggerCmd
    .command('toggle-tool')
    .description('启用/禁用单个工具')
    .requiredOption('--tool-name <name>', '工具名')
    .requiredOption('--enabled <bool>', 'true 或 false')
    .action(async (options) => {
      const enabled = String(options.enabled).toLowerCase() === 'true';
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('debugger-mcp/toggle-tool', {
          toolName: options.toolName,
          enabled
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
