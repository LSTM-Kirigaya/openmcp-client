import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const feedbackCmd = new Command('feedback').description('反馈 / Reflux（对应 RefluxController）');

gw(
  feedbackCmd
    .command('save')
    .description('保存 reflux 数据')
    .requiredOption('--name <name>', '存储名')
    .option('-f, --file <path>', 'storage JSON 文件')
    .option('-d, --data <json>', 'storage 内联 JSON')
    .action(async (options) => {
      let storage: unknown = {};
      if (options.data) storage = parseJsonData(options.data);
      if (options.file) storage = readJsonFile(options.file);
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('feedback/reflux', {
          name: options.name,
          storage
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  feedbackCmd
    .command('count')
    .description('获取条数')
    .requiredOption('--name <name>', '存储名')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('feedback/reflux/get-count', { name: options.name });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  feedbackCmd
    .command('list-data')
    .description('分页查询数据')
    .requiredOption('--name <name>', '存储名')
    .option('--page <n>', '页码', '1')
    .option('--page-size <n>', '每页条数', '20')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('feedback/reflux/get-data', {
          name: options.name,
          page: parseInt(options.page, 10),
          pageSize: parseInt(options.pageSize, 10)
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  feedbackCmd
    .command('find-trace')
    .description('按 hash 查 trace')
    .requiredOption('--name <name>', '存储名')
    .requiredOption('--hash <hash>', 'hash')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('feedback/reflux/findTraceByHash', {
          name: options.name,
          hash: options.hash
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  feedbackCmd
    .command('find-tools')
    .description('按 hash 查启用工具')
    .requiredOption('--name <name>', '存储名')
    .requiredOption('--hash <hash>', 'hash')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('feedback/reflux/findEnableToolsByHash', {
          name: options.name,
          hash: options.hash
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
