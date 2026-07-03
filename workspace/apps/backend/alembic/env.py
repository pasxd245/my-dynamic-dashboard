"""Alembic environment — mechanism distilled from the drifted ref app (R78 J-1).

Two deviations from a vanilla `alembic init` env, both deliberate:

1. **URL resolved from `app.db.get_db_path()`**, not from `alembic.ini`.
   That keeps a single source of truth for the SQLite location and lets the
   per-test / `MDD_BACKEND__DATA_DIR` data-root override flow through to
   migrations (mainstream's `app.sqlite`, not the drifted `metadata.db`).
2. **`render_as_batch=True`** so future SQLite migrations can emit
   `ALTER COLUMN` via batch mode (SQLite has no native one). The baseline is
   pure `CREATE`, so it is unaffected.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.db import get_db_path

# Importing the models registers all four tables on `SQLModel.metadata`,
# which is Alembic's autogenerate target.
from app.db_models import SQLModel  # noqa: F401  (side-effect: table registration)
import app.db_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    # R144 — keep the app's own loggers alive: fileConfig's default
    # (disable_existing_loggers=True) silently disabled every logger created
    # before the startup migration (app.routers.*, app.main), swallowing all
    # post-startup app logs (found via the coercion_failed WARNING never
    # reaching backend.log).
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Single source of truth for the DB location (see module docstring).
config.set_main_option("sqlalchemy.url", f"sqlite:///{get_db_path()}")

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
