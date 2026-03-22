import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const batchValidationCmd = new Command('batch-validation').description('批量验证（对应 BatchValidationController）');

gw(
  batchValidationCmd
    .command('run')
    .description('执行批量验证（请求体较大，建议用 -f）')
    .option('-f, --file <path>', '完整请求 JSON')
    .option('-d, --data <json>', '内联 JSON')
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonFile(options.file) };
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('batch-validation/run', body, 600000);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
