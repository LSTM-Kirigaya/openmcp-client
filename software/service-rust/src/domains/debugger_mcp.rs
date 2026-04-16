use serde::Serialize;

#[derive(Serialize)]
pub struct DebuggerMcpSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> DebuggerMcpSummary {
    DebuggerMcpSummary {
        endpoints: &[
            "/debugger-mcp/start",
            "/debugger-mcp/stop",
            "/debugger-mcp/storage/get",
            "/debugger-mcp/storage/set",
        ],
    }
}
