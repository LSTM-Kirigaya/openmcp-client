import { Command } from 'commander';
import { MessageBridge, createMessageBridge } from '../lib/index.js';

export const projectCommand = new Command('project')
  .description('Manage OpenMCP projects');

projectCommand
  .command('create <name>')
  .description('Create a new project')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .action(async (name, options) => {
    console.log(`📁 Creating project: ${name}...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('project/create', { name });

    if (result.code === 200) {
      console.log(`✅ Project created successfully!`);
      console.log(`   Project ID: ${result.msg.projectId}`);
    } else {
      console.error(`❌ Failed to create project: ${result.msg}`);
    }

    await bridge.close();
  });

projectCommand
  .command('list')
  .description('List all projects')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .action(async (options) => {
    console.log('📋 Fetching projects...');

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('project/list');

    if (result.code === 200) {
      const projects = result.msg.projects || [];
      if (projects.length === 0) {
        console.log('📭 No projects found');
      } else {
        console.log(`\n📁 Found ${projects.length} project(s):\n`);
        projects.forEach((p: any, i: number) => {
          console.log(`  ${i + 1}. ${p.name} (${p.id})`);
        });
      }
    } else {
      console.error(`❌ Failed to fetch projects: ${result.msg}`);
    }

    await bridge.close();
  });

projectCommand
  .command('delete <name>')
  .description('Delete a project')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (name, options) => {
    if (!options.yes) {
      console.log(`⚠️  Are you sure you want to delete project "${name}"?`);
      console.log('   Use -y to skip this confirmation');
      return;
    }

    console.log(`🗑️  Deleting project: ${name}...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('project/delete', { name });

    if (result.code === 200) {
      console.log(`✅ Project deleted successfully!`);
    } else {
      console.error(`❌ Failed to delete project: ${result.msg}`);
    }

    await bridge.close();
  });

projectCommand
  .command('info <name>')
  .description('Show project details')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:8282')
  .action(async (name, options) => {
    console.log(`🔍 Fetching project info: ${name}...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('project/info', { name });

    if (result.code === 200) {
      console.log(`\n📁 Project: ${result.msg.name}`);
      console.log(`   ID: ${result.msg.id}`);
      console.log(`   Created: ${result.msg.createdAt}`);
      console.log(`   Status: ${result.msg.status}`);
    } else {
      console.error(`❌ Failed to fetch project info: ${result.msg}`);
    }

    await bridge.close();
  });
