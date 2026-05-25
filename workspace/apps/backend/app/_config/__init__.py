"""Backend config package — Path C (Pydantic + AppConfig facade).

R28 readiness chain. Drifted-pattern reference:
`apps/backend/app/shared.py` (AppConfig, Fields, Const, layered loader).
"""

from .app_config import CONFIG, AppConfig
from .const import Const
from .fields import Fields
from .settings import BackendSettings, Settings, TmpSweepSettings, build_settings

__all__ = [
    "CONFIG",
    "AppConfig",
    "BackendSettings",
    "Const",
    "Fields",
    "Settings",
    "TmpSweepSettings",
    "build_settings",
]
