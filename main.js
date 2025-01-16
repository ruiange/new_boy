const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess = null;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 5000;  // 5秒

function cleanupPythonProcess() {
  if (pythonProcess) {
    console.log('正在清理Python进程...');
    try {
      // 发送退出信号
      pythonProcess.stdin.write(JSON.stringify({
        type: 'exit'
      }) + '\n');
      
      // 给进程一点时间来清理
      setTimeout(() => {
        if (pythonProcess) {
          pythonProcess.kill();
          pythonProcess = null;
          console.log('Python进程已强制终止');
        }
      }, 1000);
    } catch (error) {
      console.error('清理Python进程时出错:', error);
      // 如果发送退出信号失败，直接结束进程
      if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
      }
    }
  }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  mainWindow = win;

  // 创建空菜单来替换默认菜单
  const menu = Menu.buildFromTemplate([])
  Menu.setApplicationMenu(menu)

  win.setMenuBarVisibility(false);
  
  // 始终打开开发者工具便于调试
  win.webContents.openDevTools();

  // 添加加载事件监听
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
    // 如果是开发环境，尝试重新加载
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.reload();
        }
      }, 5000);
    }
  });

  win.webContents.on('did-finish-load', () => {
    console.log('页面加载完成');
  });

  // 根据环境加载不同的URL
  if (process.env.NODE_ENV === 'development') {
    console.log('开发环境：加载 http://localhost:5173');
    win.loadURL('http://localhost:5173');
  } else {
    console.log('生产环境：加载', path.join(__dirname, 'dist', 'index.html'));
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  return win;
}

function ensureUserDataPath() {
  const userDataPath = path.join(app.getPath('userData'), 'wcf');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return userDataPath;
}

function getPythonPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'python', 'python.exe')
  }
  return path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
}

// 添加IPC监听器
ipcMain.on('send-wx-message', (event, { recipient, content, atUsers }) => {
  if (pythonProcess && !pythonProcess.killed) {
    try {
      pythonProcess.stdin.write(JSON.stringify({
        type: 'send_message',
        data: { 
          recipient: recipient,
          content: content,
          at_users: atUsers ? atUsers.split(',').map(u => u.trim()) : undefined
        }
      }) + '\n');

      // 设置超时处理
      const timeoutId = setTimeout(() => {
        event.reply('send-wx-message-response', { 
          success: false, 
          error: 'Python进程响应超时' 
        });
      }, 55000); // 55秒超时（比前端稍短一些）

      // 记录当前请求的回调信息
      const messageId = Date.now().toString();
      pendingMessages.set(messageId, {
        timeoutId,
        event
      });

    } catch (error) {
      console.error('发送消息时出错:', error);
      event.reply('send-wx-message-response', { 
        success: false, 
        error: '发送消息失败: ' + error.message 
      });
    }
  } else {
    event.reply('send-wx-message-response', { 
      success: false, 
      error: 'Python进程未运行' 
    });
  }
});

// 存储待处理的消息
const pendingMessages = new Map();

ipcMain.on('get-wx-status', (event) => {
  if (pythonProcess && !pythonProcess.killed) {
    try {
      pythonProcess.stdin.write(JSON.stringify({
        type: 'get_status'
      }) + '\n');
    } catch (error) {
      console.error('获取状态时出错:', error);
      event.reply('wx-status-response', '未连接');
    }
  } else {
    event.reply('wx-status-response', '未连接');
  }
});

