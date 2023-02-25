import fs from 'fs';
import jimp from 'jimp';
import { Readable } from 'stream';

export const MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png'
};

const FONT_SANS_SERIF_16_PX =
    global.app.BASEDIR + '/assets/fonts/sans-serif.fnt';
const FONT_SANS_SERIF_14_PX =
    global.app.BASEDIR + '/assets/fonts/sans-serif-14.fnt';

export default class Fetcher {
    #graphPath = global.instagram.INSTAGRAM_GRAPH_PATH;
    #accessToken = global.instagram.IG_TOKEN;

    #mediaFields = ['id', 'caption', 'media_url', 'media_type', 'timestamp'];
    #userFields = ['id', 'username'];

    async getUsername() {
        return (
            await (await fetch(this.#graphPath + '/me' + QUERY_USER)).json()
        ).username;
    }

    async downloadAllMedia(next = null) {
        const response = await fetch(
            next ?? this.#graphPath + '/me/media' + QUERY_MEDIA
        );
        return await response.json();
    }

    async downloadChildren(mediaId) {
        const response = await fetch(
            this.#graphPath + '/' + mediaId + '/children?' + QUERY_MEDIA
        );
        return await response.json();
    }
}
