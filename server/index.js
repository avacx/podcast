const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const { processAudioWithOpenAI } = require('./services/openaiService');
const { downloadPodcastAudio } = require('./services/podcastService');
const { getAudioFiles, estimateAudioDuration } = require('./services/audioInfoService');
const { cleanupAudioFiles } = require('./utils/fileSaver');
const { formatSizeKB, formatSizeMB, estimateAudioDurationFromSize } = require('./utils/formatUtils');
const { taskQueue } = require('./services/queueService');

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 创建临时文件夹
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// 文件上传配置
const upload = multer({
    dest: tempDir,
    limits: {
        fileSize: (process.env.MAX_FILE_SIZE || 50) * 1024 * 1024 // 默认50MB
    }
});

// 进度推送存储
const progressClients = new Map();

// SSE 进度推送端点
app.get('/api/progress/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    console.log(`🔌 新的SSE连接: sessionId=${sessionId}`);
    
    // 设置 SSE 头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 存储客户端连接
    progressClients.set(sessionId, res);
    console.log(`📝 已存储客户端连接，当前连接数: ${progressClients.size}`);
    
    // 发送初始连接确认
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
    
    // 客户端断开连接时清理
    req.on('close', () => {
        console.log(`🔌 SSE连接断开: sessionId=${sessionId}`);
        progressClients.delete(sessionId);
    });
});

// 发送进度更新的辅助函数
function sendProgress(sessionId, progress, stage, stageText) {
    console.log(`📊 尝试发送进度: sessionId=${sessionId}, progress=${progress}%, stage=${stage}, text=${stageText}`);
    const client = progressClients.get(sessionId);
    if (client) {
        const data = {
            type: 'progress',
            progress: Math.round(progress),
            stage,
            stageText
        };
        console.log(`✅ 发送进度更新: ${JSON.stringify(data)}`);
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    } else {
        console.log(`❌ 未找到 sessionId=${sessionId} 的客户端连接`);
    }
}

