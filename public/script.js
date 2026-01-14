// 双语内容配置
const translations = {
    zh: {
        title: "Podcast提取器",
        subtitle: "只需提供Podcast音频链接，即可获得高质量的文字转录和AI智能总结",
        urlLabel: "Podcast音频链接",
        urlHelper: "支持 Apple Podcasts、小宇宙、RSS订阅源和直接音频链接",
        operationLabel: "操作类型",
        option1Title: "转录并总结",
        option1Desc: "获得转录文本和AI总结",
        option2Title: "仅转录",
        option2Desc: "只获得转录文本",
        audioLangLabel: "音频语言",
        outputLangLabel: "总结语言",
        autoDetect: "自动检测",
        chineseOption: "中文",
        englishOption: "English",
        submitText: "🚀 开始处理",
        resultsTitle: "处理结果",
        transcriptTitle: "转录文本",
        summaryTitle: "AI总结",
        translationTitle: "翻译",
        loadingText: "正在处理您的播客...",
        errorText: "处理过程中出现错误",
        estimatedTime: "预计需要 3-8 分钟...",
        processingTips: "处理中，请耐心等待：",
        tipKeepOpen: "页面请保持打开状态",
        tipLargeFile: "大文件需要更长时间处理",
        tipAutoShow: "处理完成后会自动显示结果",
        stepDownload: "下载音频文件",
        stepTranscribe: "AI语音转录中...",
        stepSummarize: "生成智能总结",
        processingComplete: "处理完成！",
        remainingTime: "预计还需",
        minutes: "分钟",
        almostDone: "即将完成...",
        langFlag: "🇨🇳",
        langText: "中文",
        batchMode: "批量模式",
        singleMode: "单个模式",
        queueTitle: "任务队列",
        processing: "正在处理",
        queued: "排队中",
        completed: "已完成",
        failed: "失败",
        cancelled: "已取消",
        position: "位置"
    },
    en: {
        title: "Podcast Transcriber",
        subtitle: "Just provide a podcast audio link to get high-quality transcription and AI-powered summary",
        urlLabel: "Podcast Audio Link",
        urlHelper: "Supports Apple Podcasts, RSS feeds, Xiaoyuzhou, and direct audio links",
        operationLabel: "Operation Type",
        option1Title: "Transcribe & Summarize",
        option1Desc: "Get transcription and AI summary",
        option2Title: "Transcribe Only",
        option2Desc: "Get transcription text only",
        audioLangLabel: "Audio Language",
        outputLangLabel: "Summary Language",
        autoDetect: "Auto Detect",
        chineseOption: "Chinese",
        englishOption: "English",
        submitText: "🚀 Start Processing",
        resultsTitle: "Results",
        transcriptTitle: "Transcript",
        summaryTitle: "AI Summary",
        translationTitle: "Translation",
        loadingText: "Processing your podcast...",
        errorText: "An error occurred during processing",
        estimatedTime: "Estimated 3-8 minutes...",
        processingTips: "Processing, please wait patiently:",
        tipKeepOpen: "Keep this page open",
        tipLargeFile: "Large files require more processing time",
        tipAutoShow: "Results will display automatically when complete",
        stepDownload: "Download audio file",
        stepTranscribe: "AI transcription in progress...",
        stepSummarize: "Generate smart summary",
        processingComplete: "Processing complete!",
        remainingTime: "Estimated",
        minutes: "minutes remaining",
        almostDone: "Almost done...",
        langFlag: "🇺🇸",
        langText: "English",
        batchMode: "Batch Mode",
        singleMode: "Single Mode",
        queueTitle: "Task Queue",
        processing: "Processing",
        queued: "Queued",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
        position: "Position"
    }
};

// 批量模式状态
let isBatchMode = false;
let queueEventSource = null;

// 检测浏览器语言设置
function detectBrowserLanguage() {
    // 尝试从localStorage获取用户之前的选择
    const savedLang = localStorage.getItem('podcast-transcriber-language');
    if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
        return savedLang;
    }
    
    // 检测浏览器语言
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    
    // 如果是中文（包括简体、繁体、香港、台湾等），返回中文
    if (browserLang.toLowerCase().startsWith('zh')) {
        return 'zh';
    }
    
    // 默认返回英文
    return 'en';
}

// 当前语言状态 - 根据浏览器语言自动检测
let currentLang = detectBrowserLanguage();

// 语言切换功能
function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    
    // 保存用户的语言选择
    localStorage.setItem('podcast-transcriber-language', currentLang);
    
    updateUI();
    updateLanguageToggle();
    
    // 更新HTML lang属性
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
}

