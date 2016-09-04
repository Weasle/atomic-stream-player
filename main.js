const electron = require('electron');
const path = require('path');
const deferred = require('deferred');
const request = require('request');
const low = require('lowdb');
const crypto = require('crypto');

const app = electron.app;
const globalShortcut = electron.globalShortcut;
const ipcMain = electron.ipcMain;

var BrowserWindow = electron.BrowserWindow;

const db = low('db');

const lastFmApiKey = '1f2f1adf1828cc2b64eaffd052d7495a';
const lastFmSharedSecret = 'e04ba9677cbf7e8fe7c753dd6ca406fd';
var tokenUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.gettoken&api_key=' + lastFmApiKey + '&format=json';
var sessionUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.getsession&api_key=' + lastFmApiKey + '&format=json';
var authUrl =  'http://www.last.fm/api/auth?api_key=' + lastFmApiKey + '&token=';

const lastFmService = {
    hasSession: false,
    session: {},
    startSession: function () {
        var dbKey = 'lastFmSession';
        var deferredResult = deferred();
        if (db.has(dbKey).value()) {
            lastFmService.hasSession = true;
            lastFmService.session = db.get(dbKey).value();
            deferredResult.resolve(lastFmService.session);
        } else {
            lastFmService.startRemoteAuth(deferredResult).then(
                function(session) {
                    db.set(dbKey, session).value();
                    lastFmService.hasSession = true;
                    lastFmService.session = session;
                    deferredResult.resolve(lastFmService.session);
                },
                function (errorResult) {
                    lastFmService.hasSession = false;
                    lastFmService.session = {};
                    deferredResult.reject(errorResult);
                }
            );
        }
        return deferredResult.promise();
    },
    startRemoteAuth: function (deferredResult) {
        request.get(tokenUrl, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var token = JSON.parse(body).token;
                lastFmService.authorizeToken(token).then(
                    function (session) {
                        deferredResult.resolve(session);
                    },
                    function (errorResult) {
                        var errorMessage = 'Failed to authorize LastFM session token.';
                        console.log(errorMessage, errorResult);
                        deferredResult.reject(errorMessage);
                    }
                );
            } else {
                errorResult = JSON.parse(response);
                console.log('Could not get access token from LastFM', errorResult);
                deferredResult.reject(errorResult);
            }
        });
        return deferredResult.promise();
    },
    authorizeToken: function (token) {
        var authResult = deferred();
        let authWin = new BrowserWindow({
            // webPreferences: {
            //    preload: path.resolve(path.join(__dirname, 'preload.js'))
            // },
            // frame: false,
            width: 640,
            height: 480
        });
        authWin.setAlwaysOnTop(true);
        authWin.loadURL(authUrl + token);
        authWin.on('closed', function () {
            console.log('AuthWindow closed');
            var sessionKey;
            var getSessionUrl = sessionUrl + '&token=' + token + '&api_sig=' + lastFmService.getRequestSignature("auth.getsession", token);
            request.get(getSessionUrl, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    session = JSON.parse(body);
                    authResult.resolve(session);
                } else {
                    console.log('LastFM Auth Error');
                    errorResult = JSON.parse(body);
                    authResult.reject(errorResult);
                }
            });
        })
        return authResult.promise();
    },
    getRequestSignature: function (method, token) {
        var data = "api_key" + lastFmApiKey + "method" + method + "token" + token + lastFmSharedSecret;
        var signature = crypto.createHash('md5').update(data).digest('hex');
        return signature;
    },
    nowPlaying: function () {
        return lastFmService.getToken().then();
    },
    scrobble: function () {

    }
};

lastFmService.startSession().then(function (session) {
    console.log('LastFM session', session);
});

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
