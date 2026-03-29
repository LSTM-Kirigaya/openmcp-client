import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const specCasesCmd = new Command('spec-cases')
  .description('Spec Case（projects/:id/spec-cases）云端能力');

gw(
  specCasesCmd
    .command('create')
    .description('创建 Spec Case（spec-cases/create）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--node-type <node_type>', 'node_type（folder|case）')
    .requiredOption('--type <type>', 'type（tool|prompt）')
    .requiredOption('--name <name>', '名称')
    .option('--parent-id <id>', '父节点ID（可选）')
    .option('--input <text>', 'input（可选）')
    .option('--output <text>', 'output（可选）')
    .option('--description <text>', '描述（可选）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('spec-cases/create', {
          projectId: options.projectId,
          nodeType: options.nodeType,
          type: options.type,
          name: options.name,
          parentId: options.parentId,
          input: options.input,
          output: options.output,
          description: options.description
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  specCasesCmd
    .command('tree')
    .description('获取 Spec Case 树（spec-cases/tree）')
    .requiredOption('--project-id <id>', '项目ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('spec-cases/tree', { projectId: options.projectId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  specCasesCmd
    .command('get')
    .description('获取单个 Spec 节点（spec-cases/get）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--case-id <id>', 'Spec Case ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('spec-cases/get', { projectId: options.projectId, caseId: options.caseId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  specCasesCmd
    .command('update')
    .description('更新 Spec 节点（spec-cases/update）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--case-id <id>', 'Spec Case ID')
    .requiredOption('--node-type <node_type>', 'node_type（folder|case）')
    .requiredOption('--type <type>', 'type（tool|prompt）')
    .requiredOption('--name <name>', '名称')
    .option('--parent-id <id>', '父节点ID（可选）')
    .option('--input <text>', 'input（可选）')
    .option('--output <text>', 'output（可选）')
    .option('--description <text>', '描述（可选；不传则保持原值）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('spec-cases/update', {
          projectId: options.projectId,
          caseId: options.caseId,
          nodeType: options.nodeType,
          type: options.type,
          name: options.name,
          parentId: options.parentId,
          input: options.input,
          output: options.output,
          description: options.description
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  specCasesCmd
    .command('delete')
    .description('删除 Spec 节点（spec-cases/delete）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--case-id <id>', 'Spec Case ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('spec-cases/delete', { projectId: options.projectId, caseId: options.caseId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

