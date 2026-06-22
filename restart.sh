#!/usr/bin/env bash
# FigureHue — 一键重启（优先 systemd，未安装时回退 nohup）

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${FIGUREHUE_PORT:-8080}"

echo "=================================================="
echo " 🎨 FigureHue (port $PORT)"
echo "=================================================="

if systemctl --user is-enabled figurehue.service >/dev/null 2>&1; then
    echo "📦 使用 systemd 重启 figurehue ..."
    systemctl --user restart figurehue.service
    sleep 1
    systemctl --user status figurehue.service --no-pager || true
    echo "  👉 本地: http://127.0.0.1:${PORT}"
    echo "=================================================="
    exit 0
fi

echo "⚠ systemd 未安装，使用 nohup 模式..."
ps -ef | grep "[p]ython3 -m http.server $PORT" | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
sleep 1

cd "$ROOT"
nohup python3 -m http.server "$PORT" --bind 0.0.0.0 >> "$ROOT/web_log.txt" 2>&1 &
echo "  👉 本地: http://127.0.0.1:${PORT}"
echo "  💡 建议执行: bash $ROOT/setup_systemd.sh"
echo "=================================================="
