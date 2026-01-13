# Ubuntu 22.04 + NVIDIA 4090D GPU 部署指南

## 速度对比

| 设备 | 模型 | 10分钟音频 | 1小时音频 |
|------|------|-----------|----------|
| CPU (M2) | base | ~3-5分钟 | ~20-30分钟 |
| 4090D GPU | base | ~5-10秒 | ~30-60秒 |
| 4090D GPU | large-v3 | ~15-30秒 | ~2-3分钟 |

## 方法一：自动部署脚本

```bash
# 1. 上传项目到服务器
scp -r podcast-transcriber user@your-server:/home/user/

# 2. SSH 登录服务器
ssh user@your-server

# 3. 运行部署脚本
cd ~/podcast-transcriber
chmod +x deploy/setup-gpu-server.sh
./deploy/setup-gpu-server.sh
```

## 方法二：手动部署

### 1. 安装系统依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础依赖
sudo apt install -y curl git ffmpeg python3 python3-pip python3-venv

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. 确认 NVIDIA 驱动和 CUDA

```bash
# 检查驱动
nvidia-smi

# 如果没有安装驱动
sudo apt install -y nvidia-driver-535

# 安装 CUDA Toolkit
sudo apt install -y nvidia-cuda-toolkit

# 安装 cuDNN
sudo apt install -y libcudnn8 libcudnn8-dev
```

### 3. 上传项目文件

```bash
# 从本地上传（在本地执行）
scp -r podcast-transcriber user@your-server:~/

# 或者使用 rsync（更快，支持断点续传）
rsync -avz --progress podcast-transcriber user@your-server:~/
```

### 4. 安装项目依赖

```bash
cd ~/podcast-transcriber

# 安装 Node.js 依赖
npm install

# 创建 Python 虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装 Faster-Whisper (GPU版本)
pip install faster-whisper
```

### 5. 配置环境变量

```bash
# 复制 GPU 配置模板
cp deploy/.env.gpu.example .env

# 根据需要编辑配置
nano .env
```

### 6. 预下载模型（可选但推荐）

```bash
source venv/bin/activate
python3 -c "
from faster_whisper import WhisperModel
print('下载 large-v3 模型...')
model = WhisperModel('large-v3', device='cuda', compute_type='float16')
print('完成!')
"
```

### 7. 启动服务

```bash
# 前台运行（测试用）
node server/index.js

# 或使用 PM2（生产环境推荐）
npm install -g pm2
pm2 start server/index.js --name podcast-transcriber
pm2 save
pm2 startup
```

### 8. 配置防火墙

```bash
# 开放端口
sudo ufw allow 3000

# 或者使用 iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

## 本地访问

部署完成后，在你的本地浏览器访问：

```
http://服务器IP:3000
```

例如：`http://192.168.1.100:3000`

## 使用 Nginx 反向代理（可选）

如果需要域名访问或 HTTPS：

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/podcast-transcriber << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        
        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/podcast-transcriber /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs podcast-transcriber

# 重启服务
pm2 restart podcast-transcriber

# 查看 GPU 使用情况
nvidia-smi

# 实时监控 GPU
watch -n 1 nvidia-smi
```

## 故障排除

### 1. CUDA 不可用
```bash
# 检查 CUDA
python3 -c "import torch; print(torch.cuda.is_available())"

# 如果返回 False，检查驱动
nvidia-smi
```

### 2. 模型下载失败
```bash
# 手动下载模型
pip install huggingface_hub
huggingface-cli download Systran/faster-whisper-large-v3
```

### 3. 内存不足
```bash
# 使用更小的模型
# 修改 .env: WHISPER_MODEL=medium
```

### 4. 端口被占用
```bash
# 查找占用端口的进程
lsof -i:3000

# 杀死进程
kill -9 <PID>
```
