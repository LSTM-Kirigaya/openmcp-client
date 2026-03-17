export interface IConfig {
    MODEL_INDEX: number;
    LLM_INFO: any;
    LANG: string;
    MCP_TIMEOUT_SEC: number;
    PROXY_SERVER: string;
    /** Path to SKILL.md file or skill directory (e.g. .cursor/skills/code-review) */
    SKILL_PATH?: string;
    [key: string]: any;
}