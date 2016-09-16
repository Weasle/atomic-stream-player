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
var timeoutId;

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
        var signature = crypto.createHash('md5').update(data).digest('hex');
        return signature;
    },
    nowPlaying: function (playRecord) {
        var deferredResult = deferred();
        lastFmService.startSession().then(
            function (session) {
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
    scrobble: function (playRecord, startedPlaying) {
        var deferredResult = deferred();
        lastFmService.startSession().then(
            function (session) {
                var postParams = {
                    'method': 'track.scrobble',
                    'timestamp': startedPlaying,
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
                console.log('Could not scrobble track. LastFMSession not created.');
            }
        );
        return deferredResult.promise();
    },
    loveTrack: function (playRecord, isLoved) {
        var method = isLoved ? 'track.love' : 'track.unlove';
        var deferredResult = deferred();
        lastFmService.startSession().then(
            function (session) {
                var postParams = {
                    'method': method,
                    'track': playRecord.song,
                    'artist': playRecord.artist,
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
                console.log('Could not love track. LastFMSession not created.');
            }
        );
        return deferredResult.promise();
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

    ipcMain.on('aspNowPlaying', (event, payload) => {
        console.log('Reveived nowPlaying event', payload);
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        var nowPlaying = payload.playRecord;
        var currentTime = payload.currentTime;
        if (nowPlaying.isPlaying) {
            lastFmService.nowPlaying(nowPlaying).then(function (result) {
                console.log('NowPlaying updated successfully.');
            });

            var startedPlaying = Math.floor((new Date()).getTime() / 1000);
            var timeout = 4 * 60;
            if (nowPlaying.duration < 8 * 60) {
                timeout = Math.ceil(nowPlaying.duration / 2);
            }

            timeoutId = setTimeout(function () {
                lastFmService.scrobble(nowPlaying, startedPlaying).then(function (result) {
                    console.log(result);
                });
            }, timeout * 1000);
        }
    });

    ipcMain.on('rateSong', (event, payload) => {
        lastFmService.loveTrack(payload.nowPlaying, payload.isLoved).then(function (result) {
            console.log(payload, result, 'Track un/loved successfully.');
        });
    });
});
