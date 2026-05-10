from __future__ import annotations

import uvicorn

from app.shared import CONFIG

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=CONFIG.backend_host(), port=CONFIG.backend_port())
