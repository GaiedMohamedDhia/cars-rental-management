"""Run a bounded real GUI lifecycle smoke test without manual interaction."""
from __future__ import annotations
import json, time
from resilience_gui import ResilienceApp
from src.session_store import get_state, paths, read_rows

app=ResilienceApp(); app.withdraw(); app.platform_var.set("Both")
app._start_suite(["container-kill"])
deadline=time.monotonic()+600
def poll():
    if not app._running:
        p=paths(); rows=read_rows(p["csv"])
        print(json.dumps({"session_id":app.active_session_id,"state":get_state(),"rows":len(rows),"statuses":[r.get("Status") for r in rows],"csv":str(p["csv"]),"json":str(p["json"]),"charts":len(list(p["charts"].glob("*.png"))),"report":str(p["report"]),"report_exists":p["report"].exists()},ensure_ascii=False))
        app.destroy(); return
    if time.monotonic()>deadline:
        app.stop_current_test(); print(json.dumps({"timeout":True,"session_id":app.active_session_id})); app.after(3000,app.destroy); return
    app.after(250,poll)
app.after(250,poll); app.mainloop()
