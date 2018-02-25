const deferred = require('deferred');
const request = require('request');
const crypto = require('crypto');
const Configstore = require('configstore');
const pkg = require('./../../package.json');
const conf = new Configstore(pkg.name, {
    foo: 'bar'
});

var lastFm = {
    session: undefined,
    startSession: function() {
        var dbKey = 'lastFmSession';
        var deferredResult = deferred();
        if (conf.has(dbKey)) {
            lastFm.session = conf.get(dbKey);
            deferredResult.resolve(lastFm.session);
        } else {
            lastFm.startRemoteAuth(deferredResult).then(
                function(session) {
                    conf.set(dbKey, session);
                    lastFm.session = session;
                    deferredResult.resolve(lastFm.session);
                },
                function(errorResult) {
                    lastFm.session = {};
                    deferredResult.reject(errorResult);
                }
            );
        }
        return deferredResult.promise();
    },
    startRemoteAuth: function(deferredResult) {
        request.get(tokenUrl, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var token = JSON.parse(body).token;
                lastFm.authorizeToken(token).then(
                    function(session) {
                        deferredResult.resolve(session.session);
                    },
                    function(errorResult) {
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
    authorizeToken: function(token) {
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
        authWin.on('closed', function() {
            console.log('AuthWindow closed');

            var sessionUrl = 'http://ws.audioscrobbler.com/2.0/?method=auth.getsession&api_key=' + lastFmApiKey + '&format=json';
            var getSessionUrl = sessionUrl + '&token=' + token + '&api_sig=' + lastFm.getRequestSignature({
                'method': "auth.getsession",
                'token': token
            });
            request.get(getSessionUrl, function(error, response, body) {
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
    getRequestSignature: function(params, withApiKey) {
        if (withApiKey ||  withApiKey === undefined) {
            params['api_key'] = lastFmApiKey;
        }

        var keys = _.keys(params);
        keys.sort();
        var data = '';
        _.forEach(keys, function(key) {
            data += key + params[key];
        });
        data += lastFmSharedSecret;
        var signature = crypto.createHash('md5').update(data).digest('hex');
        return signature;
    },
    nowPlaying: function(playRecord) {
        var deferredResult = deferred();
        lastFm.startSession().then(
            function(session) {
                var postParams = {
                    'method': 'track.updatenowplaying',
                    'artist': playRecord.artist,
                    'album': playRecord.album,
                    'track': playRecord.song,
                    'duration': playRecord.duration,
                    'sk': session.key
                };
                var signature = lastFm.getRequestSignature(postParams);
                postParams['api_sig'] = signature;
                postParams['format'] = 'json';
                request.post({
                    url: 'http://ws.audioscrobbler.com/2.0/',
                    form: postParams
                }, function(error, httpResponse, body) {
                    if (!error) {
                        var parsedBody = JSON.parse(body);
                        if (httpResponse.statusCode == 200) {
                            deferredResult.resolve(parsedBody);
                        } else {
                            deferredResult.reject(parsedBody);
                        }
                    }

                });
            },
            function(errorResult) {
                console.log('Could not send Now Playing information. LastFMSession not created.');
            }
        );
        return deferredResult.promise();
    },
    scrobble: function(playRecord, startedPlaying) {
        var deferredResult = deferred();
        lastFm.startSession().then(
            function(session) {
                var postParams = {
                    'method': 'track.scrobble',
                    'timestamp': startedPlaying,
                    'artist': playRecord.artist,
                    'album': playRecord.album,
                    'track': playRecord.song,
                    'duration': playRecord.duration,
                    'sk': session.key
                };
                var signature = lastFm.getRequestSignature(postParams);
                postParams['api_sig'] = signature;
                postParams['format'] = 'json';
                request.post({
                    url: 'http://ws.audioscrobbler.com/2.0/',
                    form: postParams
                }, function(error, httpResponse, body) {
                    if (!error) {
                        var parsedBody = JSON.parse(body);
                        if (httpResponse.statusCode == 200) {
                            deferredResult.resolve(parsedBody);
                        } else {
                            deferredResult.reject(parsedBody);
                        }
                    }

                });
            },
            function(errorResult) {
                console.log('Could not scrobble track. LastFMSession not created.');
            }
        );
        return deferredResult.promise();
    },
    loveTrack: function(playRecord, isLoved) {
        var method = isLoved ? 'track.love' : 'track.unlove';
        var deferredResult = deferred();
        lastFm.startSession().then(
            function(session) {
                var postParams = {
                    'method': method,
                    'track': playRecord.song,
                    'artist': playRecord.artist,
                    'sk': session.key
                };
                var signature = lastFm.getRequestSignature(postParams);
                postParams['api_sig'] = signature;
                postParams['format'] = 'json';
                request.post({
                    url: 'http://ws.audioscrobbler.com/2.0/',
                    form: postParams
                }, function(error, httpResponse, body) {
                    if (!error) {
                        var parsedBody = JSON.parse(body);
                        if (httpResponse.statusCode == 200) {
                            deferredResult.resolve(parsedBody);
                        } else {
                            deferredResult.reject(parsedBody);
                        }
                    }
                });
            },
            function(errorResult) {
                console.log('Could not love track. LastFMSession not created.');
            }
        );
        return deferredResult.promise();
    }
};

module.exports = lastFm;
