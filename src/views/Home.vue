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
          <input v-model="wxid" placeholder="请输入接收者wxid">
          <textarea v-model="message" placeholder="请输入消息内容"></textarea>
          <button @click="sendMessage">发送</button>
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
      status: '未知',
      wxid: '',
      message: '',
      logs: []
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
          default:
            color = 'black';
        }
        return `<span style="color: ${color}">${log.message}</span>`;
      }).join('');
    }
  },
  methods: {
    async sendMessage() {
      if (!this.wxid || !this.message) {
        alert('请填写完整信息');
        return;
      }
      
      try {
        const response = await fetch('http://localhost:3000/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: this.wxid,
            message: this.message
          })
        });
        
        const data = await response.json();
        if (data.success) {
          alert('消息发送成功');
          this.message = ''; // 清空消息输入框
        } else {
          alert('发送失败: ' + data.error);
        }
      } catch (error) {
        alert('发送失败: ' + error.message);
      }
    },
    scrollToBottom() {
      if (this.$refs.logContainer) {
        this.$refs.logContainer.scrollTop = this.$refs.logContainer.scrollHeight;
      }
    }
  },
  mounted() {
    // 监听Python进程的日志
    ipcRenderer.on('python-log', (event, log) => {
      this.logs.push(log);
      this.$nextTick(this.scrollToBottom);
    });

    // 获取初始状态
    fetch('http://localhost:3000/status')
      .then(response => response.json())
      .then(data => {
        this.status = data.status;
      })
      .catch(error => {
        this.status = '连接失败';
      });
  },
  beforeUnmount() {
    // 清理事件监听
    ipcRenderer.removeAllListeners('python-log');
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
  gap: 10px;
}

input, textarea {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

textarea {
  height: 100px;
  resize: vertical;
}

button {
  background: #42b983;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #3aa876;
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