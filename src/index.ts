import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Tray,
  globalShortcut,
} from 'electron';

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;
const path = require('path');
const assetsPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : 'assets';

const winHeight = 58;
const winWidth = 400;

let tray: Tray = null;

function createTray(): void {
  const imgPath = path.join(process.resourcesPath, 'tray.png');
  let image = nativeImage.createFromPath(imgPath);

  tray = new Tray(image);
  tray.setToolTip('catalyst');
  tray.setContextMenu(Menu.buildFromTemplate([]));
  tray.on('click', () => activate());
}

function setWindowBounds() {
  getMainWindow()?.setBounds({height: winHeight, width: winWidth});
}

function getMainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length === 0) {
    return null;
  } else {
    return wins[0];
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    height: winHeight,
    width: winWidth,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    title: 'catalyst',
    frame: false,
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.on('dom-ready', setWindowBounds);
}

function activate(): void {
  const win = getMainWindow();
  if (win === null) {
    createWindow();
  } else {
    win.show();
  }
}

function quit(): void {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

function ready(): void {
  globalShortcut.register('CommandOrControl+Space', activate);
  createTray();
  createWindow();
}

if (require('electron-squirrel-startup')) {
  app.quit();
}
app.on('window-all-closed', quit);
app.on('activate', activate);
app.on('ready', ready);
