"""Lightweight Windows desktop interface for the TuniCars+ resilience framework."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import threading
import time
from uuid import uuid4


_tcl_root = Path(sys.base_prefix) / "tcl"
if (_tcl_root / "tcl8.6" / "init.tcl").exists():
   
    _runtime_root = Path(__file__).resolve().parent / ".tk-runtime"
    _runtime_tcl = _runtime_root / "tcl8.6"
    _runtime_tk = _runtime_root / "tk8.6"
    if not (_runtime_tcl / "init.tcl").exists():
        shutil.copytree(_tcl_root / "tcl8.6", _runtime_tcl, dirs_exist_ok=True)
        init_file = _runtime_tcl / "init.tcl"
        init_text = init_file.read_text(encoding="utf-8")
        init_file.write_text(init_text.replace("package require -exact Tcl 8.6.12", "package require Tcl 8.6"), encoding="utf-8")
    if (_tcl_root / "tk8.6" / "tk.tcl").exists() and not (_runtime_tk / "tk.tcl").exists():
        shutil.copytree(_tcl_root / "tk8.6", _runtime_tk, dirs_exist_ok=True)
    os.environ.setdefault("TCL_LIBRARY", str(_runtime_tcl))
    os.environ.setdefault("TK_LIBRARY", str(_runtime_tk))

import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser

from PIL import Image, ImageTk
from generate_charts import generate_current_session_charts
from generate_report import generate_current_session_report
from run_all_tests import persist, save_result
from src.session_store import acquire_campaign_lock, current_session_id, get_state, new_session_id, paths, release_campaign_lock, save_session_records, set_state, start_session
from src.command_runner import run_command
from test_runner import PDF_SCENARIOS, execute, fail, preflight_platform, result_template


ROOT = Path(__file__).resolve().parent
def active_paths(): return paths()
LATEST_LOG = ROOT / "results" / "logs" / "latest.log"

SCENARIOS = {
    "Container / Task Kill": "container-kill",
    "Node Failure": "node-failure",
    "CPU Saturation": "cpu",
    "Memory Pressure": "memory",
    "Network Partition": "network-partition",
    "Degraded Service": "latency",
    "All PDF Tests": None,
}
PLATFORMS = {"Docker Swarm": "swarm", "Kubernetes": "kubernetes", "Both": None}


def kubernetes_backend_healthy(runner=run_command, attempts: int = 3) -> bool:
    """Probe backend health through the Kubernetes API service proxy.

    Unlike a fixed localhost:8001 URL, this does not require a user-managed
    port-forward and cannot become stale when the backend pod is replaced.
    """
    command = [
        "kubectl", "get", "--raw",
        "/api/v1/namespaces/default/services/backend:8000/proxy/health",
    ]
    for attempt in range(max(1, attempts)):
        result = runner(command, timeout=5)
        if result.returncode == 0:
            try:
                payload = json.loads(result.stdout)
            except (TypeError, json.JSONDecodeError):
                payload = {}
            if str(payload.get("status", "")).lower() == "healthy":
                return True
        if attempt + 1 < attempts:
            time.sleep(0.5)
    return False


def suite_plan(platform_label: str, scenarios: list[str]) -> list[tuple[str, str]]:
    selected = PLATFORMS[platform_label]
    platforms = [selected] if selected else ["swarm", "kubernetes"]
    return [(platform, scenario) for platform in platforms for scenario in scenarios]


def final_suite_status(statuses: list[str], cancelled: bool = False) -> str:
    if cancelled or "CANCELLED" in statuses:
        return "Finished — CANCELLED"
    if "PASS" in statuses and "FAIL" in statuses:
        return "Finished — MIXED RESULTS"
    if "FAIL" in statuses:
        return "Finished — FAIL"
    return "Finished — PASS"

def terminal_session_state(
    statuses: list[str], *, cancelled: bool = False,
    unhandled_error: bool = False, expected_total: int | None = None,
) -> str:
    if cancelled: return "CANCELLED"
    if expected_total is not None and len(statuses) != expected_total:
        return "FAILED"
    if unhandled_error or "FAIL" in statuses: return "FAILED"
    return "COMPLETED"


def suite_counts_from_rows(rows: list[dict[str, str]]) -> dict[str, int]:
    """Rebuild GUI counters from persisted, authoritative session rows."""
    statuses = [str(row.get("status", "FAIL")).upper() for row in rows]
    return {
        "completed": len(statuses),
        "passed": statuses.count("PASS"),
        "failed": statuses.count("FAIL"),
        "skipped": statuses.count("SKIPPED"),
        "cancelled": statuses.count("CANCELLED"),
    }


def unique_session_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Keep one final row per session/platform/scenario key, in plan order."""
    unique: dict[tuple[str, str, str], dict[str, str]] = {}
    for row in rows:
        key = (
            str(row.get("session_id", "")),
            str(row.get("platform", "")),
            str(row.get("scenario", "")),
        )
        unique[key] = row
    return list(unique.values())

RESULT_COLUMNS = (
    ("scenario", "Scenario"), ("platform", "Platform"),
    ("detection_time_seconds", "Detection Time"),
    ("recovery_time_seconds", "Recovery Time"),
    ("recovery_required", "Recovery Required"),
    ("recovery_success", "Recovery Success"),
    ("average_response_time_ms", "Average Response Time"),
    ("p95_response_time_ms", "P95 Response Time"),
    ("baseline_average_response_time_ms", "Baseline Latency"),
    ("injected_average_response_time_ms", "Injected Latency"),
    ("injection_confirmed", "Injection Confirmed"),
    ("degradation_observed", "Degradation Observed"),
    ("restoration_success", "Restoration"),
    ("maximum_cpu_percent", "CPU"), ("maximum_memory_mb", "Memory"),
    ("http_success_count", "HTTP Success"), ("http_failure_count", "HTTP Failures"),
    ("availability_percent", "Availability"), ("status", "Status"),
    ("skip_reason", "Skip Reason"), ("error_message", "Error Message"),
)

