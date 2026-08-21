"""Atomic, single-source lifecycle for active and historical test sessions."""
from __future__ import annotations
import csv, json, os, threading
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]; RESULTS_ROOT=ROOT/"results"; SESSIONS=RESULTS_ROOT/"sessions"; ACTIVE=RESULTS_ROOT/"active_session.json"; LOCK=threading.RLock()
CAMPAIGN_LOCK=RESULTS_ROOT/"campaign.lock"
VALIDATION_LOCK=RESULTS_ROOT/"validation.lock"
CSV_FIELDS=("Test Number","Session ID","Timestamp","Platform","Scenario","Status","Detection Time (s)","Recovery Time (s)","Recovery Required","Recovery Success","Average Response Time (ms)","P95 Response Time (ms)","Maximum Response Time (ms)","HTTP Success","HTTP Failures","Availability (%)","CPU (%)","Memory (MB)","Error Count","Error Message","Skip Reason","Notes")
ERROR_FIELDS=("Timestamp","Session ID","Platform","Scenario","Command","Exit Code","Error Type","Error Message","Suggested Solution")
FIELD_MAP={"Test Number":"test_number","Session ID":"session_id","Timestamp":"timestamp_end","Platform":"platform","Scenario":"scenario","Status":"status","Detection Time (s)":"detection_time_seconds","Recovery Time (s)":"recovery_time_seconds","Recovery Required":"recovery_required","Recovery Success":"recovery_success","Average Response Time (ms)":"average_response_time_ms","P95 Response Time (ms)":"p95_response_time_ms","Maximum Response Time (ms)":"maximum_response_time_ms","HTTP Success":"http_success_count","HTTP Failures":"http_failure_count","Availability (%)":"availability_percent","CPU (%)":"maximum_cpu_percent","Memory (MB)":"maximum_memory_mb","Error Count":"error_count","Error Message":"error_message","Skip Reason":"skip_reason","Notes":"notes"}

def new_session_id(now=None):
    moment=now or datetime.now().astimezone(); return f"{moment:%Y%m%d_%H%M%S}_{uuid4().hex[:6]}"
def _atomic(path,text):
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+".tmp")
    with tmp.open("w",encoding="utf-8",newline="") as stream: stream.write(text); stream.flush()
    tmp.replace(path)
def _csv(rows,fields):
    stream=StringIO(newline=""); writer=csv.DictWriter(stream,fieldnames=fields,extrasaction="ignore"); writer.writeheader(); writer.writerows(rows); return stream.getvalue()
def current_session_id():
    try:return str(json.loads(ACTIVE.read_text(encoding="utf-8"))["session_id"])
    except (OSError,ValueError,KeyError,TypeError):return ""
def acquire_campaign_lock():
    RESULTS_ROOT.mkdir(parents=True,exist_ok=True)
    if VALIDATION_LOCK.exists():
        raw=VALIDATION_LOCK.read_text(encoding="utf-8").strip()
        try:
            validation_pid_text, owner=raw.split(":",1); os.kill(int(validation_pid_text),0)
        except (OSError,ValueError):
            VALIDATION_LOCK.unlink(missing_ok=True); owner=""
        if owner and os.environ.get("RESILIENCE_VALIDATION_OWNER")!=owner:
            raise RuntimeError("A ten-run stability validation is active; a second worker is not allowed.")
    if CAMPAIGN_LOCK.exists():
        try: pid=int(CAMPAIGN_LOCK.read_text(encoding="utf-8").strip()); os.kill(pid,0)
        except (OSError,ValueError): CAMPAIGN_LOCK.unlink(missing_ok=True)
        else: raise RuntimeError(f"Another resilience campaign is already running (PID {pid}).")
    fd=os.open(CAMPAIGN_LOCK,os.O_CREAT|os.O_EXCL|os.O_WRONLY); os.write(fd,str(os.getpid()).encode()); os.close(fd)
def release_campaign_lock(): CAMPAIGN_LOCK.unlink(missing_ok=True)
def session_dir(session_id=None):
    selected=session_id or current_session_id(); return SESSIONS/selected if selected else SESSIONS/"__none__"
def paths(session_id=None):
    base=session_dir(session_id); return {"dir":base,"csv":base/"results.csv","json":base/"results.json","errors":base/"errors.log","charts":base/"charts","report":base/"report.pdf","meta":base/"session.json","report_state":base/"report.json"}
def read_rows(path=None,session_id=None):
    target=Path(path) if path else paths(session_id)["csv"]
    if not target.exists() or not target.stat().st_size:return []
    with target.open("r",encoding="utf-8-sig",newline="") as stream:return list(csv.DictReader(stream))
