const lastFmApiKey = '1f2f1adf1828cc2b64eaffd052d7495a';
const lastFmSharedSecret = 'e04ba9677cbf7e8fe7c753dd6ca406fd';

// token = 'http://ws.audioscrobbler.com/2.0/?method=auth.gettoken&api_key=' + lastFmApiKey + '&format=json';
// http://www.last.fm/api/auth?api_key=' + lastFmApiKey + '&token=' + token;

console.log($);

return lastFmService = {
    getToken: function () {
        let win = new BrowserWindow({
          width: 100, height: 100, show: false
        })
    },
    authorize: function () {},
    getSession: function () {}
};
