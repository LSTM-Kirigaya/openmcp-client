use serde::Serialize;

#[derive(Serialize)]
pub struct LlmSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> LlmSummary {
    LlmSummary {
        endpoints: &["/llm/chat", "/llm/models", "/llm/stream"],
    }
}
