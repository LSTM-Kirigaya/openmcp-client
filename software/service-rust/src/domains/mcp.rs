use serde::Serialize;

#[derive(Serialize)]
pub struct McpSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> McpSummary {
    McpSummary {
        endpoints: &[
            "/mcp/connect",
            "/mcp/disconnect",
            "/mcp/client/call",
            "/mcp/ocr/run",
            "/mcp/auth/config",
        ],
    }
}
