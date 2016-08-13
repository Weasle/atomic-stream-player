const {ipcRenderer} = require('electron');
var $;
const keySelectorMap = {
    playPause: '[data-id="play-pause"]',
    next: '[data-id="forward"]',
    previous: '[data-id="rewind"]',
};

ipcRenderer.on('ampGpmDomReady', (event, arg) => {
    $ = global.jQuery = require('./jquery-3.1.0.slim.min');
});

ipcRenderer.on('ampMediaKeyPressed', (event, keyPressed) => {
    console.log(keyPressed);
    var selector = keySelectorMap[keyPressed];
    var button = $(selector);
    button.click();
});
