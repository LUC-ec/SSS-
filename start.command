#!/bin/bash
cd "$(dirname "$0")"
lsof -ti:5000 | xargs kill -9 2>/dev/null
echo "  正在启动 SSS五绝计算器..."
python3 app.py &
sleep 3
open http://127.0.0.1:5000
wait
