$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "Missing .venv. Install requirements first." }
& $Python (Join-Path $Root "run_all_tests.py") @args
exit $LASTEXITCODE
