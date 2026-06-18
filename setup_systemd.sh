#!/bin/bash
set -euo pipefail

WORKDIR="$(cd "$(dirname "$0")" && pwd)"
USER_SYSTEMD="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
PORT="${PALETTE_PORT:-8080}"

echo "=================================================="
echo " Palette Studio systemd 托管安装 (port $PORT)"
echo "=================================================="

if [ "$(loginctl show-user "$(whoami)" -p Linger --value 2>/dev/null)" != "yes" ]; then
    echo "启用 linger（登出后仍保持 user systemd 服务）..."
    loginctl enable-linger "$(whoami)"
fi

mkdir -p "$USER_SYSTEMD" "$WORKDIR/config"
chmod +x "$WORKDIR/palette_healthcheck.sh" "$WORKDIR/scripts/run_server.sh"

for unit in "$WORKDIR/systemd/"*.service "$WORKDIR/systemd/"*.timer; do
    name="$(basename "$unit")"
    sed "s|INSTALL_DIR|$WORKDIR|g" "$unit" > "$USER_SYSTEMD/$name"
done

echo "清理旧进程，避免与 systemd 重复..."
ps -ef | grep "[p]ython3 -m http.server $PORT" | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
sleep 1

systemctl --user daemon-reload
systemctl --user enable palette-studio.service palette-healthcheck.timer
systemctl --user restart palette-studio.service
systemctl --user start palette-healthcheck.timer

echo ""
echo "状态:"
systemctl --user status palette-studio.service palette-healthcheck.timer --no-pager || true
echo ""
echo "下次探活时间:"
systemctl --user list-timers palette-healthcheck.timer --no-pager || true
echo "=================================================="
echo " 完成。本地访问: http://127.0.0.1:${PORT}"
echo " 日志: tail -f $WORKDIR/web_log.txt"
echo " 手动重启: bash $WORKDIR/restart.sh"
echo " 手动探活: $WORKDIR/palette_healthcheck.sh"
echo "=================================================="
