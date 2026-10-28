"""Private loopback service for separately configured NeMo input/output rails.

Set FMC_NEMO_CONFIG_DIR to a NeMo Guardrails configuration containing both
input and output rails and FMC_NEMO_TOKEN to a random secret of 32+ characters.
Run with: uvicorn nemo_guardrails_server:app --host 127.0.0.1 --port 9195
"""
import hmac
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from nemoguardrails import LLMRails, RailsConfig

secret = os.environ.get('FMC_NEMO_TOKEN', '')
config_dir = os.environ.get('FMC_NEMO_CONFIG_DIR', '')
if len(secret) < 32 or not config_dir:
    raise RuntimeError('Set FMC_NEMO_TOKEN and FMC_NEMO_CONFIG_DIR before starting the service.')


@asynccontextmanager
async def lifespan(app):
    config = RailsConfig.from_path(config_dir)
    if not config.rails.input.flows or not config.rails.output.flows:
        raise RuntimeError('Both input and output guardrail flows must be configured.')
    app.state.rails = LLMRails(config)
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


class Check(BaseModel):
    phase: str = Field(pattern='^(input|output)$')
    text: str = Field(min_length=1, max_length=30000)


@app.post('/v1/check')
async def check(body: Check, request: Request):
    authorization = request.headers.get('authorization', '')
    if not hmac.compare_digest(authorization.encode('utf-8'), ('Bearer ' + secret).encode('utf-8')):
        raise HTTPException(status_code=401, detail='Unauthorized')
    messages = ([{'role': 'user', 'content': body.text}] if body.phase == 'input' else
                [{'role': 'user', 'content': ''}, {'role': 'assistant', 'content': body.text}])
    try:
        result = await request.app.state.rails.generate_async(
            messages=messages,
            options={'rails': {'input': body.phase == 'input', 'output': body.phase == 'output', 'dialog': False}},
        )
        value = result.response
        if isinstance(value, list):
            value = value[-1].get('content') if value and isinstance(value[-1], dict) else None
        # A block, modified output, unexpected return shape or model error is denied.
        return {'phase': body.phase, 'allowed': isinstance(value, str) and hmac.compare_digest(value.encode('utf-8'), body.text.encode('utf-8'))}
    except Exception:
        raise HTTPException(status_code=503, detail='Guardrail evaluation unavailable')