// 更新UI文本
function updateUI() {
    const texts = translations[currentLang];
    
    // 更新所有文本元素
    Object.keys(texts).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (key === 'autoDetect' || key === 'chineseOption' || key === 'englishOption') {
                element.textContent = texts[key];
            } else {
                element.textContent = texts[key];
            }
        }
    });
    
    // 更新placeholder
    const urlInput = document.getElementById('podcastUrl');
    urlInput.placeholder = currentLang === 'zh' 
        ? 'https://example.com/podcast/episode'
        : 'https://example.com/podcast/example';
    
    // 更新进度页面的文本元素
    const progressElements = {
        'stepDownloadText': 'stepDownload',
        'stepTranscribeText': 'stepTranscribe', 
        'stepSummarizeText': 'stepSummarize',
        'processingTipsText': 'processingTips',
        'tipLargeFileText': 'tipLargeFile',
        'tipKeepOpenText': 'tipKeepOpen',
        'tipAutoShowText': 'tipAutoShow'
    };
    
    Object.keys(progressElements).forEach(elementId => {
        const element = document.getElementById(elementId);
        const textKey = progressElements[elementId];
        if (element && texts[textKey]) {
            element.textContent = texts[textKey];
        }
    });
    
    // 进度条现在由智能进度条系统统一管理，无需在此处更新
    
    // 如果有下载按钮显示，重新生成以更新语言
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection && !downloadSection.classList.contains('hidden')) {
        // 获取当前的savedFiles数据并重新生成下载按钮
        updateDownloadButtonsLanguage();
    }
    
    // 更新批量模式按钮文字
    const batchModeToggle = document.getElementById('batchModeToggle');
    if (batchModeToggle) {
        batchModeToggle.textContent = isBatchMode ? texts.singleMode : texts.batchMode;
    }

}

// ========================================
// 批量处理功能
// ========================================

// 切换批量模式
function toggleBatchMode() {
    isBatchMode = !isBatchMode;
    
    const singleInput = document.getElementById('singleUrlInput');
    const batchInput = document.getElementById('batchUrlInput');
    const batchToggle = document.getElementById('batchModeToggle');
    const podcastUrl = document.getElementById('podcastUrl');
    const texts = translations[currentLang];
    
    if (isBatchMode) {
        singleInput.classList.add('hidden');
        batchInput.classList.remove('hidden');
        batchToggle.textContent = texts.singleMode || '单个模式';
        podcastUrl.removeAttribute('required');
    } else {
        singleInput.classList.remove('hidden');
        batchInput.classList.add('hidden');
        batchToggle.textContent = texts.batchMode || '批量模式';
        podcastUrl.setAttribute('required', '');
    }
}

// 提交批量任务
async function submitBatchTasks(urls) {
    const audioLanguage = document.getElementById('audioLanguage').value;
    const outputLanguage = document.getElementById('outputLanguage').value;
    
    try {
        const response = await fetch('/api/queue/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                urls,
                operation: 'transcribe_only',
                audioLanguage,
                outputLanguage
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ 已添加 ${result.tasks.length} 个任务到队列`);
            showQueueSection();
            subscribeToQueue();
            // 清空输入
            document.getElementById('batchUrls').value = '';
        } else {
            alert(result.error || '添加任务失败');
        }
        
        return result;
    } catch (error) {
        console.error('批量提交失败:', error);
        alert('批量提交失败: ' + error.message);
    }
}

// 显示队列区域
function showQueueSection() {
    document.getElementById('queueSection').classList.remove('hidden');
}

// 隐藏队列区域
function hideQueueSection() {
    document.getElementById('queueSection').classList.add('hidden');
}

// 刷新队列状态
async function refreshQueueStatus() {
    try {
        const response = await fetch('/api/queue/status');
        const result = await response.json();
        
        if (result.success) {
            updateQueueUI(result);
        }
    } catch (error) {
        console.error('获取队列状态失败:', error);
    }
}

// 订阅队列更新（SSE）
function subscribeToQueue() {
    if (queueEventSource) {
        queueEventSource.close();
    }
    
    queueEventSource = new EventSource('/api/queue/subscribe');
    
    queueEventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'status') {
                updateQueueUI(data);
            }
        } catch (error) {
            console.error('解析队列状态失败:', error);
        }
    };
    
    queueEventSource.onerror = () => {
        console.log('队列 SSE 连接断开，5秒后重连...');
        setTimeout(subscribeToQueue, 5000);
    };
}

// 更新队列 UI
function updateQueueUI(status) {
    const texts = translations[currentLang];
    const currentTaskDiv = document.getElementById('currentTask');
    const queueList = document.getElementById('queueList');
    const emptyQueue = document.getElementById('emptyQueue');
    const completedSection = document.getElementById('completedSection');
    const completedList = document.getElementById('completedList');
    
    // 更新当前处理的任务
    if (status.processing) {
        currentTaskDiv.classList.remove('hidden');
        document.getElementById('currentTaskUrl').textContent = truncateUrl(status.processing.url);
        document.getElementById('currentTaskProgress').textContent = `${status.processing.progress || 0}%`;
        document.getElementById('currentTaskProgressBar').style.width = `${status.processing.progress || 0}%`;
        document.getElementById('currentTaskStage').textContent = status.processing.stageText || '';
    } else {
        currentTaskDiv.classList.add('hidden');
    }
    
    // 更新队列列表
    queueList.innerHTML = '';
    
    if (status.queue && status.queue.length > 0) {
        emptyQueue.classList.add('hidden');
        
        status.queue.forEach(task => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-slate-50 rounded-lg p-3';
            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-slate-600 truncate">${truncateUrl(task.url)}</p>
                    <p class="text-xs text-slate-400">${texts.position}: ${task.position}</p>
                </div>
                <button onclick="cancelTask('${task.id}')" class="ml-2 text-xs text-red-500 hover:text-red-700">
                    取消
                </button>
            `;
            queueList.appendChild(item);
        });
    } else if (!status.processing) {
        emptyQueue.classList.remove('hidden');
    }
    
    // 更新已完成列表
    if (status.recentCompleted && status.recentCompleted.length > 0) {
        completedSection.classList.remove('hidden');
        completedList.innerHTML = '';
        
        status.recentCompleted.slice(0, 5).forEach(task => {
            const item = document.createElement('div');
            const statusClass = task.status === 'completed' ? 'text-green-600' : 'text-red-600';
            const statusIcon = task.status === 'completed' ? '✅' : '❌';
            
            item.className = 'flex items-center justify-between text-sm py-1';
            item.innerHTML = `
                <span class="truncate flex-1 text-slate-500">${truncateUrl(task.url)}</span>
                <span class="${statusClass}">${statusIcon}</span>
            `;
            completedList.appendChild(item);
        });
    } else {
        completedSection.classList.add('hidden');
    }
    
    // 如果队列全空且没有处理中的任务，隐藏队列区域
    if (!status.processing && (!status.queue || status.queue.length === 0)) {
        // 保持显示，让用户可以看到已完成的任务
    }
}

