"""Convert locally obtained RDD2022, TACO and FLEURS data to JSON Lines.

Input files are not downloaded or modified. Output records retain relative
image names and annotations, and omit embedded image/audio payloads.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def relative_path(value):
    path = Path(str(value).replace('\\', '/'))
    if path.is_absolute() or any(part in ('..', '') for part in path.parts):
        raise ValueError('Dataset file names must remain inside the dataset directory.')
    return path.as_posix()


def rdd_records(directory):
    for file in sorted(directory.rglob('*.xml')):
        root = ET.parse(file).getroot()
        name = root.findtext('filename')
        if not name:
            continue
        labels = []
        for item in root.findall('object'):
            category = item.findtext('name', '').strip()
            box = item.find('bndbox')
            if not category or box is None:
                continue
            coords = [int(float(box.findtext(key, '0'))) for key in ('xmin', 'ymin', 'xmax', 'ymax')]
            if coords[2] > coords[0] and coords[3] > coords[1]:
                labels.append({'category': category, 'bboxXYXY': coords})
        yield {'dataset': 'RDD2022', 'image': relative_path(name), 'annotations': labels}


def taco_records(path):
    source = json.loads(path.read_text(encoding='utf-8'))
    categories = {entry['id']: entry['name'] for entry in source.get('categories', [])}
    images = {entry['id']: {'dataset': 'TACO', 'image': relative_path(entry['file_name']), 'annotations': []}
              for entry in source.get('images', [])}
    for annotation in source.get('annotations', []):
        image = images.get(annotation.get('image_id'))
        box = annotation.get('bbox')
        category = categories.get(annotation.get('category_id'))
        if image is None or category is None or not isinstance(box, list) or len(box) != 4:
            continue
        x, y, width, height = map(float, box)
        if width > 0 and height > 0:
            image['annotations'].append({'category': category, 'bboxXYXY': [x, y, x + width, y + height]})
    yield from images.values()


def fleurs_records(language, split, cache):
    from datasets import load_dataset
    if language not in ('ms_my', 'en_us'):
        raise ValueError('FLEURS language must be ms_my or en_us.')
    dataset = load_dataset('google/fleurs', language, split=split, cache_dir=str(cache) if cache else None,
                           streaming=True)
    for row in dataset:
        transcript = row.get('transcription') or row.get('raw_transcription')
        if isinstance(transcript, str) and transcript.strip():
            yield {'dataset': 'FLEURS', 'language': language, 'split': split,
                   'id': str(row.get('id', '')), 'transcript': transcript.strip()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='dataset', required=True)
    rdd = sub.add_parser('rdd2022'); rdd.add_argument('--annotations', type=Path, required=True)
    taco = sub.add_parser('taco'); taco.add_argument('--annotations', type=Path, required=True)
    fleurs = sub.add_parser('fleurs'); fleurs.add_argument('--language', required=True)
    fleurs.add_argument('--split', choices=['train', 'validation', 'test'], default='test')
    fleurs.add_argument('--cache', type=Path)
    for command in (rdd, taco, fleurs):
        command.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    records = (rdd_records(args.annotations) if args.dataset == 'rdd2022' else
               taco_records(args.annotations) if args.dataset == 'taco' else
               fleurs_records(args.language, args.split, args.cache))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with args.output.open('w', encoding='utf-8', newline='\n') as output:
        for record in records:
            output.write(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n')
            count += 1
    print(json.dumps({'dataset': args.dataset, 'records': count, 'output': str(args.output)}))


if __name__ == '__main__':
    main()
