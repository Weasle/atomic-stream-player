const electron = require('electron');
const path = require('path');
const app = electron.app;
const globalShortcut = electron.globalShortcut;
// const ipcMain = electron.ipcMain;

var BrowserWindow = electron.BrowserWindow;

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
    let win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false,
            preload: path.resolve(path.join(__dirname, 'preload.js'))
        },
        width: 1200,
        height: 800
    });
    win.loadURL('https://play.google.com/music/listen');

    var contents = win.webContents;

    contents.on('dom-ready', () => {
        console.log('Google Music DOM ready');
        contents.send('ampGpmDomReady');
        contents.insertCSS('#material-app-bar #material-one-right {visibility: hidden;}');

        globalShortcut.register('MediaPlayPause', function () {
            contents.send('ampMediaKeyPressed', 'playPause')
        });

        globalShortcut.register('MediaNextTrack', function () {
            contents.send('ampMediaKeyPressed', 'next')
        });

        globalShortcut.register('MediaPreviousTrack', function () {
            contents.send('ampMediaKeyPressed', 'previous')
        });
    });
});
