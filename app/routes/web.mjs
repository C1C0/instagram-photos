import { Redirect } from '../classes/Redirect.mjs';
import { Router } from '../classes/Router.mjs';
import { View } from '../classes/View.mjs';
import childProcess from 'child_process';

Router.init();

Router.get('/', (res) => {
    return new View('index', {
        title: 'Instagram Photos downloader',
        showButton: true
    });
});

Router.get('/auth/', async ({ code }, res) => {
    // get short lived token
    const instagramShortLivedTokenPath = `${global.instagram.INSTAGRAM_BASE_PATH}/access_token`;
    const body = {
        client_id: parseInt(global.instagram.CLIENT_ID),
        client_secret: global.instagram.CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: `${global.app.FULL_PATH}/auth/`,
        code: code
    };

    const form = new FormData();

    for(let key in body){
      form.append(key, body[key]);
    }

    const response = await fetch(instagramShortLivedTokenPath, {
        method: 'POST',
        body: form
    });

    const data = await response.json();
    const token = data.access_token;

    console.log(token);

    return new View('fetch-content', {
      title: 'Thank you for using this app',
      token
  });
});

Router.get('/deauth/', () => {
    return new View('index', {
        title: "We are sorry to hear, that you don't want to use the app",
        showButton: false
    });
});

Router.post('/fetch-instagram-token', () => {
    const instagramOathPath = `${global.instagram.INSTAGRAM_BASE_PATH}/authorize?client_id=${global.instagram.CLIENT_ID}&redirect_uri=${global.app.FULL_PATH}/auth/&response_type=code&scope=user_profile,user_media,instagram_graph_user_profile`;
    return new Redirect(instagramOathPath, 301);
});

Router.post('/fetch-content', ({ authorizedToken }) => {
    console.log('Started fetching');

    childProcess.fork(global.BASEDIR + '/jobs/fetch.mjs', [
        '--token=' + authorizedToken
    ]);

    return { message: 'Fetching started' };
});
