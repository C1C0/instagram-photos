import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

global.BASEDIR = path.dirname(fileURLToPath(import.meta.url));