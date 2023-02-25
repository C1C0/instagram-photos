import http from 'http';
import fs from 'fs';

import './bootstrap.mjs';
import './routes/web.mjs';
import { Router } from './classes/Router.mjs';

const server = http.createServer(Router.handle).listen(5600);