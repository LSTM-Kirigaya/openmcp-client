
/**
 * source: https://gist.github.com/Laci21/9dd074f3a5a461ab04adb7db678534d3
 * issue: https://github.com/modelcontextprotocol/typescript-sdk/issues/217
 * 
 * This script fixes the MCP SDK issue with pkce-challenge ES Module
 * It replaces the static require with a dynamic import in the auth.js file
 */

const fs = require('fs');
const path = require('path');

// Path to the file that needs patching
const authFilePath = path.resolve(
  __dirname, 
  'node_modules', 
  '@modelcontextprotocol', 
  'sdk', 
  'dist', 
  'cjs', 
  'client', 
  'auth.js'
);

console.log('Checking if MCP SDK patch is needed...');

// Check if the file exists
if (!fs.existsSync(authFilePath)) {
  console.error(`Error: File not found at ${authFilePath}`);
  console.log('Make sure you have installed @modelcontextprotocol/sdk package');
  process.exit(1);
}

// Read the file content
const fileContent = fs.readFileSync(authFilePath, 'utf8');

// Check if the file already contains our patch
if (fileContent.includes('loadPkceChallenge')) {
  console.log('MCP SDK is already patched!');
  process.exit(0);
}

// Check if the file contains the problematic require
if (!fileContent.includes("require(\"pkce-challenge\")")) {
  console.log('The MCP SDK file does not contain the expected require statement.');
  console.log('This patch may not be needed or the SDK has been updated.');
  process.exit(0);
}

console.log('Applying patch to MCP SDK...');

// The code to replace the problematic require
const requireLine = "const pkce_challenge_1 = __importDefault(require(\"pkce-challenge\"));";
const replacementCode = `let pkce_challenge_1 = { default: null };
async function loadPkceChallenge() {
  if (!pkce_challenge_1.default) {
    const mod = await import("pkce-challenge");
    pkce_challenge_1.default = mod.default;
  }
}`;

// Replace the require line
let patchedContent = fileContent.replace(requireLine, replacementCode);

// Replace the function call to add the loading step
const challengeCall = "const challenge = await (0, pkce_challenge_1.default)();";
const replacementCall = "await loadPkceChallenge();\n    const challenge = await pkce_challenge_1.default();";
patchedContent = patchedContent.replace(challengeCall, replacementCall);

// Write the patched content back to the file
fs.writeFileSync(authFilePath, patchedContent, 'utf8');

console.log('✅ MCP SDK patched successfully!');
console.log('The patch changes:');
console.log('1. Replaced static require with dynamic import for pkce-challenge');
console.log('2. Added async loading function to handle the import');
console.log('\nYou should now be able to run the application without ESM errors.'); 