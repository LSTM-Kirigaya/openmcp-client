use axum::body::Body;
use axum::http::{Request, StatusCode};
use openmcp_service_rust::app;
use tower::util::ServiceExt;

#[tokio::test]
async fn health_route_returns_200() {
    let response = app()
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn feature_inventory_route_returns_200() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/inventory/features")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
