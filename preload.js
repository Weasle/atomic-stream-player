const {ipcRenderer} = require('electron');
const _ = require('lodash');
var $;
const keySelectorMap = {
    playPause: '[data-id="play-pause"]',
    next: '[data-id="forward"]',
    previous: '[data-id="rewind"]'
};

function getDurationInSeconds(durationString) {
    var splitDuration = durationString.split(':');
    var minutes = 0;
    var hours = 0;
    var seconds = parseInt(splitDuration.pop());
    if (splitDuration.length > 0) {
        minutes = parseInt(splitDuration.pop());
        if (splitDuration.length > 0) {
            hours = parseInt(splitDuration.pop());
        }
    }
    var totalSeconds = hours * 60 * 60 + minutes * 60 + seconds;
    return totalSeconds;
}

ipcRenderer.on('aspGpmDomReady', (event, arg) => {
    var playRecord = {};

    $ = global.jQuery = require('jquery');

    var infoReporter = setInterval(function() {
        var duration = $('#time_container_duration').text();
        var nowPlayingInfoContainer = $('.now-playing-info-content');
        var isPlaying = $('#player-bar-play-pause').hasClass('playing');

        var nowPlaying = {
            'artist': nowPlayingInfoContainer.find('[data-type="artist"]').text(),
            'album': nowPlayingInfoContainer.find('[data-type="album"]').text(),
            'song': nowPlayingInfoContainer.find('#currently-playing-title').text(),
            'duration': getDurationInSeconds(duration),
            'albumArt': $('#playerBarArt').attr('src'),
            'isPlaying': isPlaying
        };

        if (!_.isEqual(playRecord, nowPlaying)) {
            var currentTime = $('#time_container_current').text();
            playRecord = nowPlaying;
            ipcRenderer.send('aspNowPlaying', {
                'playRecord': playRecord,
                'currentTime': getDurationInSeconds(currentTime)
            });
        }

    }, 1000);
});

ipcRenderer.on('aspMediaKeyPressed', (event, keyPressed) => {
    var selector = keySelectorMap[keyPressed];
    var button = $(selector);
    button.click();
});
