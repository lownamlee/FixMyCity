from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class Location(Model):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    confirmed: bool = False

class TriageRequest(Model):
    text: str = Field(min_length=1, max_length=8000)
    locale: Literal["en", "ms"] = "en"
    location: Location | None = None
    allow_external_processing: bool = False

class Assessment(Model):
    category: Literal["road_accident", "road_damage", "lighting", "cleanliness", "drainage", "flood", "fire", "crime", "fallen_tree", "medical", "other"]
    urgency: Literal["routine", "high", "emergency", "unknown"]
    active_incident: Literal["yes", "no", "unknown"] = "unknown"
    injury_reported: Literal["yes", "no", "unknown"] = "unknown"
    injured_count: int | None = Field(default=None, ge=0, le=1000)
    immediate_danger: Literal["yes", "no", "unknown"] = "unknown"
    hazard: Literal["road_accident", "road_damage", "lighting", "cleanliness", "drainage", "flood", "fire", "crime", "fallen_tree", "other"] | None = None
    title: str = Field(max_length=160)
    summary_en: str = Field(max_length=1500)
    summary_ms: str = Field(max_length=1500)
    missing: list[str] = Field(max_length=12)
    question_en: str = Field(max_length=400)
    question_ms: str = Field(max_length=400)
    requires_authority_review: Literal[True] = True

class DuplicateCandidate(Model):
    report_id: str = Field(min_length=1, max_length=100, pattern=r"^[\w-]+$")
    category: str = Field(max_length=100)
    occurred_at: datetime
    location: Location
    embedding: list[float] | None = Field(default=None, max_length=4096)

class DuplicateRequest(Model):
    report: DuplicateCandidate
    candidates: list[DuplicateCandidate] = Field(max_length=500)
    radius_m: float = Field(default=500, gt=0, le=50000)
    time_window_hours: float = Field(default=72, gt=0, le=8760)
    limit: int = Field(default=10, ge=1, le=30)

class EmbeddingRequest(Model):
    image_base64: str = Field(min_length=20, max_length=2_500_000)

class ReviewInput(Model):
    case_id: str = Field(min_length=1, max_length=100, pattern=r"^[\w-]+$")
    actor_id: str = Field(min_length=1, max_length=100)
    original_category: str = Field(max_length=100)
    corrected_category: str = Field(max_length=100)
    rationale: str = Field(max_length=1000)

class LinkInput(Model):
    source_id: str = Field(min_length=1, max_length=100, pattern=r"^[\w-]+$")
    target_id: str = Field(min_length=1, max_length=100, pattern=r"^[\w-]+$")
    actor_id: str = Field(min_length=1, max_length=100)
    action: Literal["link", "unlink"]
    reason: str = Field(min_length=1, max_length=1000)
    @model_validator(mode="after")
    def different_cases(self):
        if self.source_id == self.target_id:
            raise ValueError("A case cannot be linked to itself")
        return self
