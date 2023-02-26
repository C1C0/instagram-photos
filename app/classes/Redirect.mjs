export class Redirect {
    redirectPath = null;
    redirectStatusCode = null;

    constructor(redirectPath, redirectStatusCode = 303) {
        if (!redirectPath) {
            throw 'Redirect path has to be defined';
        }

        this.redirectPath = redirectPath;
        this.redirectStatusCode = redirectStatusCode;
    }
}
