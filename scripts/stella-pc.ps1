# Stella for Students am PC (Windows) – nutzt die PC-Schicht aus Stella-Life-Assistent (ios/PC).
#   .\scripts\stella-pc.ps1 -Demo        offline mit Beispieldaten
#   .\scripts\stella-pc.ps1              gegen den echten Server
# Erwartet Stella-Life-Assistent daneben, sonst -Stella C:\Pfad\zu\Stella-Life-Assistent.
param(
    [string]$Stella = '',
    [switch]$Demo,
    [switch]$BuildOnly,
    [switch]$Release,
    [string[]]$AppArgs = @()
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Stella) { $Stella = Join-Path (Split-Path $Root -Parent) 'Stella-Life-Assistent' }
$script = Join-Path $Stella 'ios\PC\scripts\stella-pc.ps1'
if (-not (Test-Path $script)) { throw "PC-Schicht nicht gefunden: $script (Stella-Life-Assistent daneben klonen oder -Stella angeben)" }
& $script students -Repo $Root -Demo:$Demo -BuildOnly:$BuildOnly -Release:$Release -AppArgs $AppArgs
