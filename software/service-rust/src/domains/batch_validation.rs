use serde::Serialize;

#[derive(Serialize)]
pub struct BatchValidationSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> BatchValidationSummary {
    BatchValidationSummary {
        endpoints: &["/batch-validation/create", "/batch-validation/run", "/batch-validation/result"],
    }
}
