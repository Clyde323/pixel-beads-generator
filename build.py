# -*- coding: utf-8 -*-
"""
拼豆图纸生成器 - 打包脚本
"""

import PyInstaller.__main__
import os

# 获取当前目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PyInstaller.__main__.run([
    'app.py',
    '--name=拼豆图纸生成器',
    '--onefile',
    '--noconfirm',
    '--clean',
    f'--add-data={os.path.join(BASE_DIR, "static")};static',
    f'--add-data={os.path.join(BASE_DIR, "templates")};templates',
    '--hidden-import=flask',
    '--hidden-import=PIL',
    '--hidden-import=numpy',
    '--icon=NONE',
])
