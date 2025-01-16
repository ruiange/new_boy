<template>
  <div class="home">
    <h1>微信机器人控制台</h1>
    <div class="control-panel">
      <div class="status-section">
        <h2>机器人状态</h2>
        <p>状态: {{ status }}</p>
      </div>
      <div class="message-section">
        <h2>发送消息</h2>
        <div class="input-group">
          <!-- 接收者输入框 -->
          <div class="input-item">
            <label>接收者：</label>
            <input 
              v-model="messageForm.recipient" 
              placeholder="请输入接收者wxid或群id" 
              :disabled="sending"
            >
          </div>
          
          <!-- 消息内容输入框 -->
          <div class="input-item">
            <label>消息内容：</label>
            <textarea 
              v-model="messageForm.content" 
              placeholder="请输入消息内容" 
              :disabled="sending"
            ></textarea>
          </div>
          
          <!-- @用户输入框 -->
          <div class="input-item">
            <label>@用户（可选）：</label>
            <input 
              v-model="messageForm.atUsers" 
              placeholder="多个用户用逗号分隔，@所有人输入 notify@all" 
              :disabled="sending"
            >
          </div>

          <!-- 发送按钮 -->
          <button 
            @click="sendMessage" 
            :disabled="sending || !messageForm.recipient || !messageForm.content"
          >
            {{ sending ? '发送中...' : '发送' }}
          </button>
        </div>
      </div>
      <div class="log-section">
        <h2>运行日志</h2>
        <div class="log-container" ref="logContainer">
          <pre class="log-content" v-html="formattedLogs"></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const { ipcRenderer } = window.require('electron');

export default {
  name: 'Home',
  data() {
    return {
      status: '正在连接...',
      messageForm: {
        recipient: '',    // 接收者
        content: '',      // 消息内容
        atUsers: ''       // @用户列表
      },
      logs: [],
      sending: false
    }
  },
  computed: {
    formattedLogs() {
      return this.logs.map(log => {
        let color = 'black';
        switch(log.type) {
          case 'stderr':
            color = 'red';
            break;
          case 'error':
            color = 'darkred';
            break;
          case 'info':
            color = 'blue';
            break;
          case 'success':
            color = 'green';
            break;
          default:
            color = 'black';
        }
        return `<span style="color: ${color}">${log.message}</span>`;
      }).join('');
    }
  },
  methods: {
    async sendMessage() {
      if (!this.messageForm.recipient || !this.messageForm.content) {
        this.addLog('请填写接收者和消息内容', 'error');
        return;
      }

      try {
        this.sending = true;
        
        // 准备发送的消息数据
        const messageData = {
          recipient: this.messageForm.recipient.trim(),
          content: this.messageForm.content.trim(),
          atUsers: this.messageForm.atUsers.trim() || undefined
        };

        // 记录发送日志
        this.addLog(`准备发送消息：`, 'info');
        this.addLog(`接收者: ${messageData.recipient}`, 'info');
        this.addLog(`内容: ${messageData.content}`, 'info');
        if (messageData.atUsers) {
          this.addLog(`@用户: ${messageData.atUsers}`, 'info');
        }

        let timeoutId;
        const timeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('发送消息超时，请检查微信连接状态')), 60000); // 增加到60秒
        });

        const sendPromise = new Promise((resolve) => {
          const responseHandler = (event, response) => {
            clearTimeout(timeoutId); // 清除超时计时器
            ipcRenderer.removeListener('send-wx-message-response', responseHandler);
            resolve(response);
          };
          
          ipcRenderer.once('send-wx-message-response', responseHandler);
          ipcRenderer.send('send-wx-message', messageData);
        });

        // 等待响应或超时
        const response = await Promise.race([sendPromise, timeout]);
        
        if (response.success) {
          this.addLog('消息发送成功！', 'success');
          this.clearForm();
        } else {
          throw new Error(response.error || '未知错误');
        }
      } catch (error) {
        this.addLog(`消息发送失败: ${error.message}`, 'error');
        if (error.code) {
          this.addLog(`错误代码: ${error.code}`, 'error');
        }
      } finally {
        this.sending = false;
      }
    },

    addLog(message, type = 'info') {
      this.logs.push({
        type,
        message: message + '\n'
      });
      this.$nextTick(this.scrollToBottom);
    },

    scrollToBottom() {
      if (this.$refs.logContainer) {
        this.$refs.logContainer.scrollTop = this.$refs.logContainer.scrollHeight;
      }
    },

    updateStatus() {
      ipcRenderer.send('get-wx-status');
    },

    clearForm() {
      this.messageForm.content = '';
      this.messageForm.atUsers = '';
      // 保留接收者以便连续发送
    }
  },
  mounted() {
    // 监听Python进程的日志
    ipcRenderer.on('python-log', (event, log) => {
      this.addLog(log.message, log.type);

      // 更新状态
      if (log.message.includes('微信已连接')) {
        this.status = '已连接';
      } else if (log.message.includes('等待微信登录超时') || log.message.includes('微信未连接')) {
        this.status = '未连接';
      } else if (log.message.includes('正在等待微信连接')) {
        this.status = '正在连接...';
      }
    });

    // 监听消息发送响应
    ipcRenderer.on('send-wx-message-response', (event, response) => {
      this.sending = false;
      
      if (response.success) {
        this.addLog('消息发送成功！', 'success');
        this.clearForm();
      } else {
        this.addLog(`消息发送失败: ${response.error}`, 'error');
      }
    });

    // 监听状态更新响应
    ipcRenderer.on('wx-status-response', (event, status) => {
      this.status = status;
    });

    // 初始化时请求状态
    this.updateStatus();

    // 定期更新状态（每30秒）
    setInterval(this.updateStatus, 30000);
  },
  beforeUnmount() {
    // 清理事件监听
    ipcRenderer.removeAllListeners('python-log');
    ipcRenderer.removeAllListeners('send-wx-message-response');
    ipcRenderer.removeAllListeners('wx-status-response');
  }
}
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.control-panel {
  margin-top: 30px;
}

.status-section, .message-section, .log-section {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-item label {
  font-size: 14px;
  color: #666;
}

input, textarea {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
}

textarea {
  height: 100px;
  resize: vertical;
}

button {
  background: #42b983;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.3s;
}

button:hover:not(:disabled) {
  background: #3aa876;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

input:disabled, textarea:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.log-container {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  height: 300px;
  overflow-y: auto;
  padding: 10px;
}

.log-content {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
}

/* 自定义滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>