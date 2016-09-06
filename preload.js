const {ipcRenderer} = require('electron');
const _ = require('lodash');
var $;
const keySelectorMap = {
    playPause: '[data-id="play-pause"]',
    next: '[data-id="forward"]',
    previous: '[data-id="rewind"]'
};

ipcRenderer.on('aspGpmDomReady', (event, arg) => {
    var isPlaying = false;
    var playRecord = {
        'artists': undefined,
        'album': undefined,
        'song': undefined,
        'albumArt': undefined
    };

    $ = global.jQuery = require('jquery');

    var infoReporter = setInterval(function() {
        var nowPlayingInfoContainer = $('.now-playing-info-content');
        var nowPlaying = {
            'artist': nowPlayingInfoContainer.find('[data-type="artist"]').text(),
            'album': nowPlayingInfoContainer.find('[data-type="album"]').text(),
            'song': nowPlayingInfoContainer.find('#currently-playing-title').text(),
            'duration': $('#time_container_duration').text(),
            'albumArt': $('#playerBarArt').attr('src')
        };
        if (nowPlaying.artist.length > 0) {
            isPlaying = true;
        }

        if (isPlaying && !_.isEqual(playRecord, nowPlaying)) {
            playRecord = nowPlaying;
            ipcRenderer.send('aspNowPlaying', playRecord);
        }

    }, 1000);
});

ipcRenderer.on('aspMediaKeyPressed', (event, keyPressed) => {
    var selector = keySelectorMap[keyPressed];
    var button = $(selector);
    button.click();
});