// 发送日志消息到前端
function sendLog(sessionId, message) {
    const client = progressClients.get(sessionId);
    if (client) {
        const data = {
            type: 'log',
            message: message
        };
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

// API路由
app.post('/api/process-podcast', async (req, res) => {
    try {
        const { url, operation, audioLanguage, outputLanguage, sessionId } = req.body;

        console.log('处理播客请求:', {
            url,
            operation,
            audioLanguage,
            outputLanguage,
            sessionId
        });

        // 验证输入
        if (!url) {
            return res.status(400).json({
                success: false,
                error: '播客链接是必需的 / Podcast URL is required'
            });
        }

        if (!['transcribe_only', 'transcribe_summarize'].includes(operation)) {
            return res.status(400).json({
                success: false,
                error: '无效的操作类型 / Invalid operation type'
            });
        }

        // 步骤1: 下载音频文件
        console.log('下载音频文件...');
        if (sessionId) {
            const stageText = outputLanguage === 'zh' ? '处理音频' : 'Processing Audio';
            sendProgress(sessionId, 10, 'download', stageText);
        }
        
        const podcastInfo = await downloadPodcastAudio(url);
        
        if (!podcastInfo || !podcastInfo.audioFilePath) {
            return res.status(400).json({
                success: false,
                error: '无法下载音频文件，请检查链接是否有效 / Unable to download audio file, please check if the link is valid'
            });
        }

        const originalAudioPath = podcastInfo.audioFilePath;
        const podcastTitle = podcastInfo.title || 'Untitled Podcast';

        // 步骤2: 基于文件大小估算时长（用于初始预估）
        console.log('📊 估算音频时长...');
        if (sessionId) {
            const stageText = outputLanguage === 'zh' ? '处理音频' : 'Processing Audio';
            sendProgress(sessionId, 20, 'download', stageText);
        }
        
        const estimatedDuration = await estimateAudioDuration(originalAudioPath);
        console.log(`🎯 预估时长: ${Math.round(estimatedDuration / 60)} 分钟 ${Math.round(estimatedDuration % 60)} 秒`);

        // 步骤3: 获取音频文件信息
        console.log('🔍 获取音频文件信息...');
        const audioFiles = await getAudioFiles(originalAudioPath);
        
        const shouldSummarize = operation === 'transcribe_summarize';
        console.log(`📋 处理模式: ${shouldSummarize ? '转录+总结' : '仅转录'}`);
        
        // 步骤4: 使用本地Whisper处理音频
        console.log(`🤖 本地转录处理 ${audioFiles.length} 个音频文件...`);
        if (sessionId) {
            const stageText = outputLanguage === 'zh' ? '转录' : 'Transcription';
            sendProgress(sessionId, 30, 'transcription', stageText);
        }
        
        // 创建发送日志的回调函数
        const sendLogCallback = (message) => sendLog(sessionId, message);
        
        const result = await processAudioWithOpenAI(audioFiles, shouldSummarize, outputLanguage, tempDir, audioLanguage, url, sessionId, sendProgress, podcastTitle, sendLogCallback);

        // 步骤4: 获取保存的文件信息
        const savedFiles = result.savedFiles || [];
        console.log(`✅ 处理完成，共保存 ${savedFiles.length} 个文件`);
        
        // 打印保存的文件详情
        savedFiles.forEach(file => {
            console.log(`📁 ${file.type}: ${file.filename} (${formatSizeKB(file.size)})`);
        });

        // 步骤5: 清理音频临时文件
        cleanupAudioFiles(originalAudioPath, audioFiles);

        // 发送完成进度
        if (sessionId) {
            const stageText = outputLanguage === 'zh' ? '处理完成' : 'Complete';
            sendProgress(sessionId, 100, 'complete', stageText);
        }

        // 返回结果（包含估算和真实时长）
        res.json({
            success: true,
            data: {
                ...result,
                podcastTitle: podcastTitle, // 播客标题
                estimatedDuration: estimatedDuration, // 估算时长（秒）
                actualDuration: result.audioDuration || result.duration, // 从Whisper获取的真实时长
                savedFiles: savedFiles
            }
        });

    } catch (error) {
        console.error('处理播客时出错:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误 / Internal server error'
        });
    }
});

// 本地文件处理端点
app.post('/api/process-local-file', async (req, res) => {
    try {
        const { filename, operation = 'transcribe_only', outputLanguage = 'zh' } = req.body;
        
        if (!filename) {
            return res.status(400).json({
                success: false,
                error: '缺少文件名参数'
            });
        }
        
        const filePath = path.join(tempDir, filename);
        
        // 安全检查：确保文件在temp目录内
        if (!filePath.startsWith(tempDir)) {
            return res.status(400).json({
                success: false,
                error: '无效的文件路径'
            });
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: '文件未找到'
            });
        }
        
        console.log(`📂 处理本地文件: ${filename}`);
        console.log(`📋 处理模式: ${operation === 'transcribe_summarize' ? '转录+总结' : '仅转录'}`);
        
        const shouldSummarize = operation === 'transcribe_summarize';
        
        // 使用本地Whisper处理音频
        console.log(`🤖 本地转录处理文件: ${filename}`);
        const result = await processAudioWithOpenAI([filePath], shouldSummarize, outputLanguage, tempDir, audioLanguage, null);

        // 获取保存的文件信息
        const savedFiles = result.savedFiles || [];
        console.log(`✅ 处理完成，共保存 ${savedFiles.length} 个文件`);
        
        // 打印保存的文件详情
        savedFiles.forEach(file => {
            console.log(`📁 ${file.type}: ${file.filename} (${formatSizeKB(file.size)})`);
        });
        
        // 返回结果
        res.json({
            success: true,
            data: {
                ...result,
                savedFiles: savedFiles
            }
        });
        
    } catch (error) {
        console.error('本地文件处理失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '本地文件处理失败'
        });
    }
});

// 获取temp目录文件列表端点
app.get('/api/temp-files', (req, res) => {
    try {
        const files = fs.readdirSync(tempDir)
            .filter(file => 
                // 音频文件
                file.endsWith('.m4a') || file.endsWith('.mp3') || file.endsWith('.wav') ||
                // 转录和总结文件
                file.endsWith('_transcript.md') || file.endsWith('_summary.md') ||
                // 其他文本文件
                file.endsWith('.txt') || file.endsWith('.md')
            )
            .map(file => {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.ctime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => b.modified - a.modified);
            
        res.json({
            success: true,
            files: files
        });
        
    } catch (error) {
        console.error('获取文件列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取文件列表失败'
        });
    }
});

// 文件下载端点
app.get('/api/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(tempDir, filename);

        // 安全检查：确保文件在temp目录内
        if (!filePath.startsWith(tempDir)) {
            return res.status(400).json({
                success: false,
                error: '无效的文件路径'
            });
        }

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: '文件未找到'
            });
        }

        // 设置下载响应头 - 对文件名进行 URL 编码以支持中文
        const encodedFilename = encodeURIComponent(filename);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        // 发送文件
        res.sendFile(filePath);

    } catch (error) {
        console.error('文件下载失败:', error);
        res.status(500).json({
            success: false,
            error: '文件下载失败'
        });
    }
});

