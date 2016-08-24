const electron = require('electron');
const path = require('path');
const app = electron.app;
const globalShortcut = electron.globalShortcut;
const ipcMain = electron.ipcMain;

var BrowserWindow = electron.BrowserWindow;


const request = require('request');
const lastFmApiKey = '1f2f1adf1828cc2b64eaffd052d7495a';
const lastFmSharedSecret = 'e04ba9677cbf7e8fe7c753dd6ca406fd';


var tokenUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.gettoken&api_key=' + lastFmApiKey + '&format=json';
var sessionUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.getsession&api_key=' + lastFmApiKey + '&format=json';
var authUrl =  'http://www.last.fm/api/auth?api_key=' + lastFmApiKey + '&token=';

const lastFmService = {
    getToken: function () {
        var token;
        console.log(tokenUrl);
        request.get(tokenUrl, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                token = JSON.parse(body).token;
                lastFmService.authorize(token);
            } else {
                console.log(JSON.parse(response));
            }
        });
        return token;
    },
    authorize: function (token) {
        console.log(token);
        let authWin = new BrowserWindow({
            // webPreferences: {
            //    preload: path.resolve(path.join(__dirname, 'preload.js'))
            // },
            // frame: false,
            width: 640,
            height: 480
        });
        // win.loadURL('https://play.google.com/music/listen');
        authWin.setAlwaysOnTop(true);
        authWin.loadURL(authUrl + token);
        authWin.on('closed', function () {
            console.log('AuthWindow closed');
            lastFmService.getSession(token);
        })
    },
    getSession: function (token) {
        console.log(token);
        var data = "api_key" + lastFmApiKey + "methodauth.getsessiontoken" + token + lastFmSharedSecret;
        var crypto = require('crypto');
        var signature = crypto.createHash('md5').update(data).digest('hex');
        var getSessionUrl = sessionUrl + '&token=' + token + '&api_sig=' + signature;

        request.get(getSessionUrl, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('success');
                console.log(JSON.parse(body));
            } else {
                console.log('error');
                console.log(JSON.parse(body));
            }
        });
    }
};

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
    var token = lastFmService.getToken();

    let win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false,
            preload: path.resolve(path.join(__dirname, 'preload.js'))
        },
        width: 1200,
        height: 800
    });
    // win.loadURL('https://play.google.com/music/listen');
    win.loadURL(`file://${__dirname}/index.html`);

    var contents = win.webContents;

    contents.on('dom-ready', () => {
        console.log('Google Music DOM ready');

        contents.send('aspGpmDomReady');
        contents.insertCSS('#material-app-bar #material-one-right {visibility: hidden;}');

        globalShortcut.register('MediaPlayPause', function () {
            contents.send('aspMediaKeyPressed', 'playPause')
        });

        globalShortcut.register('MediaNextTrack', function () {
            contents.send('aspMediaKeyPressed', 'next')
        });

        globalShortcut.register('MediaPreviousTrack', function () {
            contents.send('aspMediaKeyPressed', 'previous')
        });
    });

    ipcMain.on('aspNowPlaying', (event, nowPlaying) => {
        console.log(nowPlaying)
    });
});
