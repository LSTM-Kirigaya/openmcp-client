import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_BATCH_VALIDATION } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const batchValidationCmd = new Command('batch-validation')
  .description('批量用例验证（BatchValidationController），一般由 Web 面板或 -f JSON 驱动。')
  .addHelpText('after', HELP_BATCH_VALIDATION);

gw(
  batchValidationCmd
    .command('run')
    .description('执行批量验证（batch-validation/run，请求体大时务必用 -f）')
    .option('-f, --file <path>', '完整请求 JSON：messages、testCases、llmConfig 等')
    .option('-d, --data <json>', '内联 JSON（较少用）')
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
