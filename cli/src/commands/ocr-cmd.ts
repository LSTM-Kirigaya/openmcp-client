import { Command } from 'commander';
import fs from 'fs';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_OCR } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const ocrCmd = new Command('ocr')
  .description('内置 OCR 图片读写（OcrController）。')
  .addHelpText('after', HELP_OCR);

gw(
  ocrCmd
    .command('get-image')
    .description('按文件名读取已存图片（base64）')
    .requiredOption('--filename <name>', '磁盘存储文件名')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('ocr/get-ocr-image', { filename: options.filename });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  ocrCmd
    .command('start')
    .description('提交 base64 图片开始 OCR')
    .option('-f, --file <path>', '包含 base64String、mimeType 的 JSON 文件')
    .option('-d, --data <json>', '内联 JSON')
    .option('--image-file <path>', '从图片文件读取并转为 base64（需配合 --mime-type）')
    .option('--mime-type <mime>', '如 image/png')
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonFile(options.file) };
      if (options.imageFile) {
        const buf = fs.readFileSync(options.imageFile);
        body.base64String = buf.toString('base64');
        if (!options.mimeType) {
          console.error('使用 --image-file 时请提供 --mime-type');
          process.exitCode = 1;
          return;
        }
        body.mimeType = options.mimeType;
      }
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('ocr/start-ocr', body, 300000);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