def start_session(session_id,*,platforms,total,started_at=None):
    with LOCK:
        base=session_dir(session_id); base.mkdir(parents=True,exist_ok=False); (base/"charts").mkdir()
        meta={"session_id":session_id,"state":"STARTING","started_at":started_at or datetime.now(timezone.utc).isoformat(),"finished_at":None,"platforms":platforms,"total":total}
        _atomic(base/"session.json",json.dumps(meta,ensure_ascii=False,indent=2)+"\n"); _atomic(ACTIVE,json.dumps({"session_id":session_id},indent=2)+"\n")
        _atomic(base/"results.csv",_csv([],CSV_FIELDS)); _atomic(base/"errors.log",_csv([],ERROR_FIELDS)); _write_summary([],meta)
def set_state(state,session_id=None):
    with LOCK:
        p=paths(session_id); meta=json.loads(p["meta"].read_text(encoding="utf-8")); meta["state"]=state
        if state in {"COMPLETED","FAILED","CANCELLED"}:meta["finished_at"]=datetime.now(timezone.utc).isoformat()
        _atomic(p["meta"],json.dumps(meta,ensure_ascii=False,indent=2)+"\n"); return meta
def get_state(session_id=None):
    try:return str(json.loads(paths(session_id)["meta"].read_text(encoding="utf-8")).get("state","IDLE"))
    except (OSError,ValueError):return "IDLE"
def _write_summary(records,meta):
    statuses=[str(x.get("status","")).upper() for x in records]
    payload={"session_id":meta["session_id"],"state":meta.get("state","IDLE"),"started_at":meta["started_at"],"finished_at":meta.get("finished_at"),"platforms":meta.get("platforms",[]),"summary":{"total":len(records),"passed":statuses.count("PASS"),"failed":statuses.count("FAIL"),"skipped":statuses.count("SKIPPED"),"cancelled":statuses.count("CANCELLED")},"results":[{k:v for k,v in x.items() if not k.startswith("_")} for x in records]}
    _atomic(paths(meta["session_id"])["json"],json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
def save_session_records(records,*,finished=False,state=None,session_id=None):
    with LOCK:
        p=paths(session_id); meta=json.loads(p["meta"].read_text(encoding="utf-8")); sid=meta["session_id"]
        if any(str(x.get("session_id",""))!=sid for x in records):raise ValueError("Mixed session IDs are not allowed")
        if state:meta["state"]=state
        elif meta.get("state")=="STARTING":meta["state"]="RUNNING"
        if finished:meta["finished_at"]=datetime.now(timezone.utc).isoformat()
        _atomic(p["meta"],json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
        rows=[]; errors=[]
        for index,record in enumerate(records,1):
            raw=dict(record,test_number=index); rows.append({field:raw.get(key,"N/A") for field,key in FIELD_MAP.items()})
            if str(record.get("status","")).upper()=="FAIL":
                ctx=record.get("_error_context",{}) or {}; errors.append({"Timestamp":record.get("timestamp_end","N/A"),"Session ID":sid,"Platform":record.get("platform",""),"Scenario":record.get("scenario",""),"Command":ctx.get("command",""),"Exit Code":ctx.get("exit_code","N/A"),"Error Type":ctx.get("error_type","ScenarioFailure"),"Error Message":record.get("error_message",""),"Suggested Solution":ctx.get("suggested_solution","Inspect scenario log.")})
        _atomic(p["csv"],_csv(rows,CSV_FIELDS)); _atomic(p["errors"],_csv(errors,ERROR_FIELDS)); _write_summary(records,meta)
def validate_consistency(session_id=None):
    p=paths(session_id); payload=json.loads(p["json"].read_text(encoding="utf-8")); sid=str(payload.get("session_id","")); ids={row.get("Session ID","") for row in read_rows(p["csv"])}
    if ids and ids!={sid}:raise ValueError(f"CSV/JSON session mismatch: {ids} != {sid}")
    if sid!=(session_id or current_session_id()):raise ValueError("Active session mismatch")
    return sid

# Backward-compatible path objects for older imports; new code should call paths().
CURRENT=RESULTS_ROOT/"current"; HISTORY=RESULTS_ROOT/"history"; CHARTS=CURRENT/"charts"; CURRENT_CSV=CURRENT/"results.csv"; CURRENT_JSON=CURRENT/"results.json"; CURRENT_ERRORS=CURRENT/"errors.csv"; CURRENT_REPORT=CURRENT/"report.pdf"; META=CURRENT/"session.json"