// 截断 URL 显示
function truncateUrl(url, maxLength = 50) {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
}

// 取消任务
async function cancelTask(taskId) {
    try {
        const response = await fetch(`/api/queue/task/${taskId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            refreshQueueStatus();
        } else {
            alert(result.message || '取消失败');
        }
    } catch (error) {
        console.error('取消任务失败:', error);
    }
}

// 清空队列
async function clearQueue() {
    if (!confirm('确定要清空所有排队中的任务吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/queue/all', {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            refreshQueueStatus();
        }
    } catch (error) {
        console.error('清空队列失败:', error);
    }
}

// 批量导出所有文件
async function downloadAllFiles() {
    try {
        const response = await fetch('/api/temp-files');
        const result = await response.json();
        
        if (!result.success || !result.files || result.files.length === 0) {
            alert('没有可导出的文件');
            return;
        }
        
        // 过滤出转录和总结文件
        const transcriptFiles = result.files.filter(f => 
            f.filename.includes('_transcript') || f.filename.includes('_summary')
        );
        
        if (transcriptFiles.length === 0) {
            alert('没有可导出的转录文件');
            return;
        }
        
        console.log(`📦 批量导出 ${transcriptFiles.length} 个文件`);
        
        // 直接下载 ZIP
        window.location.href = '/api/download-all';
        
    } catch (error) {
        console.error('批量导出失败:', error);
        alert('批量导出失败: ' + error.message);
    }
}

// 导出选中的文件
async function downloadSelectedFiles(filenames) {
    if (!filenames || filenames.length === 0) {
        alert('请选择要导出的文件');
        return;
    }
    
    try {
        // 创建一个隐藏的表单来提交 POST 请求并触发下载
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/download-selected';
        form.style.display = 'none';
        
        // 使用 fetch 来处理
        const response = await fetch('/api/download-selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '导出失败');
        }
        
        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'podcast_selected.zip';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }
        
        // 下载文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败: ' + error.message);
    }
}

// 表单提交处理
async function processPodcast(event) {
    event.preventDefault();
    
    // 检查是否是批量模式
    if (isBatchMode) {
        const batchUrls = document.getElementById('batchUrls').value;
        const urls = batchUrls.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);
        
        if (urls.length === 0) {
            alert('请输入至少一个链接');
            return;
        }
        
        console.log(`📥 批量提交 ${urls.length} 个链接`);
        await submitBatchTasks(urls);
        return;
    }
    
    // 单链接模式 - 原有逻辑
    const form = event.target;
    const formData = new FormData(form);
    
    // 生成唯一的会话ID
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const data = {
        url: formData.get('podcastUrl') || document.getElementById('podcastUrl').value,
        operation: formData.get('operation'),
        audioLanguage: document.getElementById('audioLanguage').value,
        outputLanguage: document.getElementById('outputLanguage').value,
        sessionId: sessionId
    };
    
    console.log('Processing podcast with data:', data);
    
    // 显示结果区域和加载状态
    showResults();
    showLoadingWithProgress();
    
    // 建立SSE连接接收进度更新
    let eventSource = null;
    try {
        eventSource = new EventSource(`/api/progress/${sessionId}`);
        setupProgressListener(eventSource);
    } catch (sseError) {
        console.warn('SSE连接失败，使用模拟进度:', sseError);
    }
    
    try {
        // 调用后端API，设置15分钟超时
        const controller = new AbortController();
        // 移除超时限制以支持长音频处理
        
        // 步骤1: 先获取音频时长估算，带进度反馈
        let estimatedDuration = null;
        
        // 显示预估阶段的进度（使用新的智能进度条）
        
        // 预估开始：使用智能进度条
        if (!smartProgressBar) initializeProgressBar();
        smartProgressBar.updateProgress(7, 'Analyzing audio...', false);
        
        try {
            console.log('🔍 正在预估音频时长...');
            // 为预估接口使用独立的超时控制（30秒）
            const estimateController = new AbortController();
            const estimateTimeoutId = setTimeout(() => estimateController.abort(), 30000);
            
            // 预估中：使用智能进度条
            if (smartProgressBar) {
                smartProgressBar.updateProgress(8, 'Estimating duration...', false);
            }
            
            const estimateResponse = await fetch('/api/estimate-duration', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: data.url }),
                signal: estimateController.signal
            });
            
            clearTimeout(estimateTimeoutId);
            
            if (estimateResponse.ok) {
                const estimateResult = await estimateResponse.json();
                if (estimateResult.success) {
                    estimatedDuration = estimateResult.estimatedDuration;
                    console.log(`📊 获取到音频时长估算: ${Math.round(estimatedDuration / 60)} 分钟`);
                    
                    // 预估完成：使用智能进度条
                    if (smartProgressBar) {
                        smartProgressBar.updateProgress(9, 'Duration estimated', false);
                    }
                }
            }
        } catch (estimateError) {
            console.warn('⚠️ 音频时长预估失败，使用默认估算:', estimateError.message);
            // 预估失败：使用智能进度条
            if (smartProgressBar) {
                smartProgressBar.updateProgress(8, 'Using default estimation', false);
            }
        }
        
        // 步骤2: 启动进度模拟（使用真实音频时长）
        startProgressSimulation(estimatedDuration);
        
        const response = await fetch('/api/process-podcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: controller.signal
        });
        
        // 已移除超时限制
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // 停止进度模拟
        stopProgressSimulation();
        
        if (result.success) {
            // 处理时长信息（支持估算时长和真实时长）
            const processingMinutes = smartProgressBar ? 
                (Date.now() - smartProgressBar.smartProgress.startTime) / 1000 / 60 : 0;
            
            if (result.data.actualDuration) {
                // 有真实时长，更新学习数据
                const audioMinutes = result.data.actualDuration / 60;
                const actualRatio = processingMinutes / audioMinutes;
                
                console.log(`✅ 真实音频时长: ${audioMinutes.toFixed(1)} 分钟`);
                console.log(`⏱️ 实际处理时间: ${processingMinutes.toFixed(1)} 分钟`);
                console.log(`📊 实际处理比率: ${actualRatio.toFixed(2)}x`);
                
                // 保存处理比率，用于改进未来预估
                localStorage.setItem('audioProcessingRatio', actualRatio.toString());
                
                // 显示时长对比信息
                if (result.data.estimatedDuration) {
                    const estimatedMinutes = result.data.estimatedDuration / 60;
                    console.log(`📏 初始估算: ${estimatedMinutes.toFixed(1)} 分钟 | 真实时长: ${audioMinutes.toFixed(1)} 分钟`);
                }
            } else if (result.data.estimatedDuration) {
                // 只有估算时长
                const estimatedMinutes = result.data.estimatedDuration / 60;
                console.log(`📊 基于文件大小估算: ${estimatedMinutes.toFixed(1)} 分钟`);
            }
            
            showResultsContent(result.data, data.operation);
        } else {
            showError(result.error || 'Unknown error occurred');
        }
        
        // 关闭SSE连接
        if (eventSource) {
            eventSource.close();
            console.log('🔌 SSE连接已关闭');
        }
        
    } catch (error) {
        console.error('Error processing podcast:', error);
        stopProgressSimulation();
        
        // 关闭SSE连接
        if (eventSource) {
            eventSource.close();
            console.log('🔌 SSE连接已关闭（错误）');
        }
        
        if (error.name === 'AbortError') {
            // 超时后检查是否有文件已生成
            console.log('🔄 检测到超时，正在检查处理结果...');
            await checkForCompletedFiles();
        } else {
            showError(error.message);
        }
    }
}

// 检查是否有已完成的文件
async function checkForCompletedFiles() {
    try {
        // 显示检查状态
        showLoadingWithProgress();
        
        // 获取temp目录中的文件列表
        const response = await fetch('/api/temp-files');
        if (!response.ok) {
            throw new Error('无法获取文件列表');
        }
        
        const result = await response.json();
        
        // 查找最新的转录和总结文件
        const allFiles = result.files || [];
        const transcriptFiles = allFiles.filter(f => f.filename.includes('_transcript.md'));
        const summaryFiles = allFiles.filter(f => f.filename.includes('_summary.md'));
        
        if (transcriptFiles.length > 0) {
            // 找到了转录文件，构造成功响应
            const latestTranscript = transcriptFiles[transcriptFiles.length - 1];
            const latestSummary = summaryFiles.find(f => 
                f.filename.startsWith(latestTranscript.filename.split('_transcript')[0])
            );
            
            // 读取文件内容
            const transcriptContent = await fetchFileContent(latestTranscript.filename);
            
            const mockResult = {
                transcript: transcriptContent,
                summary: latestSummary ? await fetchFileContent(latestSummary.filename) : null,
                language: 'zh',
                savedFiles: [
                    {
                        type: 'transcript',
                        filename: latestTranscript.filename,
                        size: latestTranscript.size
                    }
                ]
            };
            
            if (latestSummary) {
                mockResult.savedFiles.push({
                    type: 'summary', 
                    filename: latestSummary.filename,
                    size: latestSummary.size
                });
            }
            
            stopProgressSimulation();
            
            // 显示成功结果
            const operation = latestSummary ? 'transcribe_summarize' : 'transcribe_only';
            showResultsContent(mockResult, operation);
            
            // 显示成功消息
            const successMsg = currentLang === 'zh' ? 
                '✅ 检测到处理已完成！文件已成功生成。' : 
                '✅ Processing completed! Files generated successfully.';
            console.log(successMsg);
            
        } else {
            // 没有找到文件，显示真正的超时错误
            showError('处理超时，请检查网络连接或稍后重试 / Processing timeout, please check network or retry later');
        }
        
    } catch (error) {
        console.error('检查文件时出错:', error);
        showError('处理超时，请检查网络连接或稍后重试 / Processing timeout, please check network or retry later');
    }
}

// 获取文件内容
async function fetchFileContent(filename) {
    try {
        const response = await fetch(`/api/download/${filename}`);
        if (!response.ok) {
            throw new Error(`无法读取文件: ${filename}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`读取文件 ${filename} 失败:`, error);
        return '文件内容读取失败';
    }
}

