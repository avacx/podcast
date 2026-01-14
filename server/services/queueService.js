/**
 * 任务队列服务
 * 确保一次只处理一个转录任务，避免显存溢出
 */

const { historyService } = require('./historyService');

class TaskQueue {
    constructor() {
        this.queue = [];           // 待处理队列
        this.processing = null;    // 当前处理的任务
        this.completed = [];       // 已完成的任务（内存中的临时记录）
        this.isProcessing = false; // 是否正在处理
        this.maxCompleted = 50;    // 最多保留的已完成任务数
    }

    /**
     * 添加任务到队列
     */
    addTask(task) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const queuedTask = {
            id: taskId,
            ...task,
            status: 'queued',
            progress: 0,
            queuedAt: new Date(),
            position: this.queue.length + 1
        };
        
        this.queue.push(queuedTask);
        console.log(`📥 任务已加入队列: ${taskId}, 队列位置: ${queuedTask.position}`);
        
        // 添加到历史记录
        historyService.addRecord({
            id: taskId,
            url: task.url,
            status: 'queued',
            progress: 0
        });
        
        // 如果没有在处理，开始处理队列
        if (!this.isProcessing) {
            this.processNext();
        }
        
        return queuedTask;
    }

    /**
     * 批量添加任务
     */
    addBatchTasks(tasks) {
        const results = [];
        for (const task of tasks) {
            results.push(this.addTask(task));
        }
        return results;
    }

    /**
     * 处理下一个任务
     */
    async processNext() {
        if (this.queue.length === 0 || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.processing = this.queue.shift();
        this.processing.status = 'processing';
        this.processing.startedAt = new Date();

        console.log(`🚀 开始处理任务: ${this.processing.id}`);

        // 更新历史记录状态
        historyService.updateRecord(this.processing.id, {
            status: 'processing',
            progress: 0
        });

        // 更新队列中其他任务的位置
        this.queue.forEach((task, index) => {
            task.position = index + 1;
        });

        try {
            // 调用处理回调
            if (this.processing.processor) {
                const result = await this.processing.processor(this.processing, (progress, stage, stageText) => {
                    this.updateProgress(this.processing.id, progress, stage, stageText);
                });
                
                this.processing.status = 'completed';
                this.processing.result = result;
                this.processing.completedAt = new Date();
                
                // 更新历史记录
                historyService.updateRecord(this.processing.id, {
                    status: 'completed',
                    progress: 100,
                    title: result.podcastTitle || '',
                    savedFiles: result.savedFiles || []
                });
                
                console.log(`✅ 任务完成: ${this.processing.id}`);
            }
        } catch (error) {
            console.error(`❌ 任务失败: ${this.processing.id}`, error);
            this.processing.status = 'failed';
            this.processing.error = error.message;
            this.processing.failedAt = new Date();
            
            // 更新历史记录
            historyService.updateRecord(this.processing.id, {
                status: 'failed',
                error: error.message
            });
        }

        // 移动到已完成列表
        this.completed.unshift(this.processing);
        
        // 限制已完成列表大小
        if (this.completed.length > this.maxCompleted) {
            this.completed = this.completed.slice(0, this.maxCompleted);
        }

        this.processing = null;
        this.isProcessing = false;

        // 处理下一个任务
        this.processNext();
    }

    /**
     * 更新任务进度
     */
    updateProgress(taskId, progress, stage, stageText) {
        if (this.processing && this.processing.id === taskId) {
            this.processing.progress = progress;
            this.processing.stage = stage;
            this.processing.stageText = stageText;
            
            // 同步更新历史记录（但不要太频繁保存文件）
            historyService.updateRecord(taskId, {
                progress,
                stage,
                stageText
            });
        }
    }

    /**
     * 获取队列状态
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            processing: this.processing ? {
                id: this.processing.id,
                url: this.processing.url,
                status: this.processing.status,
                progress: this.processing.progress,
                stage: this.processing.stage,
                stageText: this.processing.stageText,
                startedAt: this.processing.startedAt
            } : null,
            queue: this.queue.map(task => ({
                id: task.id,
                url: task.url,
                status: task.status,
                position: task.position,
                queuedAt: task.queuedAt
            })),
            recentCompleted: this.completed.slice(0, 10).map(task => ({
                id: task.id,
                url: task.url,
                status: task.status,
                completedAt: task.completedAt,
                error: task.error
            }))
        };
    }

    /**
     * 获取任务详情
     */
    getTask(taskId) {
        // 检查当前处理的任务
        if (this.processing && this.processing.id === taskId) {
            return this.processing;
        }
        
        // 检查队列中的任务
        const queuedTask = this.queue.find(t => t.id === taskId);
        if (queuedTask) return queuedTask;
        
        // 检查已完成的任务
        const completedTask = this.completed.find(t => t.id === taskId);
        if (completedTask) return completedTask;
        
        return null;
    }

    /**
     * 取消任务（仅限队列中的任务）
     */
    cancelTask(taskId) {
        const index = this.queue.findIndex(t => t.id === taskId);
        if (index !== -1) {
            const task = this.queue.splice(index, 1)[0];
            task.status = 'cancelled';
            task.cancelledAt = new Date();
            this.completed.unshift(task);
            
            // 更新队列位置
            this.queue.forEach((t, i) => {
                t.position = i + 1;
            });
            
            console.log(`🚫 任务已取消: ${taskId}`);
            return true;
        }
        return false;
    }

    /**
     * 清空队列
     */
    clearQueue() {
        const cancelled = this.queue.map(task => {
            task.status = 'cancelled';
            task.cancelledAt = new Date();
            return task;
        });
        
        this.completed = [...cancelled, ...this.completed].slice(0, this.maxCompleted);
        this.queue = [];
        
        console.log(`🧹 队列已清空，取消了 ${cancelled.length} 个任务`);
        return cancelled.length;
    }
}

// 创建全局队列实例
const taskQueue = new TaskQueue();

module.exports = { taskQueue, TaskQueue };
