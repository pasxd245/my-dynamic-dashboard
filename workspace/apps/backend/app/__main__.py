import uvicorn

from app._config import CONFIG


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=CONFIG.settings.backend.host,
        port=CONFIG.settings.backend.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