SCENARIO_DISPLAY = {
    "container-kill": "Container / Task Kill", "node-failure": "Node Failure",
    "cpu": "CPU Saturation", "memory": "Memory Pressure",
    "network-partition": "Network Partition", "latency": "Degraded Service / Latency",
}
ERROR_COLUMNS = (
    ("timestamp", "Time"), ("session_id", "Session ID"), ("platform", "Platform"), ("scenario", "Scenario"),
    ("command", "Command"), ("exit_code", "Exit Code"),
    ("stdout", "Stdout"), ("stderr", "Stderr"), ("error_message", "Error"),
    ("suggested_solution", "Suggested Solution"),
)


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as stream:
        rows = list(csv.DictReader(stream))
    aliases = {"Session ID":"session_id","Timestamp":"timestamp","Platform":"platform","Scenario":"scenario","Status":"status","Detection Time (s)":"detection_time_seconds","Recovery Time (s)":"recovery_time_seconds","Recovery Required":"recovery_required","Recovery Success":"recovery_success","Average Response Time (ms)":"average_response_time_ms","P95 Response Time (ms)":"p95_response_time_ms","Maximum Response Time (ms)":"maximum_response_time_ms","HTTP Success":"http_success_count","HTTP Failures":"http_failure_count","Availability (%)":"availability_percent","CPU (%)":"maximum_cpu_percent","Memory (MB)":"maximum_memory_mb","Error Count":"error_count","Error Message":"error_message","Skip Reason":"skip_reason","Notes":"notes","Command":"command","Exit Code":"exit_code","Error Type":"error_type","Suggested Solution":"suggested_solution"}
    for row in rows:
        for display, internal in aliases.items():
            if internal not in row and display in row: row[internal]=row[display]
    return rows

def historical_rows(filename: str) -> list[dict[str,str]]:
    rows=[]
    sessions_root=ROOT/"results"/"sessions"
    for path in sorted(sessions_root.glob(f"*/{filename}")):
        rows.extend(read_csv_rows(path))
    return rows


def value(row: dict[str, str], *names: str) -> str:
    for name in names:
        raw = row.get(name)
        if raw not in (None, "", "nan", "NaN"):
            return str(raw)
    return "-"


