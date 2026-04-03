import { Command } from 'commander';
import { mcpServerCommand } from './server.js';
import { mcpSessionCommand } from './session.js';
import { mcpMemberCommand } from './member.js';
import { mcpInviteCommand } from './invite.js';

export const mcpCommand = new Command('mcp')
  .description('MCP Server 与会话管理')
  .addHelpText('after', `
概念说明:
  server   已保存的 MCP Server 配置（持久化在 ~/.openmcp/servers/，增删改查）
  session  运行时的 MCP 会话（连接、断开、切换活跃会话）

快速上手:
  openmcp-cli mcp server list                    查看已保存的 Server（本地 + 云端）
  openmcp-cli mcp server add -f config.json      添加一个本地 Server 配置
  openmcp-cli mcp session connect --id <ID>      连接指定 Server
  openmcp-cli mcp session list                   查看当前活跃会话
  openmcp-cli mcp session disconnect             断开当前会话
`);

mcpServerCommand.addCommand(mcpMemberCommand);
mcpServerCommand.addCommand(mcpInviteCommand);
mcpCommand.addCommand(mcpServerCommand);
mcpCommand.addCommand(mcpSessionCommand);
