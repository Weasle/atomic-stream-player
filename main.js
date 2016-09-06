const electron = require('electron');
const path = require('path');
const deferred = require('deferred');
const request = require('request');
const low = require('lowdb');
const crypto = require('crypto');
const _ = require('lodash');

const app = electron.app;
const globalShortcut = electron.globalShortcut;
const ipcMain = electron.ipcMain;

var BrowserWindow = electron.BrowserWindow;

const db = low('db');

const lastFmApiKey = '1f2f1adf1828cc2b64eaffd052d7495a';
const lastFmSharedSecret = 'e04ba9677cbf7e8fe7c753dd6ca406fd';
var tokenUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.gettoken&api_key=' + lastFmApiKey + '&format=json';
var authUrl =  'http://www.last.fm/api/auth?api_key=' + lastFmApiKey + '&token=';

const lastFmService = {
    session: undefined,
    startSession: function () {
        var dbKey = 'lastFmSession';
        var deferredResult = deferred();
        if (db.has(dbKey).value()) {
            lastFmService.session = db.get(dbKey).value();
            deferredResult.resolve(lastFmService.session);
        } else {
            lastFmService.startRemoteAuth(deferredResult).then(
                function(session) {
                    db.set(dbKey, session).value();
                    lastFmService.session = session;
                    deferredResult.resolve(lastFmService.session);
                },
                function (errorResult) {
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
                        deferredResult.resolve(session.session);
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

            var sessionUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.getsession&api_key=' + lastFmApiKey + '&format=json';
            var getSessionUrl = sessionUrl + '&token=' + token + '&api_sig=' + lastFmService.getRequestSignature({
                'method': "auth.getsession",
                'token': token
            });
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
    getRequestSignature: function (params, withApiKey) {
        if (withApiKey || withApiKey === undefined) {
            params['api_key'] = lastFmApiKey;
        }

        var keys = _.keys(params);
        keys.sort();
        var data = '';
        _.forEach(keys, function (key) {
            data += key + params[key];
        });
        data += lastFmSharedSecret;
        console.log('Signature data: ' + data);
        var signature = crypto.createHash('md5').update(data).digest('hex');
        return signature;
    },
    nowPlaying: function (playRecord) {
        var deferredResult = deferred();
        lastFmService.startSession().then(
            function (session) {
                var artist = encodeURIComponent(playRecord.artist);
                var album = encodeURIComponent(playRecord.album);
                var track = encodeURIComponent(playRecord.song);
                var sessionKey = session.key;
                var postParams = {
                    'method': 'track.updatenowplaying',
                    'artist': playRecord.artist,
                    'album': playRecord.album,
                    'track': playRecord.song,
                    'duration': playRecord.duration,
                    'sk': session.key
                };
                var signature = lastFmService.getRequestSignature(postParams);
                postParams['api_sig'] = signature;
                postParams['format'] = 'json';
                request.post(
                    {
                        url:'http://ws.audioscrobbler.com/2.0/',
                        form: postParams
                    }, function(error, httpResponse, body){
                        if (!error) {
                            var parsedBody = JSON.parse(body);
                            if (httpResponse.statusCode == 200) {
                                deferredResult.resolve(parsedBody);
                            } else {
                                deferredResult.reject(parsedBody);
                            }
                        }

                    }
                );
            },
            function (errorResult) {
                console.log('Could not send Now Playing information. LastFMSession not created.');
            }
        );
        return deferredResult.promise();
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
    win.loadURL('https://play.google.com/music/listen');
    // win.loadURL(`file://${__dirname}/index.html`);

    var contents = win.webContents;

    contents.on('dom-ready', () => {
        console.log('Google Music DOM ready');

        contents.send('aspGpmDomReady');
        contents.insertCSS('#material-app-bar #material-one-right {visibility: hidden;}');

        globalShortcut.register('MediaPlayPause', function () {
            contents.send('aspMediaKeyPressed', 'playPause');
        });

        globalShortcut.register('MediaNextTrack', function () {
            contents.send('aspMediaKeyPressed', 'next');
        });

        globalShortcut.register('MediaPreviousTrack', function () {
            contents.send('aspMediaKeyPressed', 'previous');
        });
    });

    ipcMain.on('aspNowPlaying', (event, nowPlaying) => {
        lastFmService.nowPlaying(nowPlaying).then(function (result) {
            console.log(result);
        });
        var duration = nowPlaying.duration;
        var splitDuration = duration.split(':');
        var minutes = 0;
        var hours = 0;
        var timeout = 4 * 60;
        var seconds = splitDuration.pop();
        if (splitDuration.length > 0) {
            minutes = splitDuration.pop();
            if (splitDuration.length > 0) {
                hours = splitDuration.pop();
            }
        }
        var totalSeconds = hours * 60 * 60 + minutes * 60 + seconds;
        if (totalSeconds < 4 * 60) {
            timeout = (totalSeconds / 2);
        }
        setTimeout(function () {
            lastFmService.scrobble(nowPlaying);
        }, timeout * 1000);

    });
});
