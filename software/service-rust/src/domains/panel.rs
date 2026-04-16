use serde::Serialize;

#[derive(Serialize)]
pub struct PanelSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> PanelSummary {
    PanelSummary {
        endpoints: &["/panel/state/get", "/panel/state/save", "/panel/batch-validation/list"],
    }
}
