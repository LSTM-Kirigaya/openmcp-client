import { Command } from 'commander';
import { createMessageBridge } from '../lib/index.js';

export const authCommand = new Command('auth')
  .description('Authentication commands');

authCommand
  .command('login')
  .description('Login to OpenMCP')
  .requiredOption('-u, --username <username>', 'Username')
  .requiredOption('-p, --password <password>', 'Password')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .action(async (options) => {
    console.log(`🔐 Logging in as ${options.username}...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/login', {
      username: options.username,
      password: options.password
    });

    if (result.code === 200) {
      console.log(`✅ Login successful!`);
      console.log(`   Token: ${result.msg.token}`);
      // Save token to config file (future feature)
    } else {
      console.error(`❌ Login failed: ${result.msg}`);
    }

    await bridge.close();
  });

authCommand
  .command('logout')
  .description('Logout from OpenMCP')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .action(async (options) => {
    console.log(`🔐 Logging out...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/logout');

    if (result.code === 200) {
      console.log(`✅ Logged out successfully!`);
    } else {
      console.error(`❌ Logout failed: ${result.msg}`);
    }

    await bridge.close();
  });

authCommand
  .command('status')
  .description('Check login status')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .action(async (options) => {
    console.log(`🔍 Checking auth status...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/status');

    if (result.code === 200) {
      if (result.msg.loggedIn) {
        console.log(`✅ Logged in as: ${result.msg.username}`);
        console.log(`   Expires: ${result.msg.expiresAt}`);
      } else {
        console.log(`📭 Not logged in`);
      }
    } else {
      console.error(`❌ Failed to check status: ${result.msg}`);
    }

    await bridge.close();
  });
