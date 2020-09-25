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

if (require('electron-squirrel-startup')) {
  app.quit();
}

let tray: Tray = null;

const createWindow = () => {
  const assetsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : 'assets';

  const imgPath = path.join(process.resourcesPath, 'tray.png');
  console.log('imgPath', imgPath);
  let image = nativeImage.createFromPath(imgPath);

  tray = new Tray(image);
  tray.setToolTip('catalyst');
  tray.setContextMenu(Menu.buildFromTemplate([]));

  tray.on('click', function (ev) {
    console.log('click tray', ev);
    activate();
  });

  console.log('tray', tray);

  const winHeight = 58;
  const winWidth = 400;
  const mainWindow = new BrowserWindow({
    height: winHeight,
    width: winWidth,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    title: 'launcher',
    frame: false,
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.on('dom-ready', function (ev) {
    mainWindow.setBounds({height: winHeight, width: winWidth});
  });
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
    //app.dock.hide();
  }
  createWindow();
}

function quit(): void {
  if (process.platform !== 'darwin') app.quit();
}

app.on('window-all-closed', quit);
app.on('activate', activate);
app.on('ready', ready);