// 批量导出 - 打包所有转录文件为 ZIP
app.get('/api/download-all', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // 获取所有转录和总结文件（修正匹配规则）
        const files = fs.readdirSync(tempDir).filter(file => 
            (file.startsWith('raw_') && file.endsWith('.md')) ||
            (file.startsWith('summary_') && file.endsWith('.md')) ||
            file.includes('_transcript') ||
            file.includes('_summary')
        );
        
        if (files.length === 0) {
            return res.status(404).json({
                success: false,
                error: '没有可导出的文件'
            });
        }
        
        console.log(`📦 批量导出 ${files.length} 个文件:`, files);
        
        // 创建 ZIP 文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipFileName = `podcast_transcripts_${timestamp}.zip`;
        const zipFilePath = path.join(tempDir, zipFileName);
        
        // 删除可能存在的旧 ZIP 文件
        if (fs.existsSync(zipFilePath)) {
            fs.unlinkSync(zipFilePath);
        }
        
        // 使用系统 zip 命令打包文件（处理特殊字符）
        const fileListFile = path.join(tempDir, '.filelist.txt');
        fs.writeFileSync(fileListFile, files.join('\n'));
        
        try {
            await execAsync(`cd "${tempDir}" && zip -j "${zipFileName}" -@ < .filelist.txt`);
        } catch (zipError) {
            // 如果 -@ 不支持，尝试另一种方式
            console.log('尝试备用 zip 方法...');
            const escapedFiles = files.map(f => `'${f.replace(/'/g, "'\\''")}'`).join(' ');
            await execAsync(`cd "${tempDir}" && zip -j "${zipFileName}" ${escapedFiles}`);
        }
        
        // 清理临时文件列表
        if (fs.existsSync(fileListFile)) {
            fs.unlinkSync(fileListFile);
        }
        
        // 检查 ZIP 是否创建成功
        if (!fs.existsSync(zipFilePath)) {
            throw new Error('ZIP 文件创建失败');
        }
        
        const zipStats = fs.statSync(zipFilePath);
        console.log(`✅ ZIP 文件创建成功: ${zipFileName} (${(zipStats.size/1024).toFixed(1)}KB)`);
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        res.setHeader('Content-Length', zipStats.size);
        
        // 发送文件并在完成后删除
        const fileStream = fs.createReadStream(zipFilePath);
        fileStream.pipe(res);
        
        fileStream.on('end', () => {
            // 删除临时 ZIP 文件
            try {
                fs.unlinkSync(zipFilePath);
                console.log(`🗑️ 已清理临时 ZIP 文件`);
            } catch (e) {
                console.warn('清理 ZIP 文件失败:', e.message);
            }
        });
        
    } catch (error) {
        console.error('批量导出失败:', error);
        res.status(500).json({
            success: false,
            error: '批量导出失败: ' + error.message
        });
    }
});

// 批量导出指定任务的文件
app.post('/api/download-selected', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { filenames } = req.body;
        
        if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请提供要导出的文件列表'
            });
        }
        
        // 验证文件存在
        const validFiles = filenames.filter(filename => {
            const filePath = path.join(tempDir, filename);
            return filePath.startsWith(tempDir) && fs.existsSync(filePath);
        });
        
        if (validFiles.length === 0) {
            return res.status(404).json({
                success: false,
                error: '没有找到有效的文件'
            });
        }
        
        console.log(`📦 导出选中的 ${validFiles.length} 个文件`);
        
        // 创建 ZIP 文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipFileName = `podcast_selected_${timestamp}.zip`;
        const zipFilePath = path.join(tempDir, zipFileName);
        
        if (fs.existsSync(zipFilePath)) {
            fs.unlinkSync(zipFilePath);
        }
        
        // 使用文件列表方式处理特殊字符
        const fileListFile = path.join(tempDir, '.filelist_selected.txt');
        fs.writeFileSync(fileListFile, validFiles.join('\n'));
        
        try {
            await execAsync(`cd "${tempDir}" && zip -j "${zipFileName}" -@ < .filelist_selected.txt`);
        } catch (zipError) {
            const escapedFiles = validFiles.map(f => `'${f.replace(/'/g, "'\\''")}'`).join(' ');
            await execAsync(`cd "${tempDir}" && zip -j "${zipFileName}" ${escapedFiles}`);
        }
        
        if (fs.existsSync(fileListFile)) {
            fs.unlinkSync(fileListFile);
        }
        
        if (!fs.existsSync(zipFilePath)) {
            throw new Error('ZIP 文件创建失败');
        }
        
        const zipStats = fs.statSync(zipFilePath);
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        res.setHeader('Content-Length', zipStats.size);
        
        const fileStream = fs.createReadStream(zipFilePath);
        fileStream.pipe(res);
        
        fileStream.on('end', () => {
            try {
                fs.unlinkSync(zipFilePath);
            } catch (e) {
                console.warn('清理 ZIP 文件失败:', e.message);
            }
        });
        
    } catch (error) {
        console.error('批量导出失败:', error);
        res.status(500).json({
            success: false,
            error: '批量导出失败: ' + error.message
        });
    }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 音频时长预估端点 - 轻量级，只获取文件大小
