<div align="center">
  
# 🎙️ Podcast Transcriber

[English](#english) | [中文](#中文)

将播客音频转录为文字的开源工具，支持本地 Whisper 转录，GPU 加速。

</div>

---

<a name="中文"></a>
## 中文文档

### 功能特点

- **🎤 本地转录**: 使用 Faster-Whisper 本地转录，无需依赖云服务
- **🚀 GPU 加速**: 支持 NVIDIA GPU (CUDA)，4090 转录 1 小时音频仅需 2-3 分钟
- **🔗 多平台支持**: 支持小宇宙、Apple Podcasts、RSS 订阅源、直接音频链接
- **📱 响应式设计**: 支持桌面和移动端访问
- **💾 一键下载**: 转录完成后可直接下载 Markdown 格式的文字稿

### 性能对比

| 设备 | 模型 | 10分钟音频 | 1小时音频 |
|------|------|-----------|----------|
| CPU (M2 Mac) | base | ~3-5分钟 | ~20-30分钟 |
| 4090 GPU | base | ~5-10秒 | ~30-60秒 |
| 4090 GPU | large-v3 | ~15-30秒 | ~2-3分钟 |

---

### 快速开始 (本地 CPU 版)

#### 环境要求

- Node.js 18+
- Python 3.8+
- ffmpeg

#### 安装步骤

```bash
# 克隆项目
git clone https://github.com/avacx/podcast.git
cd podcast

# 安装 Node.js 依赖
npm install

# 创建 Python 虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装 Faster-Whisper
pip install faster-whisper

# 配置环境变量
cp .env.example .env

# 启动服务
npm start
```

访问 http://localhost:3000

---

### GPU 服务器部署 (Ubuntu + NVIDIA GPU)

推荐使用 NVIDIA GPU 服务器（如 4090）获得最佳性能。

#### 方法一：自动部署脚本

```bash
# 1. 上传项目到服务器
scp -r podcast user@your-server:~/

# 2. SSH 登录服务器
ssh user@your-server

# 3. 运行部署脚本
cd ~/podcast
chmod +x deploy/setup-gpu-server.sh
./deploy/setup-gpu-server.sh
```

#### 方法二：手动部署

```bash
# 安装系统依赖
sudo apt update
sudo apt install -y curl git ffmpeg python3 python3-pip python3-venv nodejs npm

# 确认 NVIDIA 驱动
nvidia-smi

# 克隆项目
git clone https://github.com/avacx/podcast.git
cd podcast

# 安装依赖
npm install
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper

# 配置 GPU 环境变量
cp deploy/.env.gpu.example .env

# 启动服务
npm start
```

#### 本地访问远程服务器

部署完成后，在本地浏览器访问：
```
http://服务器IP:3000
```

确保防火墙开放 3000 端口：
```bash
sudo ufw allow 3000
```

---

### 环境变量配置

#### CPU 版本 (.env)
```env
PORT=3000
USE_LOCAL_WHISPER=true
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

#### GPU 版本 (.env)
```env
PORT=3000
HOST=0.0.0.0
USE_LOCAL_WHISPER=true
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
```

#### 模型选择

| 模型 | 精度 | 速度 | 显存占用 |
|------|------|------|---------|
| tiny | 低 | 最快 | ~1GB |
| base | 中 | 快 | ~1GB |
| small | 中高 | 中等 | ~2GB |
| medium | 高 | 较慢 | ~5GB |
| large-v3 | 最高 | 慢 | ~10GB |

4090 显卡推荐使用 `large-v3` 获得最佳转录质量。

---

### 项目结构

```
podcast/
├── public/                 # 前端页面
│   ├── index.html
│   └── script.js
├── server/                 # 后端服务
│   ├── index.js           # Express 服务器
│   ├── whisper_transcribe.py  # Whisper 转录脚本
│   └── services/          # 业务逻辑
├── deploy/                 # 部署相关
│   ├── setup-gpu-server.sh    # GPU 服务器部署脚本
│   ├── .env.gpu.example       # GPU 配置模板
│   └── DEPLOY_GPU.md          # 详细部署文档
├── .env.example            # 环境变量模板
└── package.json
```

---

### 常见问题

**Q: 提示 `venv/bin/python: No such file or directory`**

A: 需要创建 Python 虚拟环境：
```bash
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper
```

**Q: GPU 版本提示 CUDA 不可用**

A: 检查 NVIDIA 驱动和 CUDA：
```bash
nvidia-smi
python3 -c "import torch; print(torch.cuda.is_available())"
```

**Q: 首次转录很慢**

A: 首次运行需要下载 Whisper 模型文件，后续会使用缓存。

---

### License

Apache 2.0 License

---

<a name="english"></a>
## English Documentation

### Features

- **🎤 Local Transcription**: Uses Faster-Whisper for local transcription, no cloud dependency
- **🚀 GPU Acceleration**: Supports NVIDIA GPU (CUDA), 4090 transcribes 1-hour audio in 2-3 minutes
- **🔗 Multi-Platform**: Supports Xiaoyuzhou, Apple Podcasts, RSS feeds, direct audio URLs
- **📱 Responsive Design**: Works on desktop and mobile
- **💾 One-Click Download**: Download transcripts in Markdown format

### Quick Start (Local CPU)

```bash
# Clone
git clone https://github.com/avacx/podcast.git
cd podcast

# Install dependencies
npm install
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper

# Configure
cp .env.example .env

# Start
npm start
```

Visit http://localhost:3000

### GPU Server Deployment

See [deploy/DEPLOY_GPU.md](deploy/DEPLOY_GPU.md) for detailed instructions.

```bash
# Quick deploy on Ubuntu + NVIDIA GPU
chmod +x deploy/setup-gpu-server.sh
./deploy/setup-gpu-server.sh
```

### Environment Variables

```env
# GPU Configuration
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
```

### License

Apache 2.0 License