// 显示结果区域
function showResults() {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// 显示加载状态
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('resultsContent').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    
    // 禁用提交按钮
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
}

// 显示带进度的加载状态
function showLoadingWithProgress() {
    showLoading();
    
    // 重置进度条（使用新的智能进度条）
    
    // 重置智能进度条
    if (!smartProgressBar) initializeProgressBar();
    smartProgressBar.reset();
}

// ========================================
// 智能进度条系统 - 完全重写版本
// ========================================

class SmartProgressBar {
    constructor() {
        // DOM元素
        this.progressSection = document.getElementById('progressSection');
        this.progressTitle = document.getElementById('progressTitle');
        this.progressStatus = document.getElementById('progressStatus');
        this.progressFill = document.getElementById('progressFill');
        this.progressMessage = document.getElementById('progressMessage');
        
        // 进度状态
        this.currentProgress = 5;
        this.serverProgress = 0;
        this.currentStage = 'preparing';
        this.isActive = false;
        
        // 智能模拟
        this.smartProgress = {
            interval: null,
            startTime: null,
            estimatedDuration: null,
            lastServerUpdate: 0
        };
        
        // 阶段配置
        this.stageConfig = {
            'preparing': { speed: 0.5, maxProgress: 5, message: 'Preparing...' },
            'parsing': { speed: 0.8, maxProgress: 15, message: 'Parsing audio information...' },
            'downloading': { speed: 0.3, maxProgress: 35, message: 'Downloading audio...' },
            'transcribing': { speed: 0.2, maxProgress: 55, message: 'Transcribing audio...' },
            'optimizing': { speed: 0.5, maxProgress: 75, message: 'Optimizing transcript...' },
            'summarizing': { speed: 0.4, maxProgress: 95, message: 'Generating summary...' },
            'translating': { speed: 0.3, maxProgress: 98, message: 'Translating content...' },
            'complete': { speed: 0, maxProgress: 100, message: 'Processing complete!' }
        };
        
        // 多语言支持
        this.translations = {
            zh: {
                title: '处理进度',
                preparing: '准备中...',
                parsing: '解析音频信息...',
                downloading: '下载音频...',
                transcribing: '转录音频...',
                optimizing: '优化转录文本...',
                summarizing: '生成摘要...',
                translating: '翻译内容...',
                complete: '处理完成！'
            },
            en: {
                title: 'Processing Progress',
                preparing: 'Preparing...',
                parsing: 'Parsing audio information...',
                downloading: 'Downloading audio...',
                transcribing: 'Transcribing audio...',
                optimizing: 'Optimizing transcript...',
                summarizing: 'Generating summary...',
                translating: 'Translating content...',
                complete: 'Processing complete!'
            }
        };
    }
    
