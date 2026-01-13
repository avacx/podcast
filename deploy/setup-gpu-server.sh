#!/bin/bash
# Ubuntu 22.04 + NVIDIA 4090D 部署脚本
# 使用方法: chmod +x setup-gpu-server.sh && ./setup-gpu-server.sh

set -e

echo "🚀 开始部署 Podcast Transcriber (GPU 版本)"
echo "============================================"

# 1. 系统更新
echo "📦 更新系统包..."
sudo apt update && sudo apt upgrade -y

# 2. 安装基础依赖
echo "📦 安装基础依赖..."
sudo apt install -y curl git ffmpeg python3 python3-pip python3-venv nodejs npm

# 3. 检查 NVIDIA 驱动
echo "🔍 检查 NVIDIA 驱动..."
if ! command -v nvidia-smi &> /dev/null; then
    echo "❌ 未检测到 NVIDIA 驱动，请先安装驱动"
    echo "   运行: sudo apt install nvidia-driver-535"
    exit 1
fi
nvidia-smi
echo "✅ NVIDIA 驱动正常"

# 4. 检查 CUDA
echo "🔍 检查 CUDA..."
if ! command -v nvcc &> /dev/null; then
    echo "⚠️ 未检测到 CUDA，正在安装 CUDA Toolkit..."
    # 安装 CUDA 12.x
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
    sudo dpkg -i cuda-keyring_1.1-1_all.deb
    sudo apt update
    sudo apt install -y cuda-toolkit-12-4
    rm cuda-keyring_1.1-1_all.deb
    
    # 添加环境变量
    echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
    echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
    source ~/.bashrc
fi
echo "✅ CUDA 已安装"

# 5. 安装 cuDNN (Faster-Whisper 需要)
echo "📦 检查 cuDNN..."
if ! ldconfig -p | grep -q libcudnn; then
    echo "⚠️ 正在安装 cuDNN..."
    sudo apt install -y libcudnn8 libcudnn8-dev
fi
echo "✅ cuDNN 已安装"

# 6. 克隆或更新项目
PROJECT_DIR="$HOME/podcast-transcriber"
if [ -d "$PROJECT_DIR" ]; then
    echo "📂 更新现有项目..."
    cd "$PROJECT_DIR"
    git pull
else
    echo "📂 克隆项目..."
    git clone https://github.com/avacx/podcast.git "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# 7. 安装 Node.js 依赖
echo "📦 安装 Node.js 依赖..."
npm install

# 8. 创建 Python 虚拟环境
echo "🐍 创建 Python 虚拟环境..."
python3 -m venv venv
source venv/bin/activate

# 9. 安装 Python 依赖 (GPU 版本)
echo "📦 安装 Faster-Whisper (CUDA 版本)..."
pip install --upgrade pip
pip install faster-whisper

# 验证 CUDA 支持
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')" 2>/dev/null || echo "PyTorch CUDA check skipped"

# 10. 创建 GPU 版本的 .env 文件
echo "⚙️ 创建配置文件..."
cat > .env << 'EOF'
# Server Configuration
PORT=3000
HOST=0.0.0.0

# Whisper Configuration (GPU)
USE_LOCAL_WHISPER=true
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16

# Optional: OpenAI API (disabled for now)
# OPENAI_API_KEY=your-key
# OPENAI_BASE_URL=https://api.openai.com/v1
EOF

echo "✅ 配置文件已创建"

# 11. 预下载 Whisper 模型
echo "📥 预下载 Whisper large-v3 模型 (约 3GB)..."
python3 -c "
from faster_whisper import WhisperModel
print('正在下载 large-v3 模型...')
model = WhisperModel('large-v3', device='cuda', compute_type='float16')
print('✅ 模型下载完成')
"

# 12. 创建 systemd 服务
echo "🔧 创建系统服务..."
sudo tee /etc/systemd/system/podcast-transcriber.service > /dev/null << EOF
[Unit]
Description=Podcast Transcriber Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment=PATH=$PROJECT_DIR/venv/bin:/usr/local/cuda/bin:/usr/bin
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable podcast-transcriber
sudo systemctl start podcast-transcriber

echo ""
echo "============================================"
echo "✅ 部署完成！"
echo "============================================"
echo ""
echo "📍 服务状态: sudo systemctl status podcast-transcriber"
echo "📍 查看日志: sudo journalctl -u podcast-transcriber -f"
echo "📍 重启服务: sudo systemctl restart podcast-transcriber"
echo ""
echo "🌐 访问地址: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "⚠️ 如果需要外网访问，请确保防火墙开放 3000 端口:"
echo "   sudo ufw allow 3000"
echo ""
