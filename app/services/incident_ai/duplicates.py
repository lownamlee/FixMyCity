from __future__ import annotations
import base64, io, math
from datetime import timezone
from functools import lru_cache
from PIL import Image, ImageOps
from schemas import DuplicateRequest

MAX_IMAGE_BYTES = 1_500_000
Image.MAX_IMAGE_PIXELS = 20_000_000

def distance_m(a, b):
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    delta_lat, delta_lon = lat2 - lat1, math.radians(b.longitude - a.longitude)
    haversine = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 12_742_000 * math.asin(min(1, math.sqrt(haversine)))

def similarity(a, b):
    if not a or not b or len(a) != len(b):
        return None
    if any(not math.isfinite(v) for v in (*a, *b)):
        return None
    numerator = sum(x * y for x, y in zip(a, b))
    denominator = math.sqrt(sum(x*x for x in a) * sum(y*y for y in b))
    return max(-1., min(1., numerator / denominator)) if denominator else None

def rank_duplicates(request: DuplicateRequest):
    source = request.report
    if not source.location.confirmed:
        return []
    if source.occurred_at.tzinfo is None:
        raise ValueError("Timestamps must include a timezone")
    results = []
    for candidate in request.candidates:
        if candidate.report_id == source.report_id or not candidate.location.confirmed:
            continue
        if candidate.occurred_at.tzinfo is None:
            raise ValueError("Timestamps must include a timezone")
        distance = distance_m(source.location, candidate.location)
        hours = abs((source.occurred_at.astimezone(timezone.utc) - candidate.occurred_at.astimezone(timezone.utc)).total_seconds()) / 3600
        if distance > request.radius_m or hours > request.time_window_hours:
            continue
        visual = similarity(source.embedding, candidate.embedding)
        spatial = max(0, 1 - distance/request.radius_m)
        temporal = max(0, 1 - hours/request.time_window_hours)
        same_category = source.category == candidate.category
        parts = [(spatial, 0.40), (temporal, 0.25), (float(same_category), 0.15)]
        if visual is not None:
            parts.append((max(0, visual), 0.20))
        score = sum(value*weight for value,weight in parts) / sum(weight for _,weight in parts)
        results.append({"report_id":candidate.report_id,"score":round(score,4),"distance_m":round(distance,1),"hours_apart":round(hours,1),"visual_similarity":round(visual,4) if visual is not None else None,"same_category":same_category,"decision":"review_required"})
    return sorted(results, key=lambda x: (-x["score"], x["report_id"]))[:request.limit]

@lru_cache(maxsize=1)
def model():
    import torch
    from transformers import AutoImageProcessor, AutoModel
    name = "facebook/dinov2-small"
    return torch, AutoImageProcessor.from_pretrained(name), AutoModel.from_pretrained(name).eval()

def embed_image(encoded):
    payload = base64.b64decode(encoded, validate=True)
    if len(payload) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the size limit")
    with Image.open(io.BytesIO(payload)) as image:
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise ValueError("Unsupported image format")
        safe_image = ImageOps.exif_transpose(image).convert("RGB")
        torch, processor, network = model()
        with torch.inference_mode():
            vector = network(**processor(images=safe_image, return_tensors="pt")).last_hidden_state[:, 0, :]
            vector = torch.nn.functional.normalize(vector, dim=-1)
        return vector[0].tolist()