app.post('/api/estimate-duration', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: '请提供音频链接'
            });
        }

        console.log(`🔍 轻量级预估音频时长: ${url}`);
        
        // 使用 HEAD 请求获取文件大小，不下载完整文件
        const headResponse = await axios.head(url, {
            timeout: 10000, // 10秒超时
            maxRedirects: 5
        });
        
        const contentLength = parseInt(headResponse.headers['content-length'] || '0');
        if (contentLength > 0) {
            // 基于文件大小估算时长（使用统一工具函数）
            const estimatedDuration = estimateAudioDurationFromSize(contentLength);
            
            console.log(`📊 文件大小: ${formatSizeMB(contentLength)}，预估时长: ${Math.round(estimatedDuration / 60)} 分钟`);
            
            res.json({
                success: true,
                estimatedDuration: estimatedDuration // 返回秒数
            });
        } else {
            // 无法获取文件大小，返回默认估算
            console.log(`⚠️ 无法获取文件大小，使用默认估算`);
            res.json({
                success: true,
                estimatedDuration: 600 // 默认10分钟
            });
        }
        
    } catch (error) {
        console.error('❌ 预估音频时长失败:', error);
        // 失败时返回默认估算，不阻塞主流程
        res.json({
            success: true,
            estimatedDuration: 600 // 默认10分钟
        });
    }
});

// ========================================
// 批量处理 API - 任务队列系统
// ========================================

// 批量添加任务到队列
app.post('/api/queue/batch', async (req, res) => {
    try {
        const { urls, operation = 'transcribe_only', audioLanguage = 'auto', outputLanguage = 'zh' } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请提供有效的链接数组'
            });
        }

        // 过滤空链接
        const validUrls = urls.filter(url => url && url.trim());
        
        if (validUrls.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有有效的链接'
            });
        }

        console.log(`📥 批量添加 ${validUrls.length} 个任务到队列`);

        // 为每个URL创建任务
        const tasks = validUrls.map(url => ({
            url: url.trim(),
            operation,
            audioLanguage,
            outputLanguage,
            processor: createTaskProcessor(operation, audioLanguage, outputLanguage)
        }));

        // 添加到队列
        const queuedTasks = taskQueue.addBatchTasks(tasks);

        res.json({
            success: true,
            message: `已添加 ${queuedTasks.length} 个任务到队列`,
            tasks: queuedTasks.map(t => ({
                id: t.id,
                url: t.url,
                position: t.position,
                status: t.status
            })),
            queueStatus: taskQueue.getStatus()
        });

    } catch (error) {
        console.error('批量添加任务失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '批量添加任务失败'
        });
    }
});

// 获取队列状态
app.get('/api/queue/status', (req, res) => {
    res.json({
        success: true,
        ...taskQueue.getStatus()
    });
});

// 获取单个任务详情
app.get('/api/queue/task/:taskId', (req, res) => {
    const task = taskQueue.getTask(req.params.taskId);
    
    if (!task) {
        return res.status(404).json({
            success: false,
            error: '任务未找到'
        });
    }

    res.json({
        success: true,
        task: {
            id: task.id,
            url: task.url,
            status: task.status,
            progress: task.progress,
            stage: task.stage,
            stageText: task.stageText,
            position: task.position,
            queuedAt: task.queuedAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            error: task.error,
            result: task.status === 'completed' ? {
                savedFiles: task.result?.savedFiles,
                podcastTitle: task.result?.podcastTitle
            } : undefined
        }
    });
});

// 取消队列中的任务
app.delete('/api/queue/task/:taskId', (req, res) => {
    const cancelled = taskQueue.cancelTask(req.params.taskId);
    
    res.json({
        success: cancelled,
        message: cancelled ? '任务已取消' : '无法取消该任务（可能正在处理或已完成）'
    });
});

