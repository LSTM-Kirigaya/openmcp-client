export const HELP_GATEWAY = `
Tip: the default WebSocket address is ws://localhost:8282. If gateway uses another port, pass -g ws://127.0.0.1:<port>.
`;

export const HELP_PROGRAM_AFTER = `
Common examples:
  openmcp gateway start
  openmcp setting llm provider list
  openmcp setting general list
  openmcp mcp server list
  openmcp mcp server add --file ./my-server.json
  openmcp mcp session connect --id <SERVER_ID>
  openmcp mcp session list
  openmcp debug tool list
  openmcp debug tool test-case list --connection-id <id>
  openmcp debug tool run
  openmcp debug batch run -f ./batch-body.json
  openmcp debug mcp ping
`;

export const HELP_WEB = `
Examples:
  openmcp webui run -p 8283 -g 8282
  openmcp webui start -p 8283 -g 8282
  openmcp webui restart -p 8283 -g 8282
  OPENMCP_WEB_DEV=1 openmcp webui run -p 8283 -g 8282
  openmcp webui status
  openmcp webui stop
`;

export const HELP_START = `
Example:
  openmcp start --gateway-port 8282 --port 8283
`;

export const HELP_SKILLS = `
Examples:
  openmcp skills list
  openmcp skills load --skill-name myskill
  openmcp skills read-file --skill-name myskill --file-path README.md
`;

export const HELP_GENERIC_CLIENT = `
Example:
  openmcp debug mcp <subcommand> [--client-id <UUID>] [-g ws://127.0.0.1:8282]
`;
