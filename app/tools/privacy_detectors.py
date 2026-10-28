"""OCR and Presidio detectors for redacting image evidence before processing.

Enable with FMC_PRIVACY_OCR=1 after installing Tesseract, the Python packages
and the configured spaCy English model. Detection output contains geometry and
entity types only; recognized text never leaves this process.
"""
import os
from collections import defaultdict

import pytesseract
from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngineProvider


class PrivacyDetector:
    def __init__(self):
        command = os.environ.get('FMC_TESSERACT_CMD')
        if command:
            pytesseract.pytesseract.tesseract_cmd = command
        # Fail at initialization when the binary or the local model is unavailable.
        pytesseract.get_tesseract_version()
        model = os.environ.get('FMC_PRESIDIO_SPACY_MODEL', 'en_core_web_sm')
        provider = NlpEngineProvider(nlp_configuration={
            'nlp_engine_name': 'spacy',
            'models': [{'lang_code': 'en', 'model_name': model}],
        })
        self.engine = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=['en'])
        for entity, name, pattern, score in [
            ('MY_NRIC', 'Malaysian identity number', r'\b\d{6}[- ]?\d{2}[- ]?\d{4}\b', .85),
            ('MY_VEHICLE_PLATE', 'Malaysian vehicle registration', r'\b[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]?\b', .55),
        ]:
            recognizer = PatternRecognizer(supported_entity=entity, patterns=[Pattern(name=name, regex=pattern, score=score)])
            self.engine.registry.add_recognizer(recognizer)

    def regions(self, image):
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT,
                                         config='--psm 11', timeout=30)
        lines = defaultdict(list)
        for i, value in enumerate(data['text']):
            word = value.strip()
            if not word or float(data['conf'][i]) < 20:
                continue
            key = tuple(data[field][i] for field in ('block_num', 'par_num', 'line_num'))
            lines[key].append((word, int(data['left'][i]), int(data['top'][i]),
                               int(data['width'][i]), int(data['height'][i])))
        output = []
        for words in lines.values():
            text = ''
            spans = []
            for word, x, y, width, height in words:
                if text:
                    text += ' '
                start = len(text)
                text += word
                spans.append((start, len(text), x, y, width, height))
            for hit in self.engine.analyze(text=text, language='en', score_threshold=.5):
                matched = [span for span in spans if span[0] < hit.end and hit.start < span[1]]
                if not matched:
                    continue
                left = max(0, min(row[2] for row in matched) - 5)
                top = max(0, min(row[3] for row in matched) - 5)
                right = min(image.width, max(row[2] + row[4] for row in matched) + 5)
                bottom = min(image.height, max(row[3] + row[5] for row in matched) + 5)
                output.append({'kind': 'plate' if hit.entity_type == 'MY_VEHICLE_PLATE' else 'private_text',
                               'x': left / image.width, 'y': top / image.height,
                               'width': (right - left) / image.width, 'height': (bottom - top) / image.height,
                               'confidence': round(float(hit.score), 5)})
        return output[:100]
