const {ipcRenderer} = require('electron');
var $;
const keySelectorMap = {
    playPause: '[data-id="play-pause"]',
    next: '[data-id="forward"]',
    previous: '[data-id="rewind"]',
};

ipcRenderer.on('aspGpmDomReady', (event, arg) => {
    $ = global.jQuery = require('jquery');

    var infoReporter = setInterval(function() {
        var nowPlayingInfoContainer = $('.now-playing-info-content');
        var artist = nowPlayingInfoContainer.find('[data-type="artist"]').text();
        var album = nowPlayingInfoContainer.find('[data-type="album"]').text();
        var song = nowPlayingInfoContainer.find('#currently-playing-title').text();
        var albumArt = $('#playerBarArt').attr('src');
        ipcRenderer.send('aspNowPlaying', {
            'artists': artist,
            'album': album,
            'song': song,
            'albumArt': albumArt
        });
    }, 1000);
});

ipcRenderer.on('aspMediaKeyPressed', (event, keyPressed) => {
    var selector = keySelectorMap[keyPressed];
    var button = $(selector);
    button.click();
});
