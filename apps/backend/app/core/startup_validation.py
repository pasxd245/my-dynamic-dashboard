from __future__ import annotations

from app.core.config import DeploymentEnvironment


class StartupValidationError(RuntimeError):
    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_startup_environment() -> DeploymentEnvironment:
    env = DeploymentEnvironment.from_env()
    errors = env.validate()
    if env.strict_validation_enabled and errors:
        raise StartupValidationError(errors)
    return env
