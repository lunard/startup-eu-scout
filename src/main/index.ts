import { app, BrowserWindow, ipcMain, safeStorage, dialog } from 'electron';
import * as path from 'path';
import { checkCopilotHealth, validateOpusModel } from './copilot';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'EU Startup Nexus',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function performBootChecks(): Promise<void> {
  const copilotAvailable = await checkCopilotHealth();
  if (!copilotAvailable) {
    dialog.showErrorBox(
      'Copilot CLI Not Found',
      'Copilot CLI is required but was not found on your system.\n\n' +
        'Please install the GitHub Copilot CLI and ensure it is in your PATH.'
    );
    app.quit();
    return;
  }

  const opusValid = await validateOpusModel();
  if (!opusValid) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Model Configuration Required',
      message: 'Copilot CLI is not using the Opus 4.6 model.',
      detail:
        'EU Startup Nexus requires the Opus 4.6 model for AI synthesis.\n\n' +
        'Please switch to the Opus 4.6 model via the CLI:\n' +
        '  copilot model set opus-4.6\n\n' +
        'Then restart the application.',
      buttons: ['Quit'],
    }).then(() => {
      app.quit();
    });
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers(ipcMain);

  await createWindow();
  await performBootChecks();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export { mainWindow };