    // 主要进度更新入口
    updateProgress(progress, message, fromServer = false) {
        if (fromServer) {
            this.serverProgress = progress;
            this.smartProgress.lastServerUpdate = Date.now();
            
            // 识别阶段
            this.detectStage(message, progress);
            
            console.log(`📊 服务器进度更新: ${progress}% - ${message}`);
            
            // 服务器进度更新：始终跳跃到服务器进度（前进或后退）
            if (this.serverProgress !== this.currentProgress) {
                const direction = this.serverProgress > this.currentProgress ? '前进' : '后退';
                console.log(`🔄 进度${direction}: ${this.currentProgress}% → ${this.serverProgress}%`);
                this.currentProgress = this.serverProgress;
            }
        }
        
        // 更新显示
        this.updateProgressDisplay(this.currentProgress, message);
    }
    
    // 检测处理阶段
    detectStage(message, progress) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('download') || lowerMessage.includes('下载')) {
            this.currentStage = 'downloading';
        } else if (lowerMessage.includes('transcrib') || lowerMessage.includes('转录')) {
            this.currentStage = 'transcribing';
        } else if (lowerMessage.includes('optim') || lowerMessage.includes('优化')) {
            this.currentStage = 'optimizing';
        } else if (lowerMessage.includes('summar') || lowerMessage.includes('总结')) {
            this.currentStage = 'summarizing';
        } else if (lowerMessage.includes('translat') || lowerMessage.includes('翻译')) {
            this.currentStage = 'translating';
        } else if (lowerMessage.includes('complete') || lowerMessage.includes('完成')) {
            this.currentStage = 'complete';
        } else if (progress >= 95) {
            this.currentStage = 'complete';
        } else if (progress >= 10) {
            // 如果进度超过10%但没有明确阶段，至少切换到parsing阶段
            if (this.currentStage === 'preparing') {
                this.currentStage = 'parsing';
            }
        }
    }
    
    // 更新进度显示
    updateProgressDisplay(progress, message = null) {
        const roundedProgress = Math.round(progress * 10) / 10;
        const lang = currentLang || 'en';
        
        // 更新百分比
        if (this.progressStatus) {
            this.progressStatus.textContent = `${roundedProgress}%`;
        }
        
        // 更新进度条
        if (this.progressFill) {
            this.progressFill.style.width = `${roundedProgress}%`;
            this.progressFill.setAttribute('aria-valuenow', roundedProgress);
        }
        
        // 更新标题
        if (this.progressTitle) {
            this.progressTitle.textContent = this.translations[lang].title;
        }
        
        // 更新消息 - 始终使用本地化文本，忽略服务器文本
        if (this.progressMessage) {
            let displayMessage;
            if (this.currentStage) {
                displayMessage = this.translations[lang][this.currentStage] || 
                                this.stageConfig[this.currentStage].message;
            } else {
                displayMessage = this.translations[lang].preparing;
            }
            this.progressMessage.textContent = displayMessage;
        }
    }
    
    // 启动智能进度模拟
    startSmartProgress(estimatedDuration = null) {
        this.isActive = true;
        this.smartProgress.startTime = Date.now();
        this.smartProgress.estimatedDuration = estimatedDuration;
        this.currentProgress = Math.max(this.currentProgress, 5);
        
        console.log('🚀 启动智能进度模拟');
        
        this.smartProgress.interval = setInterval(() => {
            this.simulateProgress();
        }, 500); // 每500ms更新一次，更平滑
        
        // 初始显示
        this.updateProgressDisplay(this.currentProgress);
    }
    
    // 智能进度模拟
    simulateProgress() {
        if (!this.isActive || this.currentProgress >= 100) return;
        
        // 计算增量
        const increment = this.calculateProgressIncrement();
        const newProgress = this.currentProgress + increment;
        
        // 设置上限：如果有服务器进度，不超过服务器进度+25%；否则根据阶段设置合理上限
        let maxAllowed = 95;
        if (this.serverProgress > 0) {
            maxAllowed = Math.min(this.serverProgress + 25, 95);
        } else {
            // 没有服务器进度时，根据阶段设置合理的初始上限
            const stageMaxLimits = {
                'preparing': 8,      // 准备阶段最多到8%
                'parsing': 15,       // 解析阶段最多到15%
                'downloading': 25,   // 下载阶段最多到25%
                'transcribing': 35,  // 转录阶段最多到35%
                'optimizing': 55,    // 优化阶段最多到55%
                'summarizing': 75,   // 摘要阶段最多到75%
                'translating': 85,   // 翻译阶段最多到85%
                'complete': 100      // 完成阶段到100%
            };
            maxAllowed = stageMaxLimits[this.currentStage] || 95;
        }
        
        this.currentProgress = Math.min(newProgress, maxAllowed);
        
        // 更新显示
        this.updateProgressDisplay(this.currentProgress);
    }
    
    // 计算进度增量
    calculateProgressIncrement() {
        const stageMultipliers = {
            'preparing': 0.6,     // 准备阶段中等速度
            'parsing': 0.8,       // 解析阶段较快
            'downloading': 0.3,   // 下载阶段较慢
            'transcribing': 0.2,  // 转录阶段最慢
            'optimizing': 0.5,    // 优化阶段中等
            'summarizing': 0.4,   // 摘要阶段中等
            'translating': 0.3,   // 翻译阶段较慢
            'complete': 0         // 完成阶段不增长
        };
        
        const baseIncrement = 0.5; // 基础增量
        const multiplier = stageMultipliers[this.currentStage] || 0.3;
        const randomFactor = 0.5 + Math.random() * 0.5; // 0.5-1.0的随机因子
        
        return baseIncrement * multiplier * randomFactor;
}

