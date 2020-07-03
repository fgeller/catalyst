import {app, BrowserWindow, globalShortcut} from 'electron';
declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    height: 58,
    width: 400,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    title: 'launcher',
    frame: false,
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  // mainWindow.webContents.openDevTools();
};

function activate(): void {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length === 0) createWindow();
  else wins[0].show();
}

function ready(): void {
  globalShortcut.register('CommandOrControl+Space', activate);

  if (app.dock) {
    app.dock.hide();
  }
  createWindow();
}

function quit(): void {
  if (process.platform !== 'darwin') app.quit();
}

app.on('window-all-closed', quit);
app.on('activate', activate);
app.on('ready', ready);
