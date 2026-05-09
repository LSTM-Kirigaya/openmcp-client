import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  settingCommand,
  debugCommand,
  mcpCommand,
  gatewayCommand,
  webCommand,
  startCommand,
  skillsCmd
} from './commands/index.js';
import { HELP_PROGRAM_AFTER } from './lib/help-text.js';
import { diagnoseThrownError } from './lib/error-diagnose.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

function enableHelpAfterErrors(command: Command): void {
  command.showHelpAfterError();
  command.showSuggestionAfterError();
  for (const child of command.commands) {
    enableHelpAfterErrors(child);
  }
}

program
  .name('openmcp')
  .description('OpenMCP CLI — Gateway 管理与 MCP 全量能力')
  .version(readPackageVersion())
  .addHelpText('after', HELP_PROGRAM_AFTER)
  .addCommand(settingCommand)
  .addCommand(mcpCommand)
  .addCommand(debugCommand)
  .addCommand(gatewayCommand)
  .addCommand(webCommand)
  .addCommand(startCommand)
  .addCommand(skillsCmd);

enableHelpAfterErrors(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}
