param(
    [Parameter(Position = 0)]
    [string]$AudioPath,

    [Alias("require-gpu")]
    [switch]$RequireGpu,
    [switch]$All,
    [string]$Output,
    [string]$Json,
    [switch]$Force
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $scriptDir ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Error "Virtual environment not found. Run .\setup.ps1 first."
    exit 1
}

$argsList = @("$scriptDir\transcribe.py")

if ($All) {
    $argsList += "--all"
} elseif ($AudioPath) {
    $argsList += $AudioPath
} else {
    $argsList += "--all"
}

if ($Output) {
    $argsList += @("-o", $Output)
}

if ($Json) {
    $argsList += @("--json", $Json)
}

if ($RequireGpu) {
    $argsList += "--require-gpu"
}

if ($Force) {
    $argsList += "--force"
}

& $python @argsList
