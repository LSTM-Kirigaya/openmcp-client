use serde::Serialize;

#[derive(Serialize)]
pub struct CloudBackupSummary {
    pub endpoints: &'static [&'static str],
}

pub fn summary() -> CloudBackupSummary {
    CloudBackupSummary {
        endpoints: &[
            "/cloud-backup/status",
            "/cloud-backup/create",
            "/cloud-backup/list",
            "/cloud-backup/restore",
            "/cloud-backup/delete",
            "/cloud-backup/detail",
        ],
    }
}