// 停止进度模拟
    stopSmartProgress() {
        this.isActive = false;
        
        if (this.smartProgress.interval) {
            clearInterval(this.smartProgress.interval);
            this.smartProgress.interval = null;
        }
        
        // 设置为完成状态
        this.currentProgress = 100;
        this.currentStage = 'complete';
        this.updateProgressDisplay(100);
        
        console.log('🏁 进度模拟已停止');
    }
    
    // 重置进度条
    reset() {
        this.stopSmartProgress();
        this.currentProgress = 5;
        this.serverProgress = 0;
        this.currentStage = 'preparing';
        this.smartProgress.lastServerUpdate = 0;
        this.updateProgressDisplay(5);
    }
}

// 全局进度条实例
let smartProgressBar = null;

// 初始化进度条
function initializeProgressBar() {
    smartProgressBar = new SmartProgressBar();
}

// 兼容性函数 - 保持与现有代码的接口
function startProgressSimulation(audioDuration = null) {
    if (!smartProgressBar) initializeProgressBar();
    smartProgressBar.startSmartProgress(audioDuration);
}

function stopProgressSimulation() {
    if (smartProgressBar) {
        smartProgressBar.stopSmartProgress();
    }
}

// 显示结果内容
function showResultsContent(data, operation = 'transcribe_only') {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('resultsContent').classList.remove('hidden');
    
    // 显示播客标题（如果有）
    if (data.podcastTitle) {
        const podcastTitleSection = document.getElementById('podcastTitleSection');
        const podcastTitleText = document.getElementById('podcastTitleText');
        
        podcastTitleText.textContent = data.podcastTitle;
        podcastTitleSection.classList.remove('hidden');
    }
    
    // 准备标签页数据
    const tabs = [];
    
    // AI总结标签（如果有）
    if (data.summary) {
        tabs.push({
            id: 'summary',
            icon: '🤖',
            title: currentLang === 'zh' ? 'AI总结' : 'AI Summary',
            content: data.summary,
            contentId: 'summaryTabContent'
        });
    }
    
    // 转录文本标签（总是有）
    tabs.push({
        id: 'transcript',
        icon: '📝',
        title: currentLang === 'zh' ? '转录文本' : 'Transcript',
        content: data.transcript || 'No transcript available',
        contentId: 'transcriptTabContent'
    });
    
    // 翻译标签（如果需要且有翻译内容）
    if (data.needsTranslation && data.translation) {
        tabs.push({
            id: 'translation',
            icon: '🌍',
            title: currentLang === 'zh' ? '翻译' : 'Translation',
            content: data.translation,
            contentId: 'translationTabContent'
        });
        console.log('🌍 显示翻译内容');
    } else {
        console.log('✅ 无需显示翻译');
    }
    
    // 创建标签页导航
    createTabNavigation(tabs);
    
    // 填充标签页内容
    populateTabContent(tabs);
    
    // 激活第一个标签页
    if (tabs.length > 0) {
        activateTab(tabs[0].id);
    }
    
    // 显示下载按钮（如果有保存的文件）
    showDownloadButtons(data.savedFiles || []);
    
    // 重新启用提交按钮
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// 显示错误状态
function showError(errorMessage) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('resultsContent').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
    
    const errorDetails = document.getElementById('errorDetails');
    errorDetails.textContent = errorMessage;
    
    // 重新启用提交按钮
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// 验证播客链接格式
function validatePodcastUrl(url) {
    // Apple Podcasts URL pattern
    const applePodcastsPattern = /^https:\/\/podcasts\.apple\.com\//;
    // 小宇宙 URL pattern (修正域名)
    const xiaoyuzhouPattern = /^https:\/\/(www\.)?xiaoyuzhoufm\.com\//;
    // 通用音频文件URL
    const audioFilePattern = /\.(mp3|wav|m4a|aac|ogg)(\?.*)?$/i;
    
    return applePodcastsPattern.test(url) || 
           xiaoyuzhouPattern.test(url) || 
           audioFilePattern.test(url) ||
           url.includes('podcast') ||
           url.includes('audio');
}

// 表单验证
document.getElementById('podcastUrl').addEventListener('input', function(e) {
    const url = e.target.value;
    if (url && !validatePodcastUrl(url)) {
        e.target.setCustomValidity(currentLang === 'zh' 
            ? '请输入有效的播客链接' 
            : 'Please enter a valid podcast link');
    } else {
        e.target.setCustomValidity('');
    }
});

// 监听操作类型变化的函数（将在主初始化中调用）
function setupOperationTypeListeners() {
    const operationRadios = document.querySelectorAll('input[name="operation"]');
    operationRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const outputLanguageContainer = document.getElementById('outputLanguage').closest('div');
            if (this.value === 'transcribe_only') {
                outputLanguageContainer.style.opacity = '0.5';
                document.getElementById('outputLanguage').disabled = true;
            } else {
                outputLanguageContainer.style.opacity = '1';
                document.getElementById('outputLanguage').disabled = false;
            }
        });
    });
}

