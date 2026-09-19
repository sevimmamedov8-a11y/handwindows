const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');

let win = null;
let browserView = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#05070a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false
    }
  });

  // Camera/microphone permission for Chromium media capture.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => { win = null; browserView = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('browser:create', async (_event, url) => {
  if (!win) throw new Error('Window is not ready');
  if (browserView) win.removeBrowserView(browserView);

  browserView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: true,
      webSecurity: true
    }
  });
  win.setBrowserView(browserView);

  const bounds = win.getContentBounds();
  browserView.setBounds({
    x: Math.round(bounds.width * 0.10),
    y: Math.round(bounds.height * 0.17),
    width: Math.round(bounds.width * 0.80),
    height: Math.round(bounds.height * 0.68)
  });
  browserView.setAutoResize({ width: true, height: true });
  await browserView.webContents.loadURL(url || 'https://www.google.com/');
  return true;
});

ipcMain.handle('browser:navigate', async (_event, url) => {
  if (!browserView) return false;
  await browserView.webContents.loadURL(url);
  return true;
});

ipcMain.handle('browser:click', async (_event, point) => {
  if (!browserView) return false;
  browserView.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  browserView.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  browserView.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  return true;
});

ipcMain.handle('browser:move', async (_event, point) => {
  if (!browserView) return false;
  browserView.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  return true;
});

ipcMain.handle('browser:scroll', async (_event, delta) => {
  if (!browserView) return false;
  browserView.webContents.sendInputEvent({ type: 'mouseWheel', x: 500, y: 400, deltaY: delta, deltaX: 0 });
  return true;
});

ipcMain.handle('browser:bounds', async () => {
  if (!browserView) return null;
  const b = browserView.getBounds();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
});

ipcMain.handle('browser:focus', async (_event, point) => {
  if (!browserView) return false;
  browserView.webContents.focus();
  browserView.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  browserView.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  browserView.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  return true;
});
