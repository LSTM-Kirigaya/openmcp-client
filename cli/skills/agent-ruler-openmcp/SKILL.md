---
name: agent-ruler-openmcp
description: Guidance for installing, upgrading, verifying, and using the npm package @agent-ruler/openmcp and its openmcp CLI. Use when a user asks how to install OpenMCP from npm, start or diagnose the Gateway, use OpenMCP CLI commands, configure skills through SKILL_PATH, troubleshoot global installs, or publish/test the CLI package.
---

# Agent Ruler OpenMCP

Use this skill to help users install and operate the `@agent-ruler/openmcp` npm package. Prefer npm commands and the `openmcp` binary in all user-facing examples.

## Package Facts

- npm package: `@agent-ruler/openmcp`
- CLI binary: `openmcp`
- Minimum Node.js: `>=18`
- Default Gateway WebSocket: `ws://localhost:8282`
- Default Gateway logs directory: `%USERPROFILE%\.openmcp\logs\gateway` on Windows, `~/.openmcp/logs/gateway` on Unix-like systems
- Common typo: `@open-ruler/openmcp` is not the package used by this repo; use `@agent-ruler/openmcp`

## Install Or Upgrade

For normal users, recommend a global npm install:

```bash
npm install -g @agent-ruler/openmcp
openmcp --version
openmcp --help
```

To upgrade an existing global install:

```bash
npm install -g @agent-ruler/openmcp@latest
openmcp --version
```

If a specific release is needed:

```bash
npm install -g @agent-ruler/openmcp@0.1.4
```

Avoid telling users to run `yarn openmcp ...`; global npm users should run `openmcp ...` directly.

## First Run Workflow

Start Gateway before running commands that call service controllers:

```bash
openmcp gateway start
openmcp gateway status
```

If startup fails or status is not running, ask for these diagnostics:

```bash
openmcp gateway logs -n 200
openmcp gateway logs-dir
openmcp gateway run -p 8282
```

Use `gateway run` when the user needs foreground stderr/stdout. Use `gateway logs` for background failures; it should include both `gateway.log` and `gateway-startup.log`.

If the Gateway uses a non-default port, pass `-g` to commands that talk to it:

```bash
openmcp mcp server list -g ws://127.0.0.1:9000
```

## Common Commands

Show help and versions:

```bash
openmcp --help
openmcp gateway --help
openmcp mcp --help
openmcp debug --help
```

Manage Gateway:

```bash
openmcp gateway start
openmcp gateway status
openmcp gateway logs -n 200
openmcp gateway stop
```

Add and connect an MCP server from a file:

```bash
openmcp mcp server add --file ./mcp-server.json
openmcp mcp server list
openmcp mcp session connect --id <serverId>
openmcp mcp session current
```

Call debug commands after a session is connected:

```bash
openmcp debug tool list
openmcp debug tool call --name echo --args "{\"message\":\"hi\"}"
openmcp debug mcp ping
```

Start Web UI:

```bash
openmcp start
```

or manage Web UI separately:

```bash
openmcp webui start
openmcp webui status
openmcp webui stop
```

## Skills In OpenMCP

OpenMCP reads local skills from the `SKILL_PATH` setting. `SKILL_PATH` may point to a single skill directory containing `SKILL.md` or to a parent directory containing multiple skill subdirectories.

Typical parent directory layout:

```text
skills/
  my-skill/
    SKILL.md
  another-skill/
    SKILL.md
```

After configuring `SKILL_PATH` and starting Gateway:

```bash
openmcp skills list
openmcp skills load --skill-name my-skill
openmcp skills read-file --skill-name my-skill --file-path SKILL.md
```

When troubleshooting `openmcp skills ...`, first verify Gateway is running because the skills commands call the Gateway-backed service.

## Troubleshooting

If `openmcp` is not recognized:

```bash
npm install -g @agent-ruler/openmcp
npm root -g
npm config get prefix
```

Tell the user to ensure the global npm executable directory is on `PATH`. On Windows this is often `%APPDATA%\npm`; on Unix-like systems it is usually `<npm-prefix>/bin`.

If `gateway start` says it may have failed:

1. Run `openmcp gateway logs -n 200`.
2. Run `openmcp gateway run -p 8282` to see foreground errors.
3. Check the installed version with `openmcp --version`.
4. Ask the user to paste the full output, including Node.js version and stack traces.

If a published package starts locally from source but fails after global install, suspect missing runtime dependencies or vendored build files. Verify by installing the packed artifact into a clean temporary project and importing vendored modules before publishing.

## Release Verification

Before publishing, prefer:

```bash
cd cli
npm pack
```

Install the generated `.tgz` in a clean temporary project and verify:

```bash
npm install <path-to-agent-ruler-openmcp.tgz>
npx openmcp --version
npx openmcp gateway --help
```

For a deeper check, run the published smoke test after the version has been published:

```bash
cd cli
npm run test:published
```
