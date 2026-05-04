#!/bin/bash
# SSS五绝计算器 - macOS 打包脚本
# 注意：打包的 .app 仅能在 macOS 上运行，不能在 Windows 上用
set -e
echo "============================================"
echo "  SSS五绝计算器 - macOS 打包脚本"
echo "============================================"
echo ""

echo "[1/3] 安装依赖..."
pip install -r requirements.txt
pip install pyinstaller

echo ""
echo "[2/3] 开始打包..."
pyinstaller "SSS五绝计算器.spec"

echo ""
echo "[3/3] 打包完成！"
echo "输出文件在: dist/SSS五绝计算器"
echo ""
echo "注意：此版本只能在 macOS 上运行。"
echo "如需 Windows 版本，请在 Windows 机器上运行 build.bat。"
