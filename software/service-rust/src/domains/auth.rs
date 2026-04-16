use serde::Serialize;

#[derive(Serialize)]
pub struct AuthSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> AuthSummary {
    AuthSummary {
        endpoints: &["/auth/status", "/auth/login", "/auth/register", "/auth/logout", "/auth/me"],
    }
}
