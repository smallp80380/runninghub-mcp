[CmdletBinding()]
param(
    [switch]$SkipDependencies,
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$PackageRoot = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path

function Require-Path([string]$Path, [string]$Description) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing ${Description}: $Path"
    }
}

Require-Path (Join-Path $PackageRoot "package.json") "package manifest"
Require-Path (Join-Path $PackageRoot "package-lock.json") "package lock"
Require-Path (Join-Path $PackageRoot "dist\index.js") "compiled MCP entrypoint"
Require-Path (Join-Path $PackageRoot "data\upstream\manifest.json") "catalog manifest"

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not $npmCommand) {
    throw "Node.js 22.5.0 or newer is required. Install the current Node.js LTS for Windows and run this script again."
}

$nodeVersionText = (& node --version).Trim()
try {
    $nodeVersion = [version]$nodeVersionText.TrimStart("v")
} catch {
    throw "Could not read the installed Node.js version: $nodeVersionText"
}
if ($nodeVersion -lt [version]"22.5.0") {
    throw "Node.js 22.5.0 or newer is required; found $nodeVersionText."
}

Push-Location $PackageRoot
try {
    if (-not $SkipDependencies) {
        Write-Host "Installing runtime dependencies with npm ci --omit=dev ..."
        & npm.cmd ci --omit=dev
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
    }

    if (-not $SkipVerify) {
        Write-Host "Running the local runtime and MCP handshake check ..."
        & npm.cmd run verify
        if ($LASTEXITCODE -ne 0) {
            throw "Runtime verification failed with exit code $LASTEXITCODE."
        }
    }
} finally {
    Pop-Location
}

Write-Host "Installation complete. Use codex-mcp.example.toml to configure Codex; do not put the API key in this package or in command-line arguments."
