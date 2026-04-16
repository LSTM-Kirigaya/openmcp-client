use serde::Serialize;

#[derive(Serialize)]
pub struct SettingSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> SettingSummary {
    SettingSummary {
        endpoints: &["/setting/get", "/setting/set", "/setting/reset"],
    }
}
