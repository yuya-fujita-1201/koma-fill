const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEV_FRONTEND_URL = process.env.KOMA_FILL_FRONTEND_URL || 'http://127.0.0.1:3000';
const DEV_BACKEND_URL = process.env.KOMA_FILL_BACKEND_URL || 'http://127.0.0.1:3001';
const PACKAGED_PORT = Number(process.env.KOMA_FILL_APP_PORT || 33101);
const PACKAGED_URL = `http://127.0.0.1:${PACKAGED_PORT}`;

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;
let backendStopPromise = null;
let suppressBackendExitDialog = false;
let isCleaningUpBeforeQuit = false;

function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'api-config.json');
}

function getDefaultExportDirectory() {
  return path.join(app.getPath('documents'), 'Koma Fill Exports');
}

function readApiConfig() {
  try {
    const raw = fs.readFileSync(getConfigFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      openaiApiKey: typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : '',
      geminiApiKey: typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : '',
      exportDirectory: typeof parsed.exportDirectory === 'string' ? parsed.exportDirectory : '',
    };
  } catch {
    return {
      openaiApiKey: '',
      geminiApiKey: '',
      exportDirectory: '',
    };
  }
}

function getApiConfigStatus() {
  const config = readApiConfig();
  return {
    hasOpenAI: Boolean(config.openaiApiKey.trim()),
    hasGemini: Boolean(config.geminiApiKey.trim()),
    hasExportDirectory: Boolean(config.exportDirectory.trim()),
    effectiveExportDirectory: config.exportDirectory.trim() || getDefaultExportDirectory(),
    missing: [
      !config.openaiApiKey.trim() ? 'OPENAI_API_KEY' : null,
      !config.geminiApiKey.trim() ? 'GEMINI_API_KEY' : null,
    ].filter(Boolean),
  };
}

function getRuntimeApiStatus() {
  const config = readApiConfig();
  const openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';
  const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
  return {
    hasOpenAI: Boolean(openaiApiKey.trim()),
    hasGemini: Boolean(geminiApiKey.trim()),
    hasExportDirectory: Boolean(config.exportDirectory.trim()),
    effectiveExportDirectory: config.exportDirectory.trim() || getDefaultExportDirectory(),
    missing: [
      !openaiApiKey.trim() ? 'OPENAI_API_KEY' : null,
      !geminiApiKey.trim() ? 'GEMINI_API_KEY' : null,
    ].filter(Boolean),
  };
}

function hasRequiredApiKeys() {
  const status = getRuntimeApiStatus();
  return status.missing.length === 0;
}

function writeApiConfig(config) {
  const normalized = {
    openaiApiKey: typeof config?.openaiApiKey === 'string' ? config.openaiApiKey.trim() : '',
    geminiApiKey: typeof config?.geminiApiKey === 'string' ? config.geminiApiKey.trim() : '',
    exportDirectory: typeof config?.exportDirectory === 'string' ? config.exportDirectory.trim() : '',
  };

  fs.mkdirSync(path.dirname(getConfigFilePath()), { recursive: true });
  fs.writeFileSync(getConfigFilePath(), JSON.stringify(normalized, null, 2), 'utf-8');
  try {
    fs.chmodSync(getConfigFilePath(), 0o600);
  } catch {
    // no-op
  }

  return normalized;
}

