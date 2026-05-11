#!/usr/bin/env node
/**
 * Build script for OpenMCP CLI
 * This script builds the CLI package and prepares it for publishing
 */

import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const cliDir = join(rootDir, 'cli');

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
}

function log(message: string) {
  console.log(`[build-cli] ${message}`);
}

function error(message: string) {
  console.error(`[build-cli] ❌ ${message}`);
  process.exit(1);
}

async function main() {
  log('Building OpenMCP CLI...\n');

  // Step 1: Check if CLI directory exists
  try {
    await fs.access(cliDir);
  } catch {
    error(`CLI directory not found: ${cliDir}`);
  }

  // Step 2: Install workspace dependencies
  log('Step 1/4: Installing workspace dependencies...');
  try {
    execSync('yarn install --immutable', {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } catch (err) {
    error('Failed to install workspace dependencies');
  }

  // Step 3: Build CLI TypeScript
  log('\nStep 2/4: Building CLI TypeScript...');
  try {
    execSync('yarn workspace @agent-ruler/openmcp build', {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } catch (err) {
    error('Failed to build CLI TypeScript');
  }

  // Step 4: Make entry script executable
  log('\nStep 3/4: Setting up executable permissions...');
  try {
    const binPath = join(cliDir, 'bin', 'openmcp.js');
    await fs.chmod(binPath, 0o755);
    log('  ✓ Made bin/openmcp.js executable');
  } catch (err) {
    log('  ⚠ Warning: Could not set executable permissions');
  }

  // Step 5: Verify build
  log('\nStep 4/4: Verifying build...');
  try {
    const distPath = join(cliDir, 'dist', 'index.js');
    await fs.access(distPath);
    log('  ✓ Build output verified');
  } catch {
    error('Build output not found. Build may have failed.');
  }

  // Step 6: Create a test link (optional)
  log('\nOptional: Testing CLI locally...');
  try {
    const version = execSync('node bin/openmcp.js --version', {
      cwd: cliDir,
      encoding: 'utf-8'
    }).trim();
    log(`  ✓ CLI version: ${version}`);
  } catch (err) {
    log('  ⚠ Warning: Could not test CLI version');
  }

  // Summary
  log('\n' + '='.repeat(50));
  log('Build completed successfully!');
  log('='.repeat(50));
  log('\nTo test the CLI locally:');
  log(`  cd ${cliDir}`);
  log('  npm link');
  log('  omc --help');
  log('\nTo publish to npm:');
  log(`  cd ${cliDir}`);
  log('  npm publish');
  log('\nTo use in the main project:');
  log('  npm run publish:cli');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
