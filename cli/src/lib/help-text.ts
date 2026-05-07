export const HELP_GATEWAY = `
Tip: the default WebSocket address is ws://localhost:8282. If gateway uses another port, pass -g ws://127.0.0.1:<port>.
`;

export const HELP_PROGRAM_AFTER = `
Common examples:
  openmcp-cli gateway start
  openmcp-cli setting llm provider list
  openmcp-cli setting general list
  openmcp-cli mcp server list
  openmcp-cli mcp server add --file ./my-server.json
  openmcp-cli mcp session connect --id <SERVER_ID>
  openmcp-cli mcp session list
  openmcp-cli debug tool list
  openmcp-cli debug tool test-case list --connection-id <id>
  openmcp-cli debug tool run
  openmcp-cli debug batch run -f ./batch-body.json
  openmcp-cli debug mcp ping
`;

export const HELP_WEB = `
Examples:
  openmcp-cli webui run -p 8283 -g 8282
  openmcp-cli webui start -p 8283 -g 8282
  openmcp-cli webui restart -p 8283 -g 8282
  OPENMCP_WEB_DEV=1 openmcp-cli webui run -p 8283 -g 8282
  openmcp-cli webui status
  openmcp-cli webui stop
`;

export const HELP_START = `
Example:
  openmcp-cli start --gateway-port 8282 --port 8283
`;

export const HELP_SKILLS = `
Examples:
  openmcp-cli skills list
  openmcp-cli skills load --skill-name myskill
  openmcp-cli skills read-file --skill-name myskill --file-path README.md
`;

export const HELP_GENERIC_CLIENT = `
Example:
  openmcp-cli debug mcp <subcommand> [--client-id <UUID>] [-g ws://127.0.0.1:8282]
`;