function runPythonScript(win) {
  try {
    const pythonPath = getPythonPath()
    if (!fs.existsSync(pythonPath)) {
      throw new Error(`Python解释器未找到: ${pythonPath}`);
    }

    const resourcePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'app')
      : process.cwd();
    
    const pythonLibPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'python', 'Lib', 'site-packages')
      : path.join(process.cwd(), '.venv', 'Lib', 'site-packages');

    const pythonScript = path.join(resourcePath, 'main.py');
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Python脚本未找到: ${pythonScript}`);
    }

    console.log('启动Python进程:', {
      pythonPath,
      pythonScript,
      pythonLibPath,
      userDataPath: ensureUserDataPath()
    });
    
    pythonProcess = spawn(pythonPath, [pythonScript], {
      env: { 
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONPATH: `${resourcePath};${pythonLibPath}`,
        WCFERRY_DLL_PATH: ensureUserDataPath()
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 设置编码以正确处理中文
    pythonProcess.stdout.setEncoding('utf-8');
    pythonProcess.stderr.setEncoding('utf-8');

    pythonProcess.stdout.on('data', (data) => {
      if (win && !win.isDestroyed()) {
        // 分割多行输出并处理每一行
        const lines = data.toString().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;  // 跳过空行
          
          console.log('Python输出:', line);
          
          try {
            // 检查是否是JSON响应（去除可能的行号前缀）
            const jsonMatch = line.match(/(?:\[\d+\])?\s*({.*})/);
            if (jsonMatch) {
              try {
                const jsonResponse = JSON.parse(jsonMatch[1]);
                if (jsonResponse.type === 'send_message_response') {
                  // 清理所有待处理的消息
                  for (const [messageId, { timeoutId, event }] of pendingMessages.entries()) {
                    clearTimeout(timeoutId);
                    event.reply('send-wx-message-response', {
                      success: jsonResponse.success,
                      error: jsonResponse.error || ''
                    });
                    pendingMessages.delete(messageId);
                  }
                  continue;  // 处理下一行
                }
              } catch (e) {
                console.log('JSON解析失败，作为普通消息处理');
              }
            }

            // 处理普通文本响应
            if (line.includes('已发送消息给')) {
              // 清理所有待处理的消息
              for (const [messageId, { timeoutId, event }] of pendingMessages.entries()) {
                clearTimeout(timeoutId);
                event.reply('send-wx-message-response', { 
                  success: true,
                  message: '消息发送成功'
                });
                pendingMessages.delete(messageId);
              }
            } else if (line.includes('错误:') || line.includes('失败')) {
              // 清理所有待处理的消息
              for (const [messageId, { timeoutId, event }] of pendingMessages.entries()) {
                clearTimeout(timeoutId);
                event.reply('send-wx-message-response', { 
                  success: false,
                  error: line.trim()
                });
                pendingMessages.delete(messageId);
              }
            }

            if (line.includes('状态:')) {
              const status = line.includes('已连接') ? '已连接' : '未连接';
              win.webContents.send('wx-status-response', status);
            }

            // 发送日志到前端
            win.webContents.send('python-log', {
              type: line.includes('错误:') || line.includes('失败') ? 'error' : 'stdout',
              message: line + '\n'
            });
          } catch (e) {
            console.error('处理Python输出错误:', e);
            win.webContents.send('python-log', {
              type: 'error',
              message: `处理输出错误: ${e.message}\n原始消息: ${line}\n`
            });
          }
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const errorMessage = data.toString();
      console.error('Python错误:', errorMessage);
      if (win && !win.isDestroyed()) {
        win.webContents.send('python-log', {
          type: 'stderr',
          message: errorMessage
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Python进程错误:', error);
      if (win && !win.isDestroyed()) {
        win.webContents.send('python-log', {
          type: 'error',
          message: `Python进程错误: ${error.message}`
        });
      }
    });

    pythonProcess.on('exit', (code, signal) => {
      console.log('Python进程退出:', { code, signal });
      if (win && !win.isDestroyed()) {
        win.webContents.send('python-log', {
          type: 'error',
          message: `Python进程退出，代码：${code}，信号：${signal}`
        });
      }

      // 如果不是正常退出（代码0）且不是主动退出，则尝试重启
      if (code !== 0 && !app.isQuitting) {
        if (restartAttempts < MAX_RESTART_ATTEMPTS) {
          restartAttempts++;
          console.log(`尝试重启Python进程 (${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
          setTimeout(() => {
            if (!pythonProcess && !app.isQuitting) {
              runPythonScript(win);
            }
          }, RESTART_DELAY);
        } else {
          console.error('达到最大重试次数，停止重启');
          if (win && !win.isDestroyed()) {
            win.webContents.send('python-log', {
              type: 'error',
              message: '达到最大重试次数，请手动重启应用'
            });
          }
        }
      } else {
        // 正常退出时重置重试计数
        restartAttempts = 0;
      }
      
      pythonProcess = null;
    });

    return pythonProcess;
  } catch (error) {
    console.error('启动Python失败:', error);
    if (win && !win.isDestroyed()) {
      win.webContents.send('python-log', {
        type: 'error',
        message: `启动Python失败: ${error.message}`
      });
    }
    throw error;
  }
}

// 添加退出标志
app.isQuitting = false;

app.whenReady().then(() => {
  const win = createWindow();
  runPythonScript(win);
  
  // 监听窗口激活事件
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.isQuitting = true;
  cleanupPythonProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  cleanupPythonProcess();
}); 