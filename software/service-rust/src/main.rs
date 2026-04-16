use openmcp_service_rust::app;

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8283")
        .await
        .expect("bind 127.0.0.1:8283 failed");
    axum::serve(listener, app()).await.expect("axum serve failed");
}