// 显示下载按钮
function showDownloadButtons(savedFiles) {
    const downloadSection = document.getElementById('downloadSection');
    const downloadButtons = document.getElementById('downloadButtons');
    
    if (!savedFiles || savedFiles.length === 0) {
        downloadSection.classList.add('hidden');
        return;
    }
    
    // 清空之前的链接
    downloadButtons.innerHTML = '';
    
    // 为每个保存的文件创建下载链接（过滤掉原始转录）
    savedFiles.forEach(file => {
        // 只显示优化后的转录和AI总结，不显示原始转录
        if (file.type === 'original_transcript') {
            return; // 跳过原始转录文件
        }
        
        const link = document.createElement('a');
        link.href = `/api/download/${file.filename}`;
        link.download = file.filename;
        link.className = 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 no-underline';
        
        const buttonTextMap = {
            'transcript': currentLang === 'zh' ? 'Download Transcript' : 'Download Transcript',
            'summary': currentLang === 'zh' ? 'Download Summary' : 'Download Summary',
            'translation': currentLang === 'zh' ? 'Download Translation' : 'Download Translation'
        };
        
        const buttonText = buttonTextMap[file.type] || `Download ${file.type}`;
        
        // 创建文本内容
        const textSpan = document.createElement('span');
        textSpan.textContent = buttonText;
        
        // 添加到链接中
        link.appendChild(textSpan);
        
        downloadButtons.appendChild(link);
    });
    
    // 显示下载区域
    downloadSection.classList.remove('hidden');
}

