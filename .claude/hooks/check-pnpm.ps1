# PreToolUse guard (PowerShell): force pnpm installs through Socket Firewall (sfw).
# Blocks bare `pnpm add|install|update|dlx ...` and tells the caller to
# rerun it as `sfw pnpm ...`. Read-only/run commands (pnpm run/test/build/...)
# are left alone.

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
    exit 0
}

$data = $inputJson | ConvertFrom-Json
$command = $data.tool_input.command

if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

# Already routed through Socket Firewall — let it through.
if ($command -match '(^|[;&|]|\s)sfw\s+pnpm\s+(add|install|update|dlx)\b') {
    exit 0
}

if ($command -match '(^|[;&|]|\s)pnpm\s+(add|install|update|dlx)\b') {
    Write-Error "Commande bloquée : utilise Socket Firewall avec sfw pnpm ..."
    exit 2
}

exit 0
