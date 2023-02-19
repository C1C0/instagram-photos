import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const server = http.createServer(async (req, res) => {
    const defaultHeaders = {
        'Content-type': 'application/json',
        'Accept': 'application/json',
    }

    if (req.method === 'POST') {
        switch (req?.url) {
            case '/callback/instagram':
                res.writeHead(200, defaultHeaders);
                console.log('Received callback');
                console.log('Reading', req.read());
                await fs.writeFile(`${process.env.TOKENS_FILE_NAME}.json`, req.read());

                break;
            default:
                console.log('Unsupported POST route tried - Forbidden');
                res.writeHead(400, defaultHeaders);
                res.end('Forbidden');
                return;
        }
    } else {
        console.log('Get Tried - FORBIDDEN');
        res.end('Forbidden');
        return;
    }
    
    res.end();

}).listen(5600);