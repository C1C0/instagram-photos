import path from 'path';
import fs from 'fs';
import ejs from 'ejs';

export class View{
    filePath = null;
    options = null;

    constructor(viewName, options = null){
        if(!viewName){
            throw 'File path has to be defined';
        }

        this.filePath = View._find(viewName);
        this.options = options;
    }

    static _find(viewName){
        return path.join(BASEDIR, 'views', viewName + '.ejs');
    }

    async read(){
        if(!this.filePath){
            throw 'Incorrect view file path passed';
        }

        return await ejs.renderFile(this.filePath, this.options);
    }
}