function createMenu() {
  const openSettingsMenuItem = {
    label: 'API設定',
    accelerator: 'CmdOrCtrl+,',
    click: () => {
      void openSettings();
    },
  };

  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        openSettingsMenuItem,
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [openSettingsMenuItem, { role: 'close' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpcHandlers() {
  ipcMain.handle('config:getApi', async () => readApiConfig());
  ipcMain.handle('config:getApiStatus', async () => getApiConfigStatus());
  ipcMain.handle('config:chooseExportDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: readApiConfig().exportDirectory || getDefaultExportDirectory(),
      title: '漫画原稿の保存先を選択',
      buttonLabel: 'このフォルダを使う',
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });
  ipcMain.handle('config:saveApi', async (_event, config) => {
    const saved = writeApiConfig(config);
    if (app.isPackaged) {
      await stopBackend({ silent: true });
      await startBackendIfNeeded();
    }
    return {
      ...saved,
      status: getApiConfigStatus(),
    };
  });
  ipcMain.handle('app:openSettings', async () => {
    await openSettings();
    return true;
  });
}

function getBackendEntryPath() {
  return path.join(app.getAppPath(), 'backend', 'dist', 'index.js');
}

function getNodeBinary() {
  const candidates = [
    process.env.KOMA_FILL_NODE_BINARY,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    'node',
  ].filter(Boolean);

  return candidates.find((candidate) => candidate === 'node' || fs.existsSync(candidate)) || 'node';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf-8' }, (error, stdout, stderr) => {
      if (error && error.code !== 1) {
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function isServerHealthy(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}/api/health`, { signal: controller.signal });
    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    return payload?.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerHealthy(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for backend: ${url}`);
}

async function waitForProcessExit(pid, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for process ${pid} to exit`);
}

async function findListeningPid(port) {
  try {
    const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
    const firstLine = stdout.split('\n').find(Boolean);
    if (!firstLine) {
      return null;
    }

    const pid = Number(firstLine.trim());
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function getProcessCommand(pid) {
  try {
    const { stdout } = await execFileAsync('/bin/ps', ['-p', String(pid), '-o', 'command=']);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function cleanupStalePackagedBackend() {
  if (!app.isPackaged || backendProcess) {
    return;
  }

  const pid = await findListeningPid(PACKAGED_PORT);
  if (!pid) {
    return;
  }

  const command = await getProcessCommand(pid);
  const isKomaFillBackend =
    command.includes('Koma Fill.app/Contents/Resources/app/backend/dist/index.js') ||
    command.includes('/release/mac-arm64/Koma Fill.app/Contents/Resources/app/backend/dist/index.js');

  if (!isKomaFillBackend) {
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    await waitForProcessExit(pid, 3000);
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
      await waitForProcessExit(pid, 2000);
    } catch {
      // give up and let the later startup path surface the failure if needed
    }
  }
}

function buildBackendEnv() {
  const savedConfig = readApiConfig();
  const appDataDir = path.join(app.getPath('userData'), 'runtime');
  const storageDir = path.join(appDataDir, 'uploads');
  const databaseDir = path.join(appDataDir, 'data');
  ensureDir(storageDir);
  ensureDir(databaseDir);

  return {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PACKAGED_PORT),
    BASE_URL: PACKAGED_URL,
    DATABASE_PATH: path.join(databaseDir, 'koma-fill.db'),
    STORAGE_PATH: storageDir,
    ALLOWED_ORIGINS: PACKAGED_URL,
    OPENAI_API_KEY: savedConfig.openaiApiKey || process.env.OPENAI_API_KEY || '',
    GEMINI_API_KEY: savedConfig.geminiApiKey || process.env.GEMINI_API_KEY || '',
    EXPORT_PATH: savedConfig.exportDirectory || process.env.EXPORT_PATH || getDefaultExportDirectory(),
  };
}

async function startBackendIfNeeded() {
  if (!app.isPackaged) {
    await waitForServer(DEV_BACKEND_URL);
    return;
  }

  if (backendProcess) {
    return;
  }

  if (backendStopPromise) {
    await backendStopPromise;
  }

  await cleanupStalePackagedBackend();

  if (await isServerHealthy(PACKAGED_URL)) {
    return;
  }

  backendProcess = spawn(getNodeBinary(), [getBackendEntryPath()], {
    cwd: app.getAppPath(),
    env: buildBackendEnv(),
    stdio: 'pipe',
  });

  backendProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[koma-fill backend] ${chunk}`);
  });
  backendProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[koma-fill backend] ${chunk}`);
  });
  backendProcess.on('exit', (code, signal) => {
    const shouldShowDialog = !isQuitting && !suppressBackendExitDialog;
    backendProcess = null;
    suppressBackendExitDialog = false;

    if (shouldShowDialog) {
      dialog.showErrorBox(
        'Koma Fill',
        `バックエンドが終了しました (code: ${code ?? 'unknown'}${signal ? `, signal: ${signal}` : ''})`
      );
    }
  });

  await waitForServer(PACKAGED_URL);
}

function stopBackend(options = {}) {
  const { silent = false } = options;

  if (!backendProcess) {
    return Promise.resolve();
  }

  if (backendStopPromise) {
    return backendStopPromise;
  }

  const child = backendProcess;
  suppressBackendExitDialog = suppressBackendExitDialog || silent;

  backendStopPromise = new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already exited
      }
    }, 5000);

    child.once('exit', () => {
      clearTimeout(timeoutId);
      backendStopPromise = null;
      resolve();
    });

    try {
      child.kill('SIGTERM');
    } catch {
      clearTimeout(timeoutId);
      backendStopPromise = null;
      resolve();
    }
  });

  return backendStopPromise;
}

async function openSettings() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
  mainWindow.webContents.send('app:open-settings');
}

async function promptForApiKeysIfMissing() {
  if (hasRequiredApiKeys()) {
    return;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'APIキー設定が必要です',
    message: 'OpenAI API Key と Gemini API Key が未設定です。',
    detail: 'API設定を開いてキーを登録してください。登録後は自動的にバックエンドを再起動します。',
    buttons: ['API設定を開く', '終了'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (result.response === 0) {
    await openSettings();
    return;
  }

  app.quit();
}

async function createWindow() {
  await startBackendIfNeeded();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'Koma Fill',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const targetUrl = app.isPackaged ? PACKAGED_URL : DEV_FRONTEND_URL;
  await mainWindow.loadURL(targetUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    createMenu();
    registerIpcHandlers();
    await createWindow();
    await promptForApiKeysIfMissing();

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
        await promptForApiKeysIfMissing();
      }
    });
  }).catch((error) => {
    dialog.showErrorBox('Koma Fill', error instanceof Error ? error.message : String(error));
    app.quit();
  });

  app.on('before-quit', (event) => {
    if (isCleaningUpBeforeQuit) {
      return;
    }

    isQuitting = true;

    if (!backendProcess && !backendStopPromise && !app.isPackaged) {
      return;
    }

    isCleaningUpBeforeQuit = true;
    event.preventDefault();
    void Promise.all([
      stopBackend({ silent: true }),
      cleanupStalePackagedBackend(),
    ]).finally(() => {
      isCleaningUpBeforeQuit = false;
      app.exit(0);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
