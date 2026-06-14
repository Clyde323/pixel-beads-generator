#!/bin/bash
# 拼豆图纸生成器 - 启动脚本（Mac/Linux）

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  拼豆图纸生成器"
echo "========================================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装"
    exit 1
fi

# 检查并安装依赖
echo "[1/2] 检查依赖..."
if ! python3 -c "import flask" &> /dev/null; then
    echo "[2/2] 安装依赖中..."
    pip3 install -r requirements.txt
else
    echo "[2/2] 依赖已就绪"
fi

echo ""
echo "========================================"
echo "  启动中..."
echo "  浏览器访问: http://localhost:5000"
echo "  按 Ctrl+C 停止服务"
echo "========================================"
echo ""

# 尝试自动打开浏览器
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:5000 2>/dev/null
fi

# 启动应用
python3 app.py
