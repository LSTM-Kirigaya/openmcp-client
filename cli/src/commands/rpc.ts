import { Command } from 'commander';
import { SERVICE_COMMANDS } from '../lib/service-commands.js';
import { parseJsonData, readJsonFile, printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';
import { HELP_RPC } from '../lib/help-text.js';

export const rpcCommand = new Command('rpc')
  .alias('call')
  .description(
    '通过 Gateway WebSocket 调用任意 service 命令（与 VSCode / Web UI 同源 routeMessage）。<command> 为后端注册名，请求体为 data。'
  )
  .argument('[command]', '后端命令名，如 connect、tools/list、setting/load（见 --list）')
  .option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY)
  .option('-d, --data <json>', '请求体 JSON 字符串（会与内部 _id 合并）')
  .option('-f, --file <path>', '从文件读 JSON 作为请求体（与 -d 合并，同名键以文件为准）')
  .option('-t, --timeout <ms>', '超时毫秒', '300000')
  .option('--list', '列出已知的 service 命令名', false)
  .option('-q, --quiet', '仅输出 msg 字段（失败仍打印完整响应）', false)
  .addHelpText('after', HELP_RPC)
  .action(async (command: string | undefined, options) => {
    if (options.list) {
      console.log('Service commands (see service/src/**/*.controller.ts):\n');
      for (const row of SERVICE_COMMANDS) {
        const hint = row.hint ? ` — ${row.hint}` : '';
        console.log(`  ${row.command}${hint}`);
      }
      return;
    }

    if (!command) {
      console.error('请提供 <command>，或使用 --list 查看命令列表。');
      process.exitCode = 1;
      return;
    }

    const timeoutMs = parseInt(String(options.timeout), 10);
    let body: Record<string, unknown> = {};
    if (options.data) {
      body = { ...body, ...parseJsonData(options.data) };
    }
    if (options.file) {
      body = { ...body, ...readJsonFile(options.file) };
    }

    await withGateway(options.gateway, async (bridge) => {
      const res = await bridge.commandRequest(command, body, timeoutMs);
      if (options.quiet && res.code === 200) {
        printJson(res.msg);
      } else {
        printJson(res);
      }
      if (res.code !== 200 && res.code !== -1) {
        process.exitCode = 1;
      }
    });
  });
