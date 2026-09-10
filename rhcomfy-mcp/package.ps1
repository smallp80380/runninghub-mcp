[CmdletBinding()]
param(
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$PackageRoot = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PackageRoot "rhcomfy-mcp-runtime.zip"
} else {
    $OutputPath = [IO.Path]::GetFullPath($OutputPath)
}

$entries = @(
    "dist",
    "data",
    "third_party",
    "package.json",
    "package-lock.json",
    "README.md",
    "UPSTREAM.md",
    "install.ps1",
    "verify-install.mjs",
    "codex-mcp.example.toml",
    "package.ps1",
    ".gitignore"
)
$paths = foreach ($entry in $entries) {
    $path = Join-Path $PackageRoot $entry
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Cannot create archive; missing package entry: $entry"
    }
    $path
}

if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
}
for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
        Compress-Archive -Path $paths -DestinationPath $OutputPath -CompressionLevel Optimal
        break
    } catch {
        if (Test-Path -LiteralPath $OutputPath) {
            Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue
        }
        if ($attempt -eq 3) {
            throw
        }
        Start-Sleep -Seconds 1
    }
}
Write-Host "Created runtime package archive: $OutputPath"
Write-Host "Archive intentionally excludes node_modules, local state, source maps, declarations, tests, and secrets."