// 清空队列
app.delete('/api/queue/all', (req, res) => {
    const count = taskQueue.clearQueue();
    
    res.json({
        success: true,
        message: `已取消 ${count} 个排队中的任务`
    });
});

// SSE 端点：订阅队列状态更新
app.get('/api/queue/subscribe', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // 发送初始状态
    res.write(`data: ${JSON.stringify({ type: 'status', ...taskQueue.getStatus() })}\n\n`);

    // 定期发送状态更新
    const intervalId = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'status', ...taskQueue.getStatus() })}\n\n`);
    }, 2000);

    // 客户端断开时清理
    req.on('close', () => {
        clearInterval(intervalId);
    });
});

/**
 * 创建任务处理器
 */
function createTaskProcessor(operation, audioLanguage, outputLanguage) {
    return async (task, progressCallback) => {
        const sessionId = task.id;
        
        console.log(`🎯 处理任务: ${task.url}`);
        
        // 步骤1: 下载音频
        progressCallback(10, 'download', '下载音频');
        const podcastInfo = await downloadPodcastAudio(task.url);
        
        if (!podcastInfo || !podcastInfo.audioFilePath) {
            throw new Error('无法下载音频文件');
        }

        const originalAudioPath = podcastInfo.audioFilePath;
        const podcastTitle = podcastInfo.title || 'Untitled Podcast';

        // 步骤2: 估算时长
        progressCallback(20, 'analyze', '分析音频');
        const estimatedDuration = await estimateAudioDuration(originalAudioPath);

        // 步骤3: 获取音频文件信息
        const audioFiles = await getAudioFiles(originalAudioPath);
        const shouldSummarize = operation === 'transcribe_summarize';

        // 步骤4: 转录处理
        progressCallback(30, 'transcription', '转录中');
        
        const sendLogCallback = (message) => {
            console.log(`[${task.id}] ${message}`);
        };
        
        const result = await processAudioWithOpenAI(
            audioFiles, 
            shouldSummarize, 
            outputLanguage, 
            tempDir, 
            audioLanguage, 
            task.url, 
            sessionId, 
            progressCallback,
            podcastTitle, 
            sendLogCallback
        );

        // 步骤5: 清理
        progressCallback(95, 'cleanup', '清理临时文件');
        cleanupAudioFiles(originalAudioPath, audioFiles);

        progressCallback(100, 'complete', '完成');

        return {
            ...result,
            podcastTitle,
            estimatedDuration,
            actualDuration: result.audioDuration || result.duration
        };
    };
}

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('未处理的错误:', error);
    res.status(500).json({
        success: false,
        error: '服务器内部错误 / Internal server error'
    });
});

// 404处理
app.use((req, res) => {
    if (req.url.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            error: 'API端点未找到 / API endpoint not found'
        });
    } else {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
});

// 启动服务器（简化版端口处理）
function startServer() {
    const server = app.listen(DEFAULT_PORT, () => {
        console.log(`🎙️ Podcast提取器服务器运行在 http://localhost:${DEFAULT_PORT}`);
        console.log(`🎙️ Podcast Transcriber server running on http://localhost:${DEFAULT_PORT}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`端口 ${DEFAULT_PORT} 被占用，尝试端口 ${DEFAULT_PORT + 1}...`);
            const altServer = app.listen(DEFAULT_PORT + 1, () => {
                console.log(`🎙️ Podcast提取器服务器运行在 http://localhost:${DEFAULT_PORT + 1}`);
                console.log(`🎙️ Podcast Transcriber server running on http://localhost:${DEFAULT_PORT + 1}`);
            });
            
            altServer.on('error', (altErr) => {
                if (altErr.code === 'EADDRINUSE') {
                    console.log(`端口 ${DEFAULT_PORT + 1} 也被占用，尝试端口 ${DEFAULT_PORT + 2}...`);
                    app.listen(DEFAULT_PORT + 2, () => {
                        console.log(`🎙️ Podcast提取器服务器运行在 http://localhost:${DEFAULT_PORT + 2}`);
                        console.log(`🎙️ Podcast Transcriber server running on http://localhost:${DEFAULT_PORT + 2}`);
                    });
                } else {
                    console.error('启动服务器失败:', altErr);
                    process.exit(1);
                }
            });
        } else {
            console.error('启动服务器失败:', err);
            process.exit(1);
        }
    });
}

startServer();
