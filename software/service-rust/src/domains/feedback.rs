use serde::Serialize;

#[derive(Serialize)]
pub struct FeedbackSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> FeedbackSummary {
    FeedbackSummary {
        endpoints: &["/feedback/reflux/save", "/feedback/reflux/query"],
    }
}
