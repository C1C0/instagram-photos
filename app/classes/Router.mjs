import { Redirect } from './Redirect.mjs';
import { View } from './View.mjs';
import { ServerResponse, IncomingMessage } from 'http';
import querystring from 'querystring';

export const ACTION_GET = 'GET';
export const ACTION_POST = 'POST';

export class Router {
    static instance = null;

    /**
     * {ACTION:
     *  {
     *      ROUTE_PATH: callback()
     *  }
     * }
     */
    static routes = {};

    constructor() {
        console.log('init');

        Router.routes[ACTION_GET] = {};
        Router.routes[ACTION_POST] = {};

        if (!Router.instance) {
            Router.instance = this;
        }

        return Router.instance;
    }

    static get(path, callback) {
        if (path in Router.routes[ACTION_GET]) {
            throw 'Path already exists';
        }

        Router.routes[ACTION_GET][path] = callback;
    }

    static post(path, callback) {
        if (path in Router.routes[ACTION_POST]) {
            throw 'Path already exists';
        }

        Router.routes[ACTION_POST][path] = callback;
    }

    /**
     *
     * @param {IncomingMessage} req
     * @param {ServerResponse} res
     * @returns
     */
    static async handle(req, res) {
        const url = new URL('http://localhost:5600' + req.url);
        let incommingData = {};

        console.log(`Connection: ${req.method}, at '${url.pathname}'`);

        req.on('data', (data) => {
            incommingData = { ...querystring.decode(data.toString()) };
        });

        req.on('end', async () => {
            // Get $_GET parameters
            for (const [key, value] of url.searchParams.entries()) {
                incommingData[key] = value;
            }

            // check if url found for action
            if (!(url.pathname in Router.routes[req.method])) {
                res.writeHead(404);
                res.end('404');
                return;
            }

            const data = Router.routes[req.method][url.pathname](
                incommingData,
                res
            );

            if (typeof data === 'string') {
                res.setHeader('Content-Type', 'text/html');
                res.end(data);
                return;
            }

            if (data instanceof View) {
                res.setHeader('Content-Type', 'text/html');
                res.end(await data.read());
                return;
            }

            if (data instanceof Redirect) {
                res.statusCode = data.redirectStatusCode;
                res.setHeader('Location', data.redirectPath);
                res.end();
                return;
            }

            if (typeof data === 'object') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return;
            }
        });
    }

    static init() {
        return new this();
    }
}
