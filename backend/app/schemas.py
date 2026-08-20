"""Request and response models. Validation lives here, not in the routes."""

from typing import Any

from pydantic import BaseModel, Field, field_validator


class GenerateRequest(BaseModel):
    kind: str
    n_samples: int = Field(default=300, ge=1, le=5000)
    noise: float = Field(default=0.05, ge=0.0, le=2.0)
    random_seed: int = 42


class PointsPayload(BaseModel):
    points: list[list[float]]

    @field_validator("points")
    @classmethod
    def validate_points(cls, value: list[list[float]]) -> list[list[float]]:
        """Reject empty, ragged, or non-finite point sets before they reach numpy."""
        import math

        if not value:
            raise ValueError("Provide at least one point.")
        width = len(value[0])
        if width == 0:
            raise ValueError("Points must have at least one feature.")
        for i, row in enumerate(value):
            if len(row) != width:
                raise ValueError(
                    f"Row {i} has {len(row)} value(s) but row 0 has {width}; "
                    "every point needs the same number of features."
                )
            for j, cell in enumerate(row):
                if cell is None or not math.isfinite(cell):
                    raise ValueError(f"Row {i}, column {j} is not a finite number.")
        return value


class ClusterRequest(PointsPayload):
    params: dict[str, Any] = Field(default_factory=dict)
    record_trace: bool = True
    max_steps: int = Field(default=5000, ge=10, le=100_000)
    standardize: bool = False


class CompareRequest(PointsPayload):
    configs: dict[str, dict[str, Any]] = Field(default_factory=dict)
    standardize: bool = False


class ProjectRequest(PointsPayload):
    n_components: int = Field(default=2, ge=1, le=10)
