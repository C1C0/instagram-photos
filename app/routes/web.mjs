import { Redirect } from '../classes/Redirect.mjs';
import { Router } from '../classes/Router.mjs';
import { View } from '../classes/View.mjs';

Router.init();

Router.get('/', (res) => {
    return new View('index', {
        title: 'Instagram Photos downloader',
        showButton: true
    });
});

Router.get('/auth/', ({ code }, res) => {
    console.log(code);

    return new View('index', {
        title: 'Thank you for using this app',
        showButton: false
    });
});

Router.get('/deauth/', ({ code }, res) => {
    console.log(code);

    return new View('index', {
        title: "We are sorry to hear, that you don't want to use the app",
        showButton: false
    });
});

Router.post('/fetch-instagram-token', () => {
    const instagramOathPath = `${global.instagram.INSTAGRAM_BASE_PATH}/authorize?client_id=${global.instagram.CLIENT_ID}&redirect_uri=${global.app.FULL_PATH}/auth/&response_type=code&scope=user_profile,user_media`;
    return new Redirect(instagramOathPath, 301);
});
