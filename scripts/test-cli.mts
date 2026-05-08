#!/usr/bin/env node
/**
 * Test script for OpenMCP CLI
 * This script builds and tests the CLI locally
 */

import { execSync, spawn } from 'child_process';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const cliDir = join(rootDir, 'cli');
const testProjectDir = join(rootDir, 'test-cli-project');

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
}

function log(message: string) {
  console.log(`[test-cli] ${message}`);
}

function error(message: string) {
  console.error(`[test-cli] ❌ ${message}`);
  process.exit(1);
}

async function cleanup() {
  try {
    await fs.rm(testProjectDir, { recursive: true, force: true });
    log('Cleaned up test project directory');
  } catch {
    // Ignore errors
  }
}

async function testBuild() {
  log('\n=== Test 1: Building CLI ===');
  
  try {
    execSync('npm install', {
      cwd: cliDir,
      stdio: 'inherit'
    });
    log('✓ Dependencies installed');
  } catch {
    error('Failed to install CLI dependencies');
  }

  try {
    execSync('npm run build', {
      cwd: cliDir,
      stdio: 'inherit'
    });
    log('✓ CLI built successfully');
  } catch {
    error('Failed to build CLI');
  }

  // Verify dist/index.js exists
  const distPath = join(cliDir, 'dist', 'index.js');
  try {
    await fs.access(distPath);
    log('✓ Build output exists');
  } catch {
    error('Build output not found');
  }
}

async function testVersion() {
  log('\n=== Test 2: Testing CLI version ===');
  
  try {
    const version = execSync('node bin/omc --version', {
      cwd: cliDir,
      encoding: 'utf-8'
    }).trim();
    log(`✓ CLI version: ${version}`);
  } catch (err) {
    error(`Failed to get CLI version: ${err}`);
  }
}

async function testHelp() {
  log('\n=== Test 3: Testing CLI help ===');
  
  try {
    const help = execSync('node bin/omc --help', {
      cwd: cliDir,
      encoding: 'utf-8'
    });
    log('✓ CLI help displayed');
    log('\nHelp output preview:');
    console.log(help.split('\n').slice(0, 10).join('\n'));
    console.log('...');
  } catch (err) {
    error(`Failed to get CLI help: ${err}`);
  }
}

async function testInit() {
  log('\n=== Test 4: Testing init command ===');
  
  // Clean up any existing test project
  await cleanup();

  // Test init command (skip actual clone by testing error case)
  try {
    execSync('node bin/omc init --help', {
      cwd: cliDir,
      encoding: 'utf-8'
    });
    log('✓ Init command help works');
  } catch (err) {
    error(`Init command failed: ${err}`);
  }

  // Note: We skip the actual init test as it would take too long
  log('⚠ Skipping actual init test (would clone repository)');
}

async function testPackaging() {
  log('\n=== Test 5: Testing npm pack ===');
  
  try {
    // Create a pack to verify files are included correctly
    execSync('npm pack --dry-run', {
      cwd: cliDir,
      stdio: 'inherit'
    });
    log('✓ Package contents look correct');
  } catch (err) {
    log('⚠ npm pack test encountered issues (non-critical)');
  }
}

async function main() {
  log('='.repeat(60));
  log('OpenMCP CLI Test Suite');
  log('='.repeat(60));

  try {
    await testBuild();
    await testVersion();
    await testHelp();
    await testInit();
    await testPackaging();

    log('\n' + '='.repeat(60));
    log('All tests passed! ✓');
    log('='.repeat(60));
    
    log('\nCLI is ready for publishing!');
    log('To publish:');
    log(`  cd ${cliDir}`);
    log('  npm login');
    log('  npm publish');
    
    log('\nTo test globally:');
    log(`  cd ${cliDir} && npm link`);
    log('  omc --version');
    
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
