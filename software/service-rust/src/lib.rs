pub mod domains;

use axum::{routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
}

#[derive(Serialize)]
pub struct FeatureInventory {
    pub auth: domains::auth::AuthSummary,
    pub mcp: domains::mcp::McpSummary,
    pub cloud_backup: domains::cloud_backup::CloudBackupSummary,
    pub setting: domains::setting::SettingSummary,
    pub llm: domains::llm::LlmSummary,
    pub feedback: domains::feedback::FeedbackSummary,
    pub panel: domains::panel::PanelSummary,
    pub batch_validation: domains::batch_validation::BatchValidationSummary,
    pub debugger_mcp: domains::debugger_mcp::DebuggerMcpSummary,
}

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/inventory/features", get(feature_inventory))
}

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "openmcp-service-rust",
    })
}

pub async fn feature_inventory() -> Json<FeatureInventory> {
    Json(FeatureInventory {
        auth: domains::auth::summary(),
        mcp: domains::mcp::summary(),
        cloud_backup: domains::cloud_backup::summary(),
        setting: domains::setting::summary(),
        llm: domains::llm::summary(),
        feedback: domains::feedback::summary(),
        panel: domains::panel::summary(),
        batch_validation: domains::batch_validation::summary(),
        debugger_mcp: domains::debugger_mcp::summary(),
    })
}
