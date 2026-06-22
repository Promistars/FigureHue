#!/bin/bash
# 探活：Web 无响应时通过 systemd 拉起

WORKDIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$WORKDIR/web_log.txt"
PORT="${FIGUREHUE_PORT:-29997}"
WEB_URL="http://127.0.0.1:${PORT}/"
WEB_TIMEOUT=8

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [healthcheck] $*" >> "$LOG"
}

web_ok() {
    local i
    for i in 1 2 3; do
        if curl -sf --connect-timeout "$WEB_TIMEOUT" "$WEB_URL" >/dev/null 2>&1; then
            return 0
        fi
        sleep 3
    done
    return 1
}

if web_ok; then
    log "Web OK ($WEB_URL)"
else
    log "Web 探活失败，执行: systemctl --user restart figurehue.service"
    systemctl --user restart figurehue.service
fi
