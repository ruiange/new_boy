const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 创建空菜单来替换默认菜单
  const menu = Menu.buildFromTemplate([])
  Menu.setApplicationMenu(menu)

  win.setMenuBarVisibility(false);

  win.loadFile('index.html');
  //win.webContents.openDevTools();
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
    // 根据package.json中的配置,Python被放在app/python目录下
    return path.join(process.resourcesPath, 'app', 'python', 'python.exe')
  }
  // 开发环境使用系统Python或.venv中的Python
  return path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
}

let pythonProcess = null;  // 添加全局变量跟踪Python进程

function runPythonScript(win) {
  try {
    const pythonPath = getPythonPath()
    if (!fs.existsSync(pythonPath)) {
      throw new Error(`Python解释器未找到: ${pythonPath}`);
    }

    const resourcePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'app')
      : process.cwd();
    
    // 添加Python包路径
    const pythonLibPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'python', 'Lib', 'site-packages')
      : path.join(process.cwd(), '.venv', 'Lib', 'site-packages');

    const pythonScript = path.join(resourcePath, 'main.py');
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Python脚本未找到: ${pythonScript}`);
    }
    
    pythonProcess = spawn(pythonPath, [pythonScript], {
      env: { 
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONPATH: `${resourcePath};${pythonLibPath}`,
        WCFERRY_DLL_PATH: ensureUserDataPath()
      }
    });

    // 添加输出处理
    pythonProcess.stdout.on('data', (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('log', data.toString());
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('log', data.toString());
      }
    });

    pythonProcess.on('error', (error) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('log', `Python进程错误: ${error.message}`);
      }
    });

    return pythonProcess;
  } catch (error) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('log', `启动Python失败: ${error.message}`);
    }
    throw error;
  }
}

app.whenReady().then(() => {
  const win = createWindow();
  runPythonScript(win);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 添加进程清理
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}); 