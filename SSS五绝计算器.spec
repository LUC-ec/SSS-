# -*- mode: python ; coding: utf-8 -*-
# PyInstaller 打包配置 — 在 Windows 上运行: pyinstaller SSS五绝计算器.spec

import os

spec_root = os.path.dirname(os.path.abspath(SPECPATH))

a = Analysis(
    ['app.py'],
    pathex=[spec_root],
    binaries=[],
    datas=[
        (os.path.join(spec_root, 'templates'), 'templates'),
        (os.path.join(spec_root, 'static'), 'static'),
        (os.path.join(spec_root, 'fund_tracker.db'), '.'),
    ],
    hiddenimports=[
        'flask', 'flask_sqlalchemy', 'sqlalchemy',
        'chinese_calendar', 'chinese_calendar.constants',
        'calculator', 'models', 'trading_calendar',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'matplotlib', 'numpy', 'pandas',
        'scipy', 'PIL', 'cv2', 'test',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='SSS五绝计算器',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,           # 显示控制台窗口（方便调试，可改为 False 隐藏）
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,              # 替换为你的 .ico 路径
)
