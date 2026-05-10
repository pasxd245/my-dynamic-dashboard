from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.api import ApiError
from app.api.dashboards import router as dashboards_router
from app.api.deployment import router as deployment_router
from app.api.queries import router as queries_router
from app.api.relationships import router as relationships_router
from app.api.saved_queries import router as saved_queries_router
from app.api.upload import (
    BUILDER_SMOKE_SERVICE,
    PREFLIGHT_SERVICE,
)
from app.api.upload import (
    router as upload_router,
)
from app.api.workspaces import BUILDER_SESSION_SERVICE
from app.api.workspaces import router as workspaces_router
from app.core.logging import configure_backend_logging, correlation_id_ctx
from app.core.metadata_migrations import run_startup_migrations
from app.core.startup_validation import StartupValidationError, validate_startup_environment
from app.schemas import ApiErrorModel, ErrorResponse
from app.services.actionable_error_service import (
    build_actionable_error_from_api_error,
    with_correlation_details,
)
from app.services.dashboard_service import DashboardService  # noqa: F401  (re-exported for test monkeypatching)
from app.services.panel_executor_service import (
    PanelExecutorService,  # noqa: F401  (re-exported for test monkeypatching)
)
from app.shared import APP_LOGGER, DB_PATH, PARQUET_ROOT  # noqa: F401  (re-exported for test monkeypatching)


def _startup_event() -> None:
    try:
        env = validate_startup_environment()
        APP_LOGGER.setLevel(env.backend_log_level)
        APP_LOGGER.info(
            "backend startup validation completed",
            extra={"event_type": "startup_validation", "service": "backend"},
        )
        run_startup_migrations(DB_PATH, logger=APP_LOGGER)
    except StartupValidationError as exc:
        APP_LOGGER.error(
            "backend startup validation failed",
            extra={"event_type": "startup_validation", "service": "backend", "details": "; ".join(exc.errors)},
        )
        raise


async def _attach_correlation_id(request: Request, call_next):
    incoming = request.headers.get("x-correlation-id")
    correlation_id = incoming.strip() if incoming else str(uuid.uuid4())
    token = correlation_id_ctx.set(correlation_id)
    try:
        response = await call_next(request)
    finally:
        correlation_id_ctx.reset(token)
    response.headers["x-correlation-id"] = correlation_id
    return response


def _handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    details = with_correlation_details(exc.details)
    actionable = build_actionable_error_from_api_error(
        path=request.url.path,
        error_code=exc.code,
        user_message=exc.message,
        technical_details=details,
    )
    if actionable is not None:
        return JSONResponse(status_code=exc.status_code, content=actionable.model_dump())

    payload = ErrorResponse(error=ApiErrorModel(code=exc.code, message=exc.message, details=details))
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


def _handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
    message = str(exc.detail)
    details = with_correlation_details()
    actionable = build_actionable_error_from_api_error(
        path=request.url.path,
        error_code="http_error",
        user_message=message,
        technical_details=details,
    )
    if actionable is not None:
        return JSONResponse(status_code=exc.status_code, content=actionable.model_dump())

    payload = ErrorResponse(
        error=ApiErrorModel(
            code="http_error",
            message=message,
            details=details,
        )
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    configure_backend_logging()
    _app = FastAPI(title="My Dynamic Dashboard Backend")
    _app.add_event_handler("startup", _startup_event)
    _app.middleware("http")(_attach_correlation_id)
    _app.add_exception_handler(ApiError, _handle_api_error)
    _app.add_exception_handler(HTTPException, _handle_http_error)
    _app.include_router(deployment_router)
    _app.include_router(workspaces_router)
    _app.include_router(upload_router)
    _app.include_router(relationships_router)
    _app.include_router(queries_router)
    _app.include_router(saved_queries_router)
    _app.include_router(dashboards_router)
    return _app


app = create_app()