// 更新下载按钮的语言
function updateDownloadButtonsLanguage() {
    const downloadButtons = document.getElementById('downloadButtons');
    if (!downloadButtons) return;
    
    // 从现有链接中提取文件信息
    const links = downloadButtons.querySelectorAll('a[download]');
    const savedFiles = [];
    
    links.forEach(link => {
        const filename = link.getAttribute('download');
        const linkText = link.textContent;
        
        // 根据文件名判断类型
        let type = 'unknown';
        if (filename.includes('_transcript.')) {
            type = 'transcript';
        } else if (filename.includes('_summary.')) {
            type = 'summary';
        } else if (filename.includes('_translation.')) {
            type = 'translation';
        }
        
        // 从链接文本中提取文件大小（提取括号中的内容）
        let size = 0;
        const sizeMatch = linkText.match(/\((\d+\.?\d*)\s*(KB|MB|GB)\)/);
        if (sizeMatch) {
            const value = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2];
            if (unit === 'KB') size = value * 1024;
            else if (unit === 'MB') size = value * 1024 * 1024;
            else if (unit === 'GB') size = value * 1024 * 1024 * 1024;
        }
        
        savedFiles.push({
            filename: filename,
            type: type,
            size: size
        });
    });
    
    // 重新生成下载链接
    if (savedFiles.length > 0) {
        showDownloadButtons(savedFiles);
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 语言切换功能已在上方定义，此处移除重复

// 更新语言切换按钮
function updateLanguageToggle() {
    const toggle = document.getElementById('languageToggle');
    const texts = translations[currentLang];
    if (toggle && texts) {
        toggle.innerHTML = `<span class="mr-2">${texts.langFlag}</span>${texts.langText}`;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 设置正确的语言属性
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    
    // 根据浏览器语言设置总结语言的默认值
    const outputLanguageSelect = document.getElementById('outputLanguage');
    if (outputLanguageSelect) {
        outputLanguageSelect.value = currentLang; // 使用浏览器检测的语言
    }
    
    updateUI();
    updateLanguageToggle();
    
    // 设置操作类型监听器
    setupOperationTypeListeners();
});

// 移除了自动检查已完成文件的功能，让用户每次都有干净的开始

// 标签页相关函数
function createTabNavigation(tabs) {
    const tabNavigation = document.getElementById('tabNavigation');
    tabNavigation.innerHTML = '';
    
    tabs.forEach(tab => {
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-button';
        tabButton.setAttribute('data-tab', tab.id);
        tabButton.innerHTML = `
            <span>${tab.icon}</span>
            <span>${tab.title}</span>
        `;
        
        tabButton.addEventListener('click', () => activateTab(tab.id));
        tabNavigation.appendChild(tabButton);
    });
}

function populateTabContent(tabs) {
    tabs.forEach(tab => {
        const contentElement = document.getElementById(tab.contentId);
        if (contentElement) {
            const textElement = contentElement.querySelector('.prose');
            if (textElement) {
                textElement.innerHTML = marked.parse(tab.content);
            }
        }
    });
}

function activateTab(tabId) {
    // 移除所有活动状态
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // 激活选中的标签页
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(`${tabId}TabContent`);
    
    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeContent.classList.remove('hidden');
    }
    
    // 显示下载区域
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection) {
        downloadSection.classList.remove('hidden');
    }
}

// SSE 进度监听函数
function setupProgressListener(eventSource) {
    // 显示日志区域
    const logSection = document.getElementById('logSection');
    const logContent = document.getElementById('logContent');
    if (logSection) {
        logSection.classList.remove('hidden');
    }
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
                // 使用新的智能进度条系统
                if (smartProgressBar) {
                    smartProgressBar.updateProgress(data.progress, data.stageText, true);
                }
                
                // 添加日志
                addLog(`[${data.progress}%] ${data.stageText}`);
                console.log(`📊 收到进度更新: ${data.progress}% - ${data.stageText}`);
            } else if (data.type === 'log') {
                // 处理详细日志消息
                addLog(data.message);
            } else if (data.type === 'connected') {
                addLog('✅ 连接已建立，等待转录开始...');
                console.log('✅ SSE连接已建立:', data.sessionId);
            }
        } catch (error) {
            console.error('解析SSE数据失败:', error);
        }
    };
    
    eventSource.onerror = function(error) {
        console.error('SSE连接错误:', error);
        eventSource.close();
    };
}

// 添加日志到前端显示
function addLog(message) {
    const logContent = document.getElementById('logContent');
    if (logContent) {
        const timestamp = new Date().toLocaleTimeString();
        const logLine = document.createElement('div');
        logLine.className = 'log-line py-0.5';
        logLine.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
        logContent.appendChild(logLine);
        
        // 自动滚动到底部
        const logContainer = document.getElementById('logContainer');
        if (logContainer) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }
}

// 兼容性函数 - 更新进度显示
function updateProgressDisplay() {
    // 新系统中由 SmartProgressBar 内部处理
    if (smartProgressBar) {
        smartProgressBar.updateProgressDisplay(smartProgressBar.currentProgress);
    }
}
