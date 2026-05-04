@echo off
chcp 65001 >nul
echo ============================================
echo   SSS五绝计算器 - Windows 打包脚本
echo ============================================
echo.

REM 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.9+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] 安装依赖...
pip install -r requirements.txt
pip install pyinstaller

echo.
echo [2/3] 开始打包（约需 3-5 分钟）...
pyinstaller "SSS五绝计算器.spec"

echo.
echo [3/3] 打包完成！
echo.
echo 输出文件在: dist\SSS五绝计算器.exe
echo.
echo 提示：将 dist 文件夹中的 SSS五绝计算器.exe 发给其他
echo Windows 用户即可直接使用，无需安装 Python。
echo.
pause
