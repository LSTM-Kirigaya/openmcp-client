import { Command } from 'commander';
import { SERVICE_COMMANDS } from '../lib/service-commands.js';
import { parseJsonData, readJsonFile, printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';

export const rpcCommand = new Command('rpc')
  .alias('call')
  .description('通过 Gateway WebSocket 调用任意 service 命令（与 VSCode / Web UI 同源路由）')
  .argument('[command]', '例如 tools/list、connect、setting/load')
  .option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY)
  .option('-d, --data <json>', '请求 JSON（会与 _id 合并后发送）')
  .option('-f, --file <path>', '从文件读取 JSON 作为请求体（与 -d 合并，file 优先覆盖同名字段）')
  .option('-t, --timeout <ms>', '超时毫秒', '300000')
  .option('--list', '列出已知的 service 命令名', false)
  .option('-q, --quiet', '仅输出 msg 字段（失败仍打印完整响应）', false)
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
