param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("compose", "swarm")]
    [string]$Target
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if ($Target -eq "compose") {
    if (docker stack ls --format '{{.Name}}' | Select-String -SimpleMatch 'cars-rental') {
        docker stack rm cars-rental
        $deadline = (Get-Date).AddMinutes(3)
        do {
            Start-Sleep -Seconds 3
            $remaining = docker service ls --filter label=com.docker.stack.namespace=cars-rental --format '{{.Name}}'
        } while ($remaining -and (Get-Date) -lt $deadline)
        if ($remaining) { throw "Swarm stack did not release its published ports." }
    }
    docker compose up -d --build
    docker compose ps
} else {
    docker compose down --remove-orphans
    docker stack deploy -c docker-stack.yml cars-rental
    $deadline = (Get-Date).AddMinutes(4)
    do {
        Start-Sleep -Seconds 3
        $services = docker service ls --filter label=com.docker.stack.namespace=cars-rental --format '{{.Name}}={{.Replicas}}'
        $ready = @($services | Where-Object { $_ -match '=1/1$' }).Count -eq 3
    } while (-not $ready -and (Get-Date) -lt $deadline)
    if (-not $ready) { throw "Swarm services did not reach 1/1: $($services -join ', ')" }
    docker service ls --filter label=com.docker.stack.namespace=cars-rental
}
