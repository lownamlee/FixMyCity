from __future__ import annotations
import hashlib, json, os, sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from graph import redact
from schemas import ReviewInput, LinkInput

def timestamp():
    return datetime.now(timezone.utc).isoformat()

def database_path():
    configured = os.environ.get('FMC_AI_REVIEW_DB')
    if not configured:
        raise RuntimeError('FMC_AI_REVIEW_DB must be configured outside the source tree')
    return Path(configured).expanduser()

@contextmanager
def connection():
    path = database_path()
    path.parent.mkdir(parents=True,exist_ok=True)
    db = sqlite3.connect(path,timeout=10)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA foreign_keys=ON')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,case_id TEXT NOT NULL,actor_id TEXT NOT NULL,original_category TEXT NOT NULL,corrected_category TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS case_links(source_id TEXT NOT NULL,target_id TEXT NOT NULL,linked INTEGER NOT NULL CHECK(linked IN (0,1)),updated_at TEXT NOT NULL,PRIMARY KEY(source_id,target_id));
        CREATE TABLE IF NOT EXISTS link_events(id INTEGER PRIMARY KEY,source_id TEXT NOT NULL,target_id TEXT NOT NULL,action TEXT NOT NULL,actor_id TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS releases(id INTEGER PRIMARY KEY,version TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL,created_at TEXT NOT NULL,review_count INTEGER NOT NULL,sha256 TEXT NOT NULL,content TEXT NOT NULL);
        ''')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def record_review(review: ReviewInput):
    with connection() as db:
        result=db.execute('INSERT INTO reviews(case_id,actor_id,original_category,corrected_category,rationale,created_at) VALUES(?,?,?,?,?,?)',
            (review.case_id, review.actor_id, review.original_category, review.corrected_category, redact(review.rationale),timestamp()))
        return {'review_id':result.lastrowid,'status':'reviewed','automatic_model_update':False}

def change_link(link: LinkInput):
    source,target=sorted((link.source_id,link.target_id)); now=timestamp(); active=int(link.action=='link')
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        existing=db.execute('SELECT linked FROM case_links WHERE source_id=? AND target_id=?',(source,target)).fetchone()
        if bool(existing and existing['linked']) == bool(active):
            raise ValueError('Cases are already in that link state')
        db.execute('INSERT INTO case_links VALUES(?,?,?,?) ON CONFLICT(source_id,target_id) DO UPDATE SET linked=excluded.linked,updated_at=excluded.updated_at',(source,target,active,now))
        db.execute('INSERT INTO link_events(source_id,target_id,action,actor_id,reason,created_at) VALUES(?,?,?,?,?,?)',(source,target,link.action,link.actor_id,redact(link.reason),now))
        return {'source_id':source,'target_id':target,'linked':bool(active),'preserves_source_evidence':True}

def snapshot(version: str, actor_id: str):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        rows=[dict(row) for row in db.execute('SELECT id,case_id,original_category,corrected_category,created_at FROM reviews ORDER BY id')]
        content=json.dumps({'version':version,'reviews':rows},sort_keys=True,separators=(',',':'))
        digest=hashlib.sha256(content.encode()).hexdigest()
        db.execute('INSERT INTO releases(version,created_by,created_at,review_count,sha256,content) VALUES(?,?,?,?,?,?)',(version,actor_id,timestamp(),len(rows),digest,content))
        return {'version':version,'review_count':len(rows),'sha256':digest,'status':'snapshot_created','evaluation_required':True,'released_to_model':False}
