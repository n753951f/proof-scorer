const { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

let dirty = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    title: '證明排序評分',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1016' : '#f2f4f7',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 系統不存資料：關閉前若有尚未匯出的資料，提醒一下
  win.on('close', (e) => {
    if (!dirty) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['仍要關閉', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '尚未匯出',
      message: '有學生資料尚未匯出 CSV',
      detail: '本系統不會儲存任何資料，關閉後資料將消失。',
    });
    if (choice === 1) e.preventDefault();
  });
}

Menu.setApplicationMenu(null);

ipcMain.on('set-dirty', (_e, v) => {
  dirty = !!v;
});

ipcMain.handle('save-csv', async (evt, { defaultName, content }) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '匯出 CSV',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await fs.promises.writeFile(filePath, content, 'utf8');
  return { ok: true, filePath };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
