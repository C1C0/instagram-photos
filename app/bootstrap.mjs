import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

global.BASEDIR = path.dirname(fileURLToPath(import.meta.url));

// initialize all config files
for (let file of fs.readdirSync(global.BASEDIR + '/config')) {
    const fileName = file.split('.')[0];
    global[fileName] = (await import(global.BASEDIR + '/config/' + file))[
        fileName
    ];
}
