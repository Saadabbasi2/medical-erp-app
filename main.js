// main.js (Electron entry point, CommonJS)
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Load API configuration
function loadApiConfig() {
  const configPath = path.join(__dirname, 'api-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config;
    }
  } catch (err) {
    console.error('Error loading API config:', err);
  }
  // Default to cloud server with port 3000
  return { apiBase: 'http://84.247.169.194:3000', useCloudServer: true };
}

function createWindow() {
  const apiConfig = loadApiConfig();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Inject API config into window before loading
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.API_CONFIG = ${JSON.stringify(apiConfig)};
      window.API_BASE = '${apiConfig.apiBase}';
    `);
  });

  mainWindow.loadFile('login.html');
  mainWindow.on('closed', function () {
    mainWindow = null;
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

app.on('ready', () => {
  const apiConfig = loadApiConfig();

  // Only start local server if not using cloud server
  if (!apiConfig.useCloudServer) {
    const isDev = !app.isPackaged;
    let serverPath;
    let serverCwd;

    if (isDev) {
      serverPath = path.join(__dirname, 'server.js');
      serverCwd = __dirname;
    } else {
      // In packaged app, unpacked files are in app.asar.unpacked
      serverPath = path.join(__dirname, '..', 'app.asar.unpacked', 'server.js');
      serverCwd = path.join(__dirname, '..', 'app.asar.unpacked');
    }

    serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      shell: true,
      cwd: serverCwd
    });
  } else {
    console.log('Using cloud server:', apiConfig.apiBase);
  }

  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
