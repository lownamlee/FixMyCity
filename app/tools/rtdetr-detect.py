"""Detect objects with a locally installed RT-DETRv2 checkpoint.

Input: a JSON object on stdin with a base64 encoded image and optional threshold.
Output: bounded detections with image-space bounding boxes. Detections are
advisory and do not submit a report or trigger an emergency response.
"""
import base64
import binascii
import io
import json
import math
import os
import sys

from PIL import Image, ImageOps
import torch
from transformers import AutoImageProcessor, RTDetrV2ForObjectDetection


def main():
    model_path = os.environ.get('FMC_RTDETR_MODEL_PATH')
    if not model_path:
        raise ValueError('Set FMC_RTDETR_MODEL_PATH to a locally installed RT-DETRv2 checkpoint.')
    payload = json.loads(sys.stdin.buffer.read(8_000_001))
    encoded = payload.get('imageBase64')
    if not isinstance(encoded, str) or len(encoded) > 8_000_000:
        raise ValueError('The image is invalid or too large.')
    if encoded.startswith('data:'):
        encoded = encoded.split(',', 1)[1]
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError('The image encoding is invalid.') from exc
    threshold = payload.get('threshold', 0.5)
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError('The confidence threshold must be between zero and one.')
    Image.MAX_IMAGE_PIXELS = 25_000_000
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
    if image.width < 1 or image.height < 1:
        raise ValueError('The image dimensions are invalid.')
    processor = AutoImageProcessor.from_pretrained(model_path, local_files_only=True)
    model = RTDetrV2ForObjectDetection.from_pretrained(model_path, local_files_only=True).eval()
    inputs = processor(images=image, return_tensors='pt')
    with torch.inference_mode():
        outputs = model(**inputs)
    result = processor.post_process_object_detection(outputs, target_sizes=torch.tensor([[image.height, image.width]]),
                                                      threshold=float(threshold))[0]
    detections = []
    for score, label, box in zip(result['scores'][:100], result['labels'][:100], result['boxes'][:100]):
        class_id = int(label.item())
        coords = [round(float(value), 2) for value in box.tolist()]
        coords[0] = min(max(coords[0], 0), image.width); coords[2] = min(max(coords[2], 0), image.width)
        coords[1] = min(max(coords[1], 0), image.height); coords[3] = min(max(coords[3], 0), image.height)
        detections.append({'classId': class_id, 'label': str(model.config.id2label.get(class_id, class_id)),
                           'confidence': round(float(score.item()), 4), 'box': coords})
    print(json.dumps({'width': image.width, 'height': image.height, 'detections': detections}, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Image contents and provider errors are never echoed into logs.
        print(json.dumps({'error': 'Object detection could not be completed.'}), file=sys.stderr)
        sys.exit(1)
