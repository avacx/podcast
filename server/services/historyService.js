/**
 * 历史记录服务
 * 持久化存储转录历史，支持页面刷新后恢复
 */

const fs = require('fs');
const path = require('path');

class HistoryService {
    constructor(dataDir) {
        this.dataDir = dataDir || path.join(__dirname, '../data');
        this.historyFile = path.join(this.dataDir, 'history.json');
        this.maxHistory = 100; // 最多保留100条记录
        
        this.ensureDataDir();
        this.history = this.loadHistory();
    }

    /**
     * 确保数据目录存在
     */
    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log(`📁 创建数据目录: ${this.dataDir}`);
        }
    }

    /**
     * 加载历史记录
     */
    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf8');
                const history = JSON.parse(data);
                console.log(`📚 加载了 ${history.length} 条历史记录`);
                return history;
            }
        } catch (error) {
            console.error('加载历史记录失败:', error.message);
        }
        return [];
    }

    /**
     * 保存历史记录到文件
     */
    saveHistory() {
        try {
            fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2), 'utf8');
        } catch (error) {
            console.error('保存历史记录失败:', error.message);
        }
    }

    /**
     * 添加新记录
     */
    addRecord(record) {
        const newRecord = {
            id: record.id || `record_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            url: record.url,
            title: record.title || '',
            status: record.status || 'processing', // processing, completed, failed
            progress: record.progress || 0,
            stage: record.stage || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            savedFiles: record.savedFiles || [],
            error: record.error || null
        };

        this.history.unshift(newRecord);
        
        // 限制历史记录数量
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }
        
        this.saveHistory();
        return newRecord;
    }

    /**
     * 更新记录
     */
    updateRecord(id, updates) {
        const index = this.history.findIndex(r => r.id === id);
        if (index !== -1) {
            this.history[index] = {
                ...this.history[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveHistory();
            return this.history[index];
        }
        return null;
    }

    /**
     * 获取记录
     */
    getRecord(id) {
        return this.history.find(r => r.id === id);
    }

    /**
     * 获取所有历史记录
     */
    getHistory(options = {}) {
        let records = [...this.history];
        
        // 按状态过滤
        if (options.status) {
            records = records.filter(r => r.status === options.status);
        }
        
        // 分页
        const page = options.page || 0;
        const pageSize = options.pageSize || 20;
        const start = page * pageSize;
        
        return {
            total: records.length,
            page,
            pageSize,
            records: records.slice(start, start + pageSize)
        };
    }

    /**
     * 删除记录
     */
    deleteRecord(id) {
        const index = this.history.findIndex(r => r.id === id);
        if (index !== -1) {
            this.history.splice(index, 1);
            this.saveHistory();
            return true;
        }
        return false;
    }

    /**
     * 清空历史记录
     */
    clearHistory() {
        this.history = [];
        this.saveHistory();
    }

    /**
     * 获取正在处理的任务
     */
    getProcessingRecords() {
        return this.history.filter(r => r.status === 'processing');
    }
}

// 创建单例
const historyService = new HistoryService();

module.exports = { historyService, HistoryService };
