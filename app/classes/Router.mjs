import { Redirect } from "./Redirect.mjs";
import { View } from "./View.mjs";
import {ServerResponse} from 'http';

const ACTION_GET = 'GET';
const ACTION_POST = 'POST';

export class Router{
    static instance = null;

    /**
     * {ACTION: 
     *  {
     *      ROUTE_PATH: callback()
     *  } 
     * }
     */
    static routes = {};

    constructor(){
        console.log('init');

        Router.routes[ACTION_GET] = {};
        Router.routes[ACTION_POST] = {};

        if(!Router.instance){
            Router.instance = this;
        }

        return Router.instance;
    }

    static get(path, callback){
        if(path in Router.routes[ACTION_GET]){
            throw 'Path already exists';
        }

        Router.routes[ACTION_GET][path] = callback;
    }

    static post(path, callback){
        if(path in Router.routes[ACTION_POST]){
            throw 'Path already exists';
        }

        Router.routes[ACTION_POST][path] = callback;
    }

    /**
     * 
     * @param {*} param0 
     * @param {ServerResponse} res 
     * @returns 
     */
    static async handle({headers, method, url}, res){

        console.log(`Connection: ${method}, at '${url}'`);

        if(!(url in Router.routes[method])){
            res.writeHead(404);
            res.end('404');
            return;
        }

        const data = Router.routes[method][url](res);

        console.log(data);
        if(typeof data === "string"){
            res.setHeader("Content-Type", "text/html");
            res.end(data);
            return;
        }

        if(data instanceof View){
            res.setHeader("Content-Type", "text/html");
            res.end(await data.read());
            return;
        }

        if(data instanceof Redirect){
            res.statusCode = data.redirectStatusCode;
            res.setHeader('Location', data.redirectPath);
            res.end();
            return;
        }

        if(typeof data === "object"){
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
            return;
        }
    }

    static init(){
        return new this();
    }
}