def latest_session_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Return only the newest session while preserving its scenario order."""
    session_ids = [row.get("session_id", "") for row in rows if row.get("session_id")]
    if not session_ids:
        return rows
    latest = session_ids[-1]
    return [row for row in rows if row.get("session_id") == latest]


def latest_session_id(rows: list[dict[str, str]]) -> str:
    return next((row.get("session_id", "") for row in reversed(rows) if row.get("session_id")), "")


def select_session_rows(rows: list[dict[str, str]], *, session_id: str | None = None, allow_latest_fallback: bool = True, show_all: bool = False) -> list[dict[str, str]]:
    """Select an active partial session without falling back to historical rows."""
    if show_all:
        return rows
    if session_id:
        return [row for row in rows if row.get("session_id") == session_id]
    return latest_session_rows(rows) if allow_latest_fallback else []


class ResilienceApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("TuniCars+ - Resilience Tests")
        self.geometry("1180x760")
        self.minsize(940, 620)
        self._events: queue.Queue[tuple[str, object]] = queue.Queue()
        self._running = False
        self.active_session_id: str | None = None
        self._started_at = 0.0
        self._cancel_event = threading.Event()
        self._process_holder: dict[str, subprocess.Popen[str] | None] = {"process": None}
        self._health_inflight = False
        self._suite_counts = {"completed": 0, "passed": 0, "failed": 0, "skipped": 0, "cancelled": 0, "total": 0}
        self.show_all_sessions_var = tk.BooleanVar(value=False)
        self._chart_images: list[ImageTk.PhotoImage] = []
        self._configure_style()
        self._set_icon()
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self.request_exit)
        self.refresh_all()
        self.after(200, self._process_events)
        self.after(1000, self._tick)

    def _configure_style(self) -> None:
        self.configure(bg="#f4f7fb")
        style = ttk.Style(self)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("TNotebook", background="#f4f7fb", borderwidth=0)
        style.configure("TNotebook.Tab", padding=(20, 10), font=("Segoe UI", 10, "bold"))
        style.configure("Treeview", rowheight=30, font=("Segoe UI", 9))
        style.configure("Treeview.Heading", font=("Segoe UI", 9, "bold"))
        style.configure("Primary.TButton", font=("Segoe UI", 9, "bold"), padding=(12, 8))
        style.configure("Status.TLabel", font=("Segoe UI", 11, "bold"))

    def _set_icon(self) -> None:
        for path in (ROOT.parent / "public" / "logo.png", ROOT / "assets" / "logo.png"):
            if path.exists():
                try:
                    image = Image.open(path).convert("RGBA")
                    image.thumbnail((64, 64), Image.Resampling.LANCZOS)
                    self._icon_image = ImageTk.PhotoImage(image)
                    self.iconphoto(True, self._icon_image)
                except OSError:
                    pass
                break

    def _build_ui(self) -> None:
        header = ttk.Frame(self, padding=(18, 14))
        header.pack(fill="x")
        ttk.Label(header, text="TuniCars+ Resilience Tests", font=("Segoe UI", 18, "bold")).pack(side="left")
        ttk.Label(header, text="Docker Swarm vs Kubernetes", foreground="#64748b").pack(side="right")
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        self.tests_tab = ttk.Frame(self.notebook, padding=20)
        self.results_tab = ttk.Frame(self.notebook, padding=12)
        self.errors_tab = ttk.Frame(self.notebook, padding=12)
        self.charts_tab = ttk.Frame(self.notebook, padding=12)
        self.report_tab = ttk.Frame(self.notebook, padding=20)
        self.notebook.add(self.tests_tab, text="TESTS")
        self.notebook.add(self.results_tab, text="RESULTS")
        self.notebook.add(self.errors_tab, text="ERRORS")
        self.notebook.add(self.charts_tab, text="CHARTS")
        self.notebook.add(self.report_tab, text="REPORT")
        self._build_tests_tab()
        self._build_results_tab()
        self._build_errors_tab()
        self._build_charts_tab()
        self._build_report_tab()

    def _build_tests_tab(self) -> None:
        options = ttk.LabelFrame(self.tests_tab, text="Test configuration", padding=16)
        options.pack(fill="x")
        ttk.Label(options, text="Platform:", font=("Segoe UI", 10, "bold")).grid(row=0, column=0, sticky="w", padx=(0, 15))
        self.platform_var = tk.StringVar(value="Docker Swarm")
        for index, label in enumerate(PLATFORMS, 1):
            ttk.Radiobutton(options, text=label, value=label, variable=self.platform_var).grid(row=0, column=index, sticky="w", padx=8)
        ttk.Label(options, text="Scenario:", font=("Segoe UI", 10, "bold")).grid(row=1, column=0, sticky="w", pady=(15, 0))
        self.scenario_var = tk.StringVar(value="Container / Task Kill")
        scenario = ttk.Combobox(options, state="readonly", textvariable=self.scenario_var, values=list(SCENARIOS), width=30)
        scenario.grid(row=1, column=1, columnspan=3, sticky="w", pady=(15, 0), padx=8)

        actions = ttk.Frame(self.tests_tab, padding=(0, 16))
        actions.pack(fill="x")
        buttons = [
            ("Check Environment", self.check_environment), ("Run Selected Test", self.run_selected),
            ("All Tests", self.run_all_tests), ("Generate Report", self.generate_report),
            ("Generate Charts", self.generate_charts), ("Stop Current Test", self.stop_current_test),
            ("Exit", self.request_exit),
        ]
        self.action_buttons: list[ttk.Button] = []
        self.controlled_buttons: list[ttk.Button] = []
        for index, (label, command) in enumerate(buttons):
            button = ttk.Button(actions, text=label, command=command, style="Primary.TButton")
            button.grid(row=index // 3, column=index % 3, padx=5, pady=5, sticky="ew")
            actions.columnconfigure(index % 3, weight=1)
            self.action_buttons.append(button)
            if label == "Generate Charts": self.generate_charts_button = button
            if label == "Generate Report": self.generate_report_button = button
            if label == "Stop Current Test":
                self.stop_button = button
                button.configure(state="disabled")
            elif label != "Exit":
                self.controlled_buttons.append(button)

        status = ttk.LabelFrame(self.tests_tab, text="Live status", padding=16)
        status.pack(fill="both", expand=True)
        self.status_var = tk.StringVar(value="Waiting")
        self.health_var = tk.StringVar(value="Not checked")
        self.elapsed_var = tk.StringVar(value="00:00:00")
        self.platform_status_var = tk.StringVar(value="-")
        self.scenario_status_var = tk.StringVar(value="-")
        self.progress_text_var = tk.StringVar(value="0 / 0")
        self.current_test_var = tk.StringVar(value="0")
        self.total_tests_var = tk.StringVar(value="0")
        self.completed_var = tk.StringVar(value="0")
        self.passed_var = tk.StringVar(value="0")
        self.failed_var = tk.StringVar(value="0")
        self.skipped_var = tk.StringVar(value="0")
        self.cancelled_var = tk.StringVar(value="0")
        self.remaining_var = tk.StringVar(value="Calculating...")
        fields = (("Current status", self.status_var), ("Backend health", self.health_var),
                  ("Current platform", self.platform_status_var), ("Current scenario", self.scenario_status_var),
                  ("Current test number", self.current_test_var), ("Total tests", self.total_tests_var),
                  ("Progress", self.progress_text_var), ("Completed", self.completed_var),
                  ("Passed", self.passed_var), ("Failed", self.failed_var),
                  ("Skipped", self.skipped_var), ("Cancelled", self.cancelled_var), ("Elapsed time", self.elapsed_var),
                  ("Estimated remaining", self.remaining_var))
        for row, (label, variable) in enumerate(fields):
            ttk.Label(status, text=f"{label}:", font=("Segoe UI", 10, "bold")).grid(row=row, column=0, sticky="w", pady=4)
            ttk.Label(status, textvariable=variable, style="Status.TLabel").grid(row=row, column=1, sticky="w", padx=15, pady=4)
        self.progress_var = tk.DoubleVar(value=0)
        self.progress = ttk.Progressbar(status, variable=self.progress_var, maximum=100)
        self.progress.grid(row=len(fields), column=0, columnspan=2, sticky="ew", pady=(8, 4))
        self.output = tk.Text(status, height=12, wrap="word", state="disabled", font=("Consolas", 9), bg="#0f172a", fg="#e2e8f0")
        self.output.grid(row=len(fields) + 1, column=0, columnspan=2, sticky="nsew", pady=(8, 0))
        status.columnconfigure(1, weight=1)
        status.rowconfigure(len(fields) + 1, weight=1)

    def _make_tree(self, parent: ttk.Frame, columns: tuple[tuple[str, str], ...]) -> ttk.Treeview:
        container = ttk.Frame(parent)
        container.pack(fill="both", expand=True, pady=(8, 0))
        tree = ttk.Treeview(container, columns=[name for name, _ in columns], show="headings")
        ybar = ttk.Scrollbar(container, orient="vertical", command=tree.yview)
        xbar = ttk.Scrollbar(container, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=ybar.set, xscrollcommand=xbar.set)
        for name, title in columns:
            tree.heading(name, text=title)
            tree.column(name, width=150 if name not in {"error", "error_message", "skip_reason", "suggested_solution"} else 360, minwidth=90)
        tree.grid(row=0, column=0, sticky="nsew")
        ybar.grid(row=0, column=1, sticky="ns")
        xbar.grid(row=1, column=0, sticky="ew")
        container.columnconfigure(0, weight=1)
        container.rowconfigure(0, weight=1)
        return tree

    def _build_results_tab(self) -> None:
        toolbar = ttk.Frame(self.results_tab)
        toolbar.pack(fill="x")
        ttk.Label(toolbar, text="Collected results", font=("Segoe UI", 14, "bold")).pack(side="left")
        ttk.Checkbutton(toolbar, text="Show all sessions", variable=self.show_all_sessions_var, command=self._toggle_session_view).pack(side="left", padx=18)
        for label, command in (("Refresh", self.refresh_results), ("Export CSV", self.export_csv), ("Open Report", self.open_report)):
            ttk.Button(toolbar, text=label, command=command).pack(side="right", padx=4)
        self.results_empty_var = tk.StringVar(value="")
        ttk.Label(self.results_tab, textvariable=self.results_empty_var, foreground="#64748b").pack(anchor="w", pady=(8, 0))
        self.results_tree = self._make_tree(self.results_tab, RESULT_COLUMNS)

    def _build_errors_tab(self) -> None:
        toolbar = ttk.Frame(self.errors_tab)
        toolbar.pack(fill="x")
        self.error_summary_var = tk.StringVar(value="Errors: 0  |  Warnings: 0  |  Skipped: 0")
        ttk.Label(toolbar, textvariable=self.error_summary_var, font=("Segoe UI", 12, "bold")).pack(side="left")
        for label, command in (("Refresh", self.refresh_errors), ("Open Log", self.open_log), ("Clear View", self.clear_error_view)):
            ttk.Button(toolbar, text=label, command=command).pack(side="right", padx=4)
        self.errors_tree = self._make_tree(self.errors_tab, ERROR_COLUMNS)
        self.no_errors_var = tk.StringVar(value="")
        ttk.Label(self.errors_tab, textvariable=self.no_errors_var, foreground="#16a34a").pack(pady=5)

    def _build_charts_tab(self) -> None:
        toolbar = ttk.Frame(self.charts_tab)
        toolbar.pack(fill="x")
        ttk.Label(toolbar, text="Generated charts", font=("Segoe UI", 14, "bold")).pack(side="left")
        ttk.Button(toolbar, text="Refresh", command=self.refresh_charts).pack(side="right")
        self.charts_status_var = tk.StringVar(value="Charts status: Not generated")
        self.charts_count_var = tk.StringVar(value="Charts generated: 0")
        self.charts_time_var = tk.StringVar(value="Generated: -")
        status = ttk.Frame(self.charts_tab)
        status.pack(fill="x", pady=(8, 0))
        for variable in (self.charts_status_var, self.charts_count_var, self.charts_time_var):
            ttk.Label(status, textvariable=variable).pack(side="left", padx=(0, 18))
        self.chart_canvas = tk.Canvas(self.charts_tab, bg="#f4f7fb", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.charts_tab, orient="vertical", command=self.chart_canvas.yview)
        self.chart_frame = ttk.Frame(self.chart_canvas)
        self.chart_frame.bind("<Configure>", lambda _event: self.chart_canvas.configure(scrollregion=self.chart_canvas.bbox("all")))
        self.chart_canvas.create_window((0, 0), window=self.chart_frame, anchor="nw")
        self.chart_canvas.configure(yscrollcommand=scrollbar.set)
        self.chart_canvas.pack(side="left", fill="both", expand=True, pady=(8, 0))
        scrollbar.pack(side="right", fill="y", pady=(8, 0))

    def _build_report_tab(self) -> None:
        ttk.Label(self.report_tab, text="Current Report", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        self.report_session_var = tk.StringVar(value="-")
        self.report_status_var = tk.StringVar(value="Not generated")
        self.report_path_var = tk.StringVar(value=str(active_paths()["report"]))
        self.report_time_var = tk.StringVar(value="-")
        for label, variable in (("Current Session ID", self.report_session_var), ("Report status", self.report_status_var), ("PDF path", self.report_path_var), ("Generated", self.report_time_var)):
            row = ttk.Frame(self.report_tab, padding=(0, 8)); row.pack(fill="x")
            ttk.Label(row, text=label + ":", width=22, font=("Segoe UI", 10, "bold")).pack(side="left")
            ttk.Label(row, textvariable=variable).pack(side="left")
        actions = ttk.Frame(self.report_tab, padding=(0, 18)); actions.pack(fill="x")
        self.report_tab_generate_button = ttk.Button(actions, text="Generate Report", command=self.generate_report)
        self.report_tab_generate_button.pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Open PDF", command=self.open_report).pack(side="left", padx=8)
        ttk.Button(actions, text="Open Results Folder", command=lambda: os.startfile(active_paths()["dir"].resolve())).pack(side="left", padx=8)  # type: ignore[attr-defined]
        ttk.Button(actions, text="Refresh", command=self.refresh_all).pack(side="left", padx=8)

    def _set_running(self, running: bool, status: str) -> None:
        self._running = running
        self.status_var.set(status)
        for button in self.controlled_buttons:
            button.configure(state="disabled" if running else "normal")
        self.stop_button.configure(state="normal" if running else "disabled")
        if running:
            self._started_at = time.monotonic()
            self._cancel_event.clear()

    def _append_output(self, text: str) -> None:
        self.output.configure(state="normal")
        self.output.insert("end", text.rstrip() + "\n")
        self.output.see("end")
        self.output.configure(state="disabled")

    def _run_process(self, script: str, arguments: list[str] | None = None, refresh: bool = True) -> None:
        if self._running:
            return
        self._set_running(True, "Running")
        command = [sys.executable, str(ROOT / script), *(arguments or [])]
        self._append_output("Running: " + " ".join(command[1:]))

        def worker() -> None:
            try:
                lines: list[str] = []
                def log(line: str) -> None:
                    lines.append(line + "\n")
                    self._events.put(("LOG", line))
                outcome = run_command(command, timeout_seconds=3600, cwd=ROOT, cancel_event=self._cancel_event, on_output=log, process_holder=self._process_holder)
                LATEST_LOG.parent.mkdir(parents=True, exist_ok=True)
                LATEST_LOG.write_text("".join(lines), encoding="utf-8")
                self._events.put(("UTILITY_FINISHED", (outcome.returncode, refresh)))
            except Exception as exc:
                self._events.put(("UTILITY_ERROR", str(exc)))

        threading.Thread(target=worker, daemon=True).start()

    def check_environment(self) -> None:
        self._run_process("check_environment.py")

    def run_selected(self) -> None:
        selected = self.scenario_var.get()
        if not messagebox.askyesno("Confirm resilience test", f"Run {selected} on {self.platform_var.get()}?\n\nThe framework may terminate a backend replica or create a bounded stress workload."):
            return
        scenarios = list(PDF_SCENARIOS) if selected == "All PDF Tests" else [SCENARIOS[selected]]
        self._start_suite(scenarios)

    def run_all_tests(self) -> None:
        if not messagebox.askyesno("Confirm resilience campaign", f"Run all six PDF scenarios on {self.platform_var.get()}?\n\nEligible backend replicas or worker nodes may be disrupted temporarily. Restoration safeguards are enabled."):
            return
        self._start_suite(list(PDF_SCENARIOS))

    def generate_report(self) -> None:
        self._run_generation("report")

    def generate_charts(self) -> None:
        self._run_generation("charts")

    def _run_generation(self, kind: str) -> None:
        """Generate artifacts from persisted results; never execute a scenario."""
        if self._running:
            return
        self._running = True
        self.status_var.set(f"Generating {kind}")
        buttons = [self.generate_charts_button] if kind == "charts" else [self.generate_report_button, self.report_tab_generate_button]
        for button in buttons: button.configure(state="disabled")

        def worker() -> None:
            try:
                if kind == "charts":
                    files = generate_current_session_charts()
                    payload = {"kind": kind, "count": len(files), "paths": [str(item) for item in files]}
                else:
                    report = generate_current_session_report()
                    payload = {"kind": kind, "path": str(report), "size": report.stat().st_size}
                self._events.put(("GENERATION_FINISHED", payload))
            except Exception as exc:
                self._events.put(("GENERATION_FAILED", {"kind": kind, "error": f"{type(exc).__name__}: {exc}"}))
        threading.Thread(target=worker, daemon=True).start()

    def stop_current_test(self) -> None:
        if not self._running:
            return
        self._cancel_event.set()
        set_state("STOPPING")
        self.status_var.set("Stopping")
        process = self._process_holder.get("process")
        if process is not None and process.poll() is None:
            try:
                process.terminate()
            except OSError:
                pass
        self._events.put(("LOG", "[CANCEL] Stop requested. Cleaning the current scenario..."))

    def request_exit(self) -> None:
        if not self._running:
            self.destroy()
            return
        if not messagebox.askyesno("Exit", "A test is running. Stop it safely and close the interface?"):
            return
        self.stop_current_test()
        def close_when_safe() -> None:
            if self._running:
                self.after(200, close_when_safe)
            else:
                self.destroy()
        self.after(200, close_when_safe)

    def _start_suite(self, scenarios: list[str]) -> None:
        if self._running:
            return
        try:
            acquire_campaign_lock()
        except RuntimeError as exc:
            messagebox.showerror("Campaign already running", str(exc))
            return
        plan = suite_plan(self.platform_var.get(), scenarios)
        session_id = new_session_id()
        labels = ["Docker Swarm" if name == "swarm" else "Kubernetes" for name in dict.fromkeys(item[0] for item in plan)]
        start_session(session_id, platforms=labels, total=len(plan))
        set_state("RUNNING", session_id)
        self.active_session_id = session_id
        self._clear_results_for_new_session()
        self.refresh_charts()
        self.refresh_report()
        self._append_output(f"[GUI] Suite started with session_id={session_id}")
        self._append_output("[GUI] Results cleared for new session")
        self._suite_counts = {"completed": 0, "passed": 0, "failed": 0, "skipped": 0, "cancelled": 0, "total": len(plan)}
        self.progress_var.set(0)
        self.progress_text_var.set(f"Running test 0/{len(plan)}")
        self.current_test_var.set("0"); self.total_tests_var.set(str(len(plan)))
        self.completed_var.set("0"); self.passed_var.set("0"); self.failed_var.set("0"); self.skipped_var.set("0")
        self.cancelled_var.set("0")
        self.remaining_var.set("Calculating...")
        self._set_running(True, "Running")
        log_path = ROOT / "results" / "logs" / f"test_execution_{time.strftime('%Y%m%d_%H%M%S')}.log"
        self._events.put(("SUITE_STARTED", {"session_id": session_id, "total": len(plan)}))

        def campaign_worker() -> None:
            records: list[dict[str, object]] = []
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("w", encoding="utf-8", buffering=1) as log_stream:
                def log(line: str) -> None:
                    text = line.rstrip()
                    log_stream.write(text + "\n")
                    self._events.put(("LOG", text))

                context_decision: list[bool] = []
                def request_context_switch(current: str) -> bool:
                    if context_decision:
                        return context_decision[0]
                    response: dict[str, object] = {"event": threading.Event(), "accepted": False, "current": current}
                    self._events.put(("CONTEXT_SWITCH_REQUEST", response))
                    while not response["event"].wait(0.1):  # type: ignore[union-attr]
                        if self._cancel_event.is_set():
                            return False
                    accepted = bool(response["accepted"])
                    context_decision.append(accepted)
                    return accepted

                previous_platform = ""
                preflight_errors: dict[str, Exception] = {}
                for target_platform in dict.fromkeys(platform for platform, _scenario in plan):
                    try:
                        log(f"[PREFLIGHT] Checking {target_platform}...")
                        preflight_platform(target_platform, logger=log, context_switcher=request_context_switch)
                        log(f"[PREFLIGHT] {target_platform}: healthy")
                    except Exception as exc:
                       
                        preflight_errors[target_platform] = exc
                        log(f"[PREFLIGHT] {target_platform}: FAILED: {exc}")
                for index, (platform, scenario) in enumerate(plan, 1):
                    if self._cancel_event.is_set():
                        break
                    if platform != previous_platform:
                        log("Running Docker Swarm Tests..." if platform == "swarm" else "Running Kubernetes Tests...")
                        previous_platform = platform
                    self._events.put(("TEST_STARTED", {"platform": platform, "scenario": scenario, "index": index, "total": len(plan)}))
                    label_platform = "Swarm" if platform == "swarm" else "Kubernetes"
                    label_scenario = SCENARIO_DISPLAY.get(scenario, scenario)
                    log(f"[{index}/{len(plan)}] {label_platform} — {label_scenario} — RUNNING")
                    if platform in preflight_errors:
                        preflight_exc = RuntimeError(
                            f"Platform preflight failed; scenario was not injected: {preflight_errors[platform]}"
                        )
                        record = fail(result_template(platform, scenario, 1), preflight_exc, time.monotonic())
                        record["error_type"] = "PreconditionFailed"
                        record["suggested_solution"] = "Use Check Environment, restore this platform, then rerun the campaign."
                    else:
                        try:
                            record = execute(platform, scenario, 1, cancel_event=self._cancel_event, logger=log, process_holder=self._process_holder, context_switcher=request_context_switch)
                        except Exception as exc:
                            record = fail(result_template(platform, scenario, 1), exc, time.monotonic())
                    record["session_id"] = session_id
                    records.append(record)
                    try:
                        save_session_records(records, session_id=session_id)
                        persist(records)
                    except Exception as exc:
                        log(f"[ERROR] Result persistence failed: {exc}")
                        self._events.put(("ERROR", f"Result persistence failed: {exc}"))
                    status = str(record.get("status", "FAIL"))
                    log(f"[{index}/{len(plan)}] {label_platform} — {label_scenario} — {status}")
                    if status == "SKIPPED" and record.get("skip_reason"):
                        log(f"Reason: {record['skip_reason']}")
                    elif status == "FAIL" and record.get("error_message"):
                        log(f"Error: {record['error_message']}")
                    self._events.put(("TEST_FINISHED", {
                        "session_id": session_id, "platform": platform,
                        "scenario": scenario, "result": record, "saved": True,
                    }))
                    self._events.put(("PROGRESS", {"completed": index, "total": len(plan)}))
                    if status == "CANCELLED" or self._cancel_event.is_set():
                        break
                if not self._cancel_event.is_set():
                    save_session_records(records, finished=True, session_id=session_id)
                    try:
                        charts = generate_current_session_charts(session_id)
                        log(f"[ARTIFACT] Charts generated: {len(charts)}")
                    except Exception as exc:
                        log(f"[ERROR] CHART GENERATION FAILURE: {type(exc).__name__}: {exc}")
                    try:
                        report = generate_current_session_report(session_id)
                        log(f"[ARTIFACT] Report generated: {report} ({report.stat().st_size} bytes)")
                    except Exception as exc:
                        log(f"[ERROR] REPORT GENERATION FAILURE: {type(exc).__name__}: {exc}")
            statuses = [str(record.get("status")) for record in records]
            final_status = final_suite_status(statuses, self._cancel_event.is_set())
            duration = round(time.monotonic() - self._started_at, 2)
            summary = [
                "Finished", f"Total Tests : {len(records)}",
                f"Passed : {sum(status == 'PASS' for status in statuses)}",
                f"Failed : {sum(status == 'FAIL' for status in statuses)}",
                f"Skipped : {sum(status == 'SKIPPED' for status in statuses)}",
                f"Duration : {duration} seconds",
            ]
            with log_path.open("a", encoding="utf-8") as log_stream:
                for line in summary:
                    log_stream.write(line + "\n"); self._events.put(("LOG", line))
            shutil.copy2(log_path, LATEST_LOG)
            self._events.put(("SUITE_FINISHED", {"session_id": session_id, "status": final_status, "log": str(log_path), "duration": duration}))

        def worker() -> None:
            try:
                campaign_worker()
            except Exception as exc:
                try: set_state("CANCELLED" if self._cancel_event.is_set() else "FAILED", session_id)
                except Exception: pass
                self._events.put(("ERROR", f"Unhandled campaign error: {exc}"))
                self._events.put(("SUITE_FINISHED", {"session_id": session_id, "status": "Cancelled" if self._cancel_event.is_set() else "Failed", "log": str(log_path), "duration": round(time.monotonic()-self._started_at,2)}))
            finally:
                release_campaign_lock()

        threading.Thread(target=worker, daemon=True).start()

    def _process_events(self) -> None:
        try:
            while True:
                kind, payload = self._events.get_nowait()
                if kind == "LOG":
                    self._append_output(str(payload))
                elif kind == "UTILITY_FINISHED":
                    code, refresh = payload  # type: ignore[misc]
                    self._set_running(False, "Finished — CANCELLED" if code == 130 else ("Finished — PASS" if code == 0 else "Finished — FAIL"))
                    self._append_output(f"Process finished with exit code {code}.")
                    if refresh:
                        self.refresh_all()
                elif kind == "TEST_STARTED":
                    data = payload  # type: ignore[assignment]
                    self.platform_status_var.set("Docker Swarm" if data["platform"] == "swarm" else "Kubernetes")
                    self.scenario_status_var.set(SCENARIO_DISPLAY.get(str(data["scenario"]), str(data["scenario"])))
                    self.current_test_var.set(str(data["index"])); self.total_tests_var.set(str(data["total"]))
                elif kind == "SUITE_STARTED":
                    data = payload  # type: ignore[assignment]
                    self.active_session_id = str(data["session_id"])
                    self._append_output(f"[GUI] Active session: {self.active_session_id}")
                    self.refresh_results(session_id=self.active_session_id, allow_latest_fallback=False)
                    self.refresh_errors(session_id=self.active_session_id, allow_latest_fallback=False)
                elif kind == "TEST_FINISHED":
                    data = payload  
                    record = data["result"]
                    event_session = str(data["session_id"])
                    self._append_output(f"[GUI] TEST_FINISHED received: {data['platform']}/{data['scenario']}")
                    self._append_output(f"[GUI] Active session: {self.active_session_id}")
                    if event_session != self.active_session_id:
                        self._append_output(f"[GUI] Ignored stale TEST_FINISHED event for session {event_session}")
                        continue
                    if not bool(data.get("saved", False)):
                        save_result(record)
                    status = str(record.get("status", "FAIL")).lower()
                    key = {"pass": "passed", "fail": "failed", "skipped": "skipped", "cancelled": "cancelled"}.get(status, "failed")
                    self._suite_counts[key] += 1
                    self._suite_counts["completed"] += 1
                    self.refresh_results(session_id=self.active_session_id, allow_latest_fallback=False)
                    self.refresh_errors(session_id=self.active_session_id, allow_latest_fallback=False)
                elif kind == "PROGRESS":
                    total = self._suite_counts["total"]
                    completed = self._suite_counts["completed"]
                    self.progress_var.set(completed * 100 / total if total else 0)
                    self.progress_text_var.set(f"Running test {completed}/{total}")
                    self.completed_var.set(str(completed)); self.passed_var.set(str(self._suite_counts["passed"])); self.failed_var.set(str(self._suite_counts["failed"])); self.skipped_var.set(str(self._suite_counts["skipped"])); self.cancelled_var.set(str(self._suite_counts["cancelled"]))
                elif kind == "HEALTH":
                    self.health_var.set(str(payload))
                    self._health_inflight = False
                elif kind == "CONTEXT_SWITCH_REQUEST":
                    data = payload  
                    accepted = messagebox.askyesno("Kubernetes context", f"Minikube is running but kubectl is using another context ({data['current']}).\n\nSwitch kubectl context to minikube?")
                    data["accepted"] = accepted
                    data["event"].set()
                elif kind == "SUITE_FINISHED":
                    data = payload 
                    raw_status=str(data["status"])
                    event_session = str(data.get("session_id") or self.active_session_id or "")
                    if self.active_session_id and event_session != self.active_session_id:
                        self._append_output(f"[GUI] Ignored stale SUITE_FINISHED event for session {event_session}")
                        continue
                    
                    final_rows = unique_session_rows(select_session_rows(
                        read_csv_rows(active_paths()["csv"]),
                        session_id=event_session,
                        allow_latest_fallback=False,
                    ))
                    statuses = [str(row.get("status", "FAIL")).upper() for row in final_rows]
                    final_state = terminal_session_state(
                        statuses,
                        cancelled=self._cancel_event.is_set() or "CANCEL" in raw_status.upper(),
                        unhandled_error=("FAIL" in raw_status.upper() and not statuses),
                        expected_total=int(self._suite_counts.get("total", 0)),
                    )
                    self._suite_counts.update(suite_counts_from_rows(final_rows))
                    self.current_test_var.set(str(len(statuses)))
                    self.completed_var.set(str(len(statuses)))
                    self.passed_var.set(str(statuses.count("PASS")))
                    self.failed_var.set(str(statuses.count("FAIL")))
                    self.skipped_var.set(str(statuses.count("SKIPPED")))
                    self.cancelled_var.set(str(statuses.count("CANCELLED")))
                    total = int(self._suite_counts.get("total", len(statuses)))
                    self.progress_var.set((len(statuses) * 100 / total) if total else 0)
                    self.progress_text_var.set(f"Completed {len(statuses)}/{total}")
                    try: set_state(final_state, self.active_session_id)
                    except Exception as exc: self._append_output(f"[WARNING] Could not persist final state: {exc}")
                    visible={"COMPLETED":"Completed","FAILED":"Failed","CANCELLED":"Cancelled"}[final_state]
                    self._set_running(False, visible)
                    self._append_output(f"[SUITE] {data['status']}")
                    self.refresh_results(session_id=self.active_session_id, allow_latest_fallback=False)
                    self.refresh_errors(session_id=self.active_session_id, allow_latest_fallback=False)
                    self.refresh_charts()
                    self.refresh_report()
                elif kind == "ERROR":
                    self._append_output("ERROR: " + str(payload))
                elif kind == "UTILITY_ERROR":
                    self._set_running(False, "Finished — FAIL")
                    self._append_output("ERROR: " + str(payload))
                elif kind == "GENERATION_FINISHED":
                    data = payload  # type: ignore[assignment]
                    self._running = False
                    self.status_var.set("Finished")
                    self.generate_charts_button.configure(state="normal")
                    self.generate_report_button.configure(state="normal")
                    self.report_tab_generate_button.configure(state="normal")
                    self.refresh_charts()
                    self.refresh_report()
                    self._append_output(f"[OK] {data['kind'].title()} generated from existing current-session results.")
                elif kind == "GENERATION_FAILED":
                    data = payload  # type: ignore[assignment]
                    self._running = False
                    self.status_var.set("Finished — FAIL")
                    self.generate_charts_button.configure(state="normal")
                    self.generate_report_button.configure(state="normal")
                    self.report_tab_generate_button.configure(state="normal")
                    message = str(data["error"])
                    self._append_output(f"[ERROR] {data['kind'].title()} generation failed: {message}")
                    self.errors_tree.insert("", 0, values=[time.strftime("%Y-%m-%d %H:%M:%S"), current_session_id(), "local", data["kind"], "artifact generation", "1", "", "", message, "Inspect the current-session result files."])
                    self.no_errors_var.set("")
        except queue.Empty:
            pass
        self.after(200, self._process_events)

    def _tick(self) -> None:
        if self._running:
            elapsed = int(time.monotonic() - self._started_at)
            self.elapsed_var.set(time.strftime("%H:%M:%S", time.gmtime(elapsed)))
            completed = self._suite_counts["completed"]; total = self._suite_counts["total"]
            if completed > 0 and completed < total:
                remaining = int((elapsed / completed) * (total - completed))
                self.remaining_var.set(time.strftime("%H:%M:%S", time.gmtime(max(0, remaining))))
            elif completed >= total and total:
                self.remaining_var.set("00:00:00")
        if not self._health_inflight:
            self._health_inflight = True
            threading.Thread(target=self._update_health, daemon=True).start()
        self.after(1000, self._tick)

    def _update_health(self) -> None:
        platform = self.platform_var.get()
        states = []
        if platform in {"Docker Swarm", "Both"}:
            try:
                with urlopen("http://127.0.0.1:8000/health", timeout=0.75) as response:
                    ok = response.status == 200
            except (URLError, OSError, TimeoutError):
                ok = False
            states.append(f"Swarm: {'Healthy' if ok else 'Unavailable'}")
        if platform in {"Kubernetes", "Both"}:
            ok = kubernetes_backend_healthy()
            states.append(f"Kubernetes: {'Healthy' if ok else 'Unavailable'}")
        self._events.put(("HEALTH", " | ".join(states)))

    def refresh_all(self) -> None:
        self.refresh_results()
        self.refresh_errors()
        self.refresh_charts()
        self.refresh_report()

    def _toggle_session_view(self) -> None:
        self.refresh_results(session_id=self.active_session_id, allow_latest_fallback=self.active_session_id is None)
        self.refresh_errors(session_id=self.active_session_id, allow_latest_fallback=self.active_session_id is None)

    def _clear_results_for_new_session(self) -> None:
        children = self.results_tree.get_children()
        if children:
            self.results_tree.delete(*children)
        self.results_tree.xview_moveto(0)
        self.results_tree.yview_moveto(0)
        self.results_tree.update_idletasks()
        self.results_empty_var.set("Current session is running. No completed test yet.")

    def refresh_results(self, session_id: str | None = None, allow_latest_fallback: bool = True) -> None:
        children = self.results_tree.get_children()
        if children:
            self.results_tree.delete(*children)
        result_path=active_paths()["csv"]; rows = historical_rows("results.csv") if self.show_all_sessions_var.get() else read_csv_rows(result_path)
        requested_session = session_id or self.active_session_id
        show_all = self.show_all_sessions_var.get()
        rows = select_session_rows(
            rows, session_id=requested_session,
            allow_latest_fallback=allow_latest_fallback and not self._running,
            show_all=show_all,
        )
        if requested_session and not show_all:
            found_ids = sorted({row.get("session_id", "") for row in read_csv_rows(result_path) if row.get("session_id")})
            self._append_output(f"[GUI] Active-session rows found: {len(rows)}")
            if not rows:
                self._append_output(f"[GUI] Old-session fallback disabled while suite is {'running' if self._running else 'selected'}")
                self._append_output(f"[GUI] CSV path: {result_path.resolve()} | exists={result_path.exists()} | session IDs={found_ids}")
        for row in rows:
            display = []
            for name, _ in RESULT_COLUMNS:
                aliases = {
                    "detection_time_seconds": ("detection_time_seconds", "detection_time"),
                    "recovery_time_seconds": ("recovery_time_seconds", "recovery_time"),
                    "maximum_cpu_percent": ("maximum_cpu_percent", "cpu_percent", "cpu"),
                    "maximum_memory_mb": ("maximum_memory_mb", "memory_mb", "memory"),
                }.get(name, (name,))
                displayed = value(row, *aliases)
                if name == "scenario":
                    displayed = SCENARIO_DISPLAY.get(displayed, displayed)
                elif name == "recovery_required":
                    displayed = {"true": "Yes", "false": "No"}.get(displayed.lower(), displayed)
                if name == "status" and displayed.upper() == "SKIPPED":
                    reason = value(row, "skip_reason")
                    displayed = "SKIPPED"
                display.append(displayed)
            self.results_tree.insert("", "end", values=display)
        self.results_tree.xview_moveto(0)
        self.results_tree.yview_moveto(0)
        self.results_tree.update_idletasks()
        if rows:
            self.results_empty_var.set("")
        elif requested_session and not show_all:
            self.results_empty_var.set("Current session is running. No completed test yet." if self._running else "No completed test for the selected session.")
        else:
            self.results_empty_var.set("No result available.")
        self._append_output(f"[GUI] Results Treeview refreshed: {len(rows)} rows")
        statuses=[value(row,"status").upper() for row in rows]
        self._suite_counts.update(completed=len(rows),passed=statuses.count("PASS"),failed=statuses.count("FAIL"),skipped=statuses.count("SKIPPED"),cancelled=statuses.count("CANCELLED"))
        self.completed_var.set(str(len(rows))); self.passed_var.set(str(statuses.count("PASS"))); self.failed_var.set(str(statuses.count("FAIL"))); self.skipped_var.set(str(statuses.count("SKIPPED"))); self.cancelled_var.set(str(statuses.count("CANCELLED")))

    def export_csv(self) -> None:
        result_path=active_paths()["csv"]
        if not result_path.exists():
            messagebox.showinfo("Export CSV", "No result data is available.")
            return
        target = filedialog.asksaveasfilename(title="Export results", defaultextension=".csv", filetypes=[("CSV files", "*.csv")], initialfile="tunicars_resilience_results.csv")
        if target:
            shutil.copy2(result_path, target)

    def open_report(self) -> None:
        report=active_paths()["report"]
        if report.exists():
            webbrowser.open(report.resolve().as_uri())
        else:
            messagebox.showinfo("Report", "Generate the report first.")

    def refresh_errors(self, session_id: str | None = None, allow_latest_fallback: bool = True) -> None:
        self.errors_tree.delete(*self.errors_tree.get_children())
        results = historical_rows("results.csv") if self.show_all_sessions_var.get() else read_csv_rows(active_paths()["csv"])
        errors = historical_rows("errors.log") if self.show_all_sessions_var.get() else read_csv_rows(active_paths()["errors"])
        show_all = self.show_all_sessions_var.get()
        requested_session = session_id or self.active_session_id
        results = select_session_rows(results, session_id=requested_session, allow_latest_fallback=allow_latest_fallback and not self._running, show_all=show_all)
        errors = select_session_rows(errors, session_id=requested_session, allow_latest_fallback=allow_latest_fallback and not self._running, show_all=show_all)
        for row in errors:
            self.errors_tree.insert("", "end", values=[value(row, name) for name, _ in ERROR_COLUMNS])
        warnings = sum(value(row, "status").upper() == "WARNING" for row in results)
        skipped_rows = [row for row in results if value(row, "status").upper() == "SKIPPED"]
        skipped = len(skipped_rows)
        self.error_summary_var.set(f"Errors: {len(errors)}  |  Warnings: {warnings}  |  Skipped: {skipped}")
        self.no_errors_var.set("No errors recorded." if not errors else "")

    def open_log(self) -> None:
        if LATEST_LOG.exists():
            os.startfile(LATEST_LOG)  # type: ignore[attr-defined]
        else:
            messagebox.showinfo("Log", "No log file is available.")

    def clear_error_view(self) -> None:
        self.errors_tree.delete(*self.errors_tree.get_children())
        self.no_errors_var.set("View cleared. Source files were not deleted.")

    def refresh_charts(self) -> None:
        for child in self.chart_frame.winfo_children():
            child.destroy()
        self._chart_images.clear()
        chart_dir=active_paths()["charts"]; charts = sorted(chart_dir.glob("*.png")) if chart_dir.exists() else []
        valid_charts = [item for item in charts if item.stat().st_size > 0]
        metadata_path = active_paths()["dir"] / "charts.json"
        generated_time = "-"
        if metadata_path.exists():
            try:
                import json
                generated_time = str(json.loads(metadata_path.read_text(encoding="utf-8")).get("generated_at", "-"))
            except (OSError, ValueError):
                generated_time = "-"
        elif valid_charts:
            generated_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(max(item.stat().st_mtime for item in valid_charts)))
        self.charts_status_var.set("Charts status: Generated" if valid_charts else "Charts status: Not generated")
        self.charts_count_var.set(f"Charts generated: {len(valid_charts)}")
        self.charts_time_var.set(f"Generated: {generated_time}")
        if not valid_charts:
            message = "Charts will be generated after the current campaign finishes." if self._running else "No chart is available for the current session."
            ttk.Label(self.chart_frame, text=message).grid(row=0, column=0, padx=20, pady=30)
            return
        for index, path in enumerate(valid_charts):
            try:
                image = Image.open(path).convert("RGB")
                image.thumbnail((380, 220), Image.Resampling.LANCZOS)
                photo = ImageTk.PhotoImage(image)
                self._chart_images.append(photo)
                card = ttk.Frame(self.chart_frame, padding=8)
                card.grid(row=index // 2, column=index % 2, padx=8, pady=8, sticky="n")
                label = ttk.Label(card, image=photo, cursor="hand2")
                label.pack()
                label.bind("<Button-1>", lambda _event, selected=path: self.preview_chart(selected))
                ttk.Label(card, text=path.stem.replace("_", " ").title()).pack(pady=(5, 0))
            except OSError:
                continue

    def refresh_report(self) -> None:
        self.report_session_var.set(current_session_id() or "-")
        report=active_paths()["report"]; self.report_path_var.set(str(report.resolve()))
        if report.exists():
            self.report_status_var.set("Generated")
            self.report_time_var.set(time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(report.stat().st_mtime)))
        else:
            self.report_status_var.set("Not generated")
            self.report_time_var.set("-")

    def preview_chart(self, path: Path) -> None:
        preview = tk.Toplevel(self)
        preview.title(path.stem.replace("_", " ").title())
        preview.geometry("1000x650")
        image = Image.open(path).convert("RGB")
        image.thumbnail((950, 590), Image.Resampling.LANCZOS)
        photo = ImageTk.PhotoImage(image)
        label = ttk.Label(preview, image=photo)
        label.image = photo  # type: ignore[attr-defined]
        label.pack(expand=True, padx=15, pady=15)


def main() -> int:
    try:
        app = ResilienceApp()
        app.mainloop()
        return 0
    except Exception as exc:
        error_log = ROOT / "results" / "logs" / "gui_startup_error.log"
        error_log.parent.mkdir(parents=True, exist_ok=True)
        error_log.write_text(str(exc), encoding="utf-8")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
