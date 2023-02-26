import http from 'https';
import fs from 'fs';

import './bootstrap.mjs';
import './routes/web.mjs';
import { Router } from './classes/Router.mjs';

console.log('Server path:', global.app.FULL_PATH);

const server = http
    .createServer(
        {
            key: fs.readFileSync(global.BASEDIR + '/keys/key.pem'),
            cert: fs.readFileSync(global.BASEDIR + '/keys/cert.pem')
        },
        Router.handle
    )
    .listen(5600, global.app.DOMAIN);

console.log('running');
