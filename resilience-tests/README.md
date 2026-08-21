# TuniCars+ Resilience Testing Framework

This Windows-oriented framework compares Docker Swarm and Kubernetes/Minikube using only the six failure scenarios defined in the project proposal:

1. Container/task kill
2. Node failure
3. CPU saturation
4. Memory pressure
5. Network partition
6. Degraded service/latency

It does not run scaling, rolling-update, Nomad, database-destruction, or unrelated chaos tests.

## Implemented execution model

- `run_all_tests.py` routes every selected scenario to its real handler in `test_runner.py`.
- Docker Swarm services, tasks, containers, replicas, and nodes are discovered dynamically.
- Kubernetes namespaces, deployments, services, pods, UIDs, and nodes are discovered through `kubectl` JSON output.
- Backend discovery scores names, labels, container images, readiness, and port 8000 instead of assuming one fixed resource name.
- When Minikube is running under a different kubectl context, the GUI asks before switching to `minikube` and verifies the context again.
- Kubernetes health access automatically starts a backend port-forward when required and terminates only that child process.
- If local port 8001 is occupied by an invalid endpoint, the framework selects a free loopback port and updates the health URL.
- Container/pod termination measures replacement and backend recovery.
- CPU and memory tests use bounded temporary `polinux/stress` workloads and collect real health, response-time, CPU, and memory samples.
- Multi-node tests drain only an eligible worker hosting the backend and always restore it in `finally`.
- Unsafe Windows network partition or latency injection is explicitly `SKIPPED` unless the application is routed through an isolated proxy. Global firewall and destructive iptables changes are never used.

`PASS`, `FAIL`, and `SKIPPED` are based on scenario outcomes, not only process exit codes. A skipped result always contains `skip_reason`.

## Safety boundaries

- PostgreSQL containers, pods, volumes, and data are never targeted.
- Minikube is never deleted.
- Docker Desktop is never stopped.
- A single/last Swarm manager is never drained.
- Temporary stress workloads are removed in `finally`.
- Node availability is restored in `finally`.
- No container or pod identifier is hard-coded.
- Dry-run executes no Docker or Kubernetes command.

## Desktop interface

Double-click:

```text
start_resilience_tests.bat
```

Use `start_resilience_tests_debug.bat` when a visible startup console is useful. Normal execution uses `pythonw.exe`. All Docker, Minikube and kubectl child processes are started with the Windows no-window flag, and their combined output is streamed into Live Logs and `results/logs/test_execution_<timestamp>.log`.

The Results tab shows only the newest campaign by default. Enable **Show all sessions** to inspect preserved historical campaigns.

The Tkinter application provides `TESTS`, `RESULTS`, `ERRORS`, `CHARTS`, and `REPORT` tabs. Scenarios run sequentially in one background worker, each result is persisted immediately, and a failed platform never prevents the other platform from running. Charts and the PDF are generated once after the completed suite.

## Session-based reports

Every real campaign creates one shared, timestamped `session_id`. Its CSV, JSON, error file, charts, PDF, and GUI rows always use that same identifier.

```text
results/
├── active_session.json
└── sessions/
    └── <session_id>/
        ├── results.csv
        ├── results.json
        ├── errors.log
        ├── report.pdf
        └── charts/
```

Starting a new real campaign creates a new immutable directory under `sessions/<session_id>` and updates only `active_session.json`. Previous session directories are never deleted by Refresh or Generate Report.

- `results.csv` and `results.json` update after every completed scenario.
- `errors.csv` contains only real `FAIL` records and redacts command secrets.
- Charts and `report.pdf` are generated after campaign completion from the active `results/sessions/<session_id>/results.csv` only.
- The `Generate Report` button rebuilds current charts and PDF without rerunning tests.
- The main `Refresh` action reloads current results, errors, charts, counters, and report state without archiving or rerunning anything.
- Use `Open PDF` or `Open Results Folder` in the REPORT tab to inspect the active package.
- Report generation stops if CSV, JSON, and session metadata do not contain the same `session_id`.

## Command-line usage

Run commands from this directory:

```powershell
cd "C:\pfa IH\cars-rental-main\resilience-tests"
```

From the project root, use the complete relative path instead:

```powershell
.\resilience-tests\.venv\Scripts\python.exe .\resilience-tests\run_all_tests.py --dry-run
```

`python run_all_tests.py` cannot work from `cars-rental-main`, because the
script is located inside `resilience-tests`.

### Toxiproxy network and latency scenarios

Network Partition and Latency use a temporary `ghcr.io/shopify/toxiproxy:2.9.0`
resource. The runner preserves the original backend `DATABASE_URL`, reroutes
only the backend service/deployment, restores it in a `finally` block and then
removes the temporary resources.

The configured database-dependent probe is `/cars`. If it is protected, expose
a temporary test-user JWT only in the current terminal session. It is not
written to result files or logs:

```powershell
$env:RESILIENCE_API_TOKEN = "<temporary test JWT>"
```

Run one scenario at a time:

```powershell
python run_all_tests.py --platform swarm --scenario network-partition
python run_all_tests.py --platform swarm --scenario latency
python run_all_tests.py --platform kubernetes --scenario network-partition
python run_all_tests.py --platform kubernetes --scenario latency
```

Validate routes without injecting failures:

```powershell
.\.venv\Scripts\python.exe run_all_tests.py --dry-run --repetitions 1
```

Run one Swarm container-kill experiment:

```powershell
.\.venv\Scripts\python.exe run_all_tests.py --platform swarm --scenario container-kill --repetitions 1
```

Run all six Kubernetes scenarios:

```powershell
.\.venv\Scripts\python.exe run_kubernetes_tests.py --repetitions 1
```

Run unit tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

## Results

- `results/raw/all_results.csv` and `.json`: complete consistent result schema.
- `results/logs/errors.csv` and `.json`: failed scenario diagnostics.
- `results/logs/warnings.csv` and `.json`: skip reasons and warnings.
- `results/logs/latest_error.log`: most recent structured failures.
- `results/charts/`: charts generated only from collected values.
- `results/reports/resilience_report.html`: branded HTML report.

## Environment prerequisites

- Windows 10/11 and Python 3.11+
- Docker Desktop with an active Swarm stack for Swarm tests
- Minikube and `kubectl` for Kubernetes tests
- backend health endpoints reachable at `http://localhost:8000/health` (Swarm) or through framework-managed port-forward on `http://localhost:8001/health` (Kubernetes)
- internet access or a locally cached `polinux/stress` image for CPU/memory workload creation

Run `check_environment.py` or use **Check Environment** in the desktop interface before disruptive scenarios.
