from __future__ import annotations
import hmac, os, re
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from schemas import TriageRequest, DuplicateRequest, EmbeddingRequest, ReviewInput, LinkInput
from duplicates import rank_duplicates, embed_image
from graph import graph
from review import record_review, change_link, snapshot

app=FastAPI(title='FixMyCity incident intelligence',docs_url=None,redoc_url=None,openapi_url=None)

def authorize(authorization: str | None = Header(default=None)):
    token=os.environ.get('FMC_AI_SERVICE_TOKEN','')
    if len(token)<32:
        raise HTTPException(503,'Internal service token is not configured')
    supplied=authorization.removeprefix('Bearer ') if authorization else ''
    if not hmac.compare_digest(token,supplied):
        raise HTTPException(403,'Not authorized')

@app.get('/health',dependencies=[Depends(authorize)])
def health():
    return {'ready':True,'gemini_configured':bool(os.environ.get('FMC_GEMINI_API_KEY')),'review_storage_configured':bool(os.environ.get('FMC_AI_REVIEW_DB'))}

@app.post('/v1/triage',dependencies=[Depends(authorize)])
def triage(body:TriageRequest):
    try:
        result=graph.invoke({'request':body})
        return {'assessment':result['assessment'].model_dump(),'provider':result['provider'],'dispatch_performed':False}
    except PermissionError as exc:
        raise HTTPException(403,str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503,'Incident analysis is unavailable') from exc

@app.post('/v1/duplicates',dependencies=[Depends(authorize)])
def duplicates(body:DuplicateRequest):
    try:
        return {'candidates':rank_duplicates(body),'automatic_merge':False}
    except ValueError as exc:
        raise HTTPException(400,str(exc)) from exc

@app.post('/v1/embeddings/dinov2',dependencies=[Depends(authorize)])
def embedding(body:EmbeddingRequest):
    try:
        return {'model':'facebook/dinov2-small','embedding':embed_image(body.image_base64)}
    except ValueError as exc:
        raise HTTPException(400,'Invalid image') from exc
    except Exception as exc:
        raise HTTPException(503,'Image embedding is unavailable') from exc

@app.post('/v1/reviews',dependencies=[Depends(authorize)])
def review(body:ReviewInput):
    return record_review(body)

@app.post('/v1/case-links',dependencies=[Depends(authorize)])
def case_link(body:LinkInput):
    try:
        return change_link(body)
    except ValueError as exc:
        raise HTTPException(409,str(exc)) from exc

class ReleaseRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    version:str=Field(pattern=r'^[A-Za-z0-9._-]{1,80}$')
    actor_id:str=Field(min_length=1,max_length=100)

@app.post('/v1/review-snapshots',dependencies=[Depends(authorize)])
def release(body:ReleaseRequest):
    return snapshot(body.version,body.actor_id)
