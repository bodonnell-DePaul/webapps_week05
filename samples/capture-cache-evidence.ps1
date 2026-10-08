# capture-cache-evidence.ps1 — CSC 436 Week 5
# Captures headers AND timing in ONE request, so the cf-cache-status you print
# is the cache-status of the request you timed. Two separate curls will lie to you.
#
# Usage:  pwsh -File capture-cache-evidence.ps1 -Url https://status.yourdomain.example/
param(
  [string]$Url = "https://www.w3.org/WAI/WCAG22/quickref/",
  [string]$OutDir = "."
)

$UA  = "Mozilla/5.0 (CSC436-lab)"
$FMT = "`ntiming  dns=%{time_namelookup}s tcp=%{time_connect}s tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s bytes=%{size_download} status=%{http_code}`n"

function Probe($label, $u, $extra = @()) {
  Write-Output "==================== $label"
  Write-Output "GET $u"
  $args = @('-sS','-o','NUL','-D','-','-A',$UA,'--max-time','30','-w',$FMT) + $extra + @($u)
  & curl.exe @args 2>&1 |
    Select-String -Pattern '^HTTP/|^cf-cache-status|^age:|^cache-control|^etag|^vary|^last-modified|^content-encoding|^cf-ray|^x-cache|^timing'
  Write-Output ""
}

$bust = "$Url" + $(if ($Url -match '\?') { '&' } else { '?' }) + "csc436=" + (Get-Random)

Probe "1. COLD EDGE  (unique key -> expect MISS)"  $bust
Start-Sleep -Seconds 2
Probe "2. WARM EDGE  (same key  -> expect HIT)"    $bust
Probe "3. ORIGIN VIEW (steady-state, no bust)"     $Url
