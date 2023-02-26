import fs from 'fs';
import jimp from 'jimp';

export const MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png'
};

const FONT_SANS_SERIF_16_PX = global.BASEDIR + '/assets/fonts/sans-serif.fnt';
const FONT_SANS_SERIF_14_PX =
    global.BASEDIR + '/assets/fonts/sans-serif-14.fnt';

export default class Fetcher {
    #graphPath = global.instagram.INSTAGRAM_GRAPH_PATH;
    #mediaFolder = process.env.MEDIA_FOLDER;

    #accessToken = null;

    /**
     * @type {string | null}
     */
    #username = null;

    #mediaFields = ['id', 'caption', 'media_url', 'media_type', 'timestamp'];
    #userFields = ['id', 'username'];

    constructor(token) {
        if (!token) {
            throw 'Token Undefined';
        }

        this.#accessToken = token;
    }

    getUserURL() {
        return this.#graphPath + '/me' + this.#getQuery(this.#userFields);
    }

    getMediaURL() {
        return (
            this.#graphPath + '/me/media' + this.#getQuery(this.#mediaFields)
        );
    }

    #getChildrenMediaURL(mediaId) {
        return (
            this.#graphPath +
            '/' +
            mediaId +
            '/children' +
            this.#getQuery(
                this.#mediaFields.filter((field) => field !== 'caption')
            )
        );
    }

    #getQuery(fields = []) {
        return (
            '?fields=' + fields.join(',') + '&access_token=' + this.#accessToken
        );
    }

    async #generateImage(hexNumber, width, height) {
        return new jimp(width, height, (err, image) => {
            for (let row = 0; row < width; row++) {
                for (let column = 0; column < height; column++) {
                    image.setPixelColor(hexNumber, row, column);
                }
            }
        });
    }

    async #fetchUsername() {
        const response = await fetch(this.getUserURL());
        const userData = await response.json();

        this.#username = userData.username;
    }

    async #fetchAllMedia(next = null) {
        const response = await fetch(next ?? this.getMediaURL());
        return await response.json();
    }

    async #fetchAllChildren(mediaId) {
        console.log(this.#getChildrenMediaURL(mediaId));
        const response = await fetch(this.#getChildrenMediaURL(mediaId));
        return await response.json();
    }

    #checkAndCreateMediaFolder(mediaFileName) {
        if (!fs.existsSync(this.#mediaFolder)) {
            fs.mkdirSync(this.#mediaFolder);
        }

        const mediaFileDir = mediaFileName.split('/').slice(0, -1).join('/');
        if (!fs.existsSync(mediaFileDir)) {
            console.log('Creating dir', mediaFileDir);
            fs.mkdirSync(mediaFileDir);
        }
    }

    #checkAndRemoveUserJson(mediaFileName) {
        if (fs.existsSync(mediaFileName)) {
            fs.rmSync(mediaFileName);
        }
    }

    async #fetchAlbumsMedia(album) {
        console.log('album', album);
        album.children = [];
        const content = await this.#fetchAllChildren(album.id);
        console.log('content', content);
        const data = content.data;

        album.children.push(...data);
    }

    #getUsersFolderPath() {
        return (
            this.#mediaFolder + '/' + this.#username.replace(/(\.)/g, '') + '/'
        );
    }

    #getUsersJSONDataPath() {
        return this.#getUsersFolderPath() + 'data.json';
    }

    #getUsersImagesPath() {
        return this.#getUsersFolderPath() + 'images/';
    }

    #getUsersEditedPath() {
        return this.#getUsersFolderPath() + 'edited/';
    }

    async #fetchUserData() {
        await this.#fetchUsername();
        console.log('username fetched');

        if (!this.#username) {
            throw 'username undefined';
        }

        const mediaFileName = this.#getUsersJSONDataPath();
        console.log('Media file', mediaFileName);

        this.#checkAndCreateMediaFolder(mediaFileName);
        this.#checkAndRemoveUserJson(mediaFileName);

        let body,
            nextLink,
            content,
            total = 0;

        const file = await fs.promises.open(mediaFileName, 'a+');
        await file.write(`
{
    "username":"${this.#username}",
    "data": [
        `);

        let max = 1;
        let actual = 0;

        // data (images links, description, time, etc...)
        do {
            actual++;
            body = await this.#fetchAllMedia(nextLink);

            console.log('fetched all media');

            nextLink = body?.paging?.next;
            content = body.data;
            total += body.data.length;

            // get albums media
            // for (let part of content) {
            //     if (part.media_type === 'CAROUSEL_ALBUM') {
            //         await this.#fetchAlbumsMedia(part);
            //     }
            // }
            content = JSON.stringify(body.data);

            // Determine, if trailing comma needed for next batch of data
            content =
                content.substring(1, content.length - 1) +
                (nextLink && actual < max ? ',' : '');

            await file.write(content);
        } while (nextLink && actual < max);

        await file.write(
            `
    ], "total": ${total}
}`
        );

        console.log('Fetching finished');
    }

    #checkAndCreateUsersImageFolder(originalImagesFolder) {
        if (!fs.existsSync(originalImagesFolder)) {
            fs.mkdirSync(originalImagesFolder, { recursive: true });
        }
    }

    async #getAndSaveImage(contentData, originalImagesFolder) {
        await fetch(contentData.media_url)
            .then(async (response) => [
                await response.arrayBuffer(),
                response.headers.get('content-type')
            ])
            .then(async ([arrayBuffer, mimeTypeHeader]) => {
                const finalDestination =
                    global.BASEDIR +
                    '/../' +
                    originalImagesFolder +
                    contentData.id +
                    MIME_TYPES[mimeTypeHeader];

                fs.writeFileSync(finalDestination, Buffer.from(arrayBuffer));
            });
    }

    async #getImages() {
        const file = fs.readFileSync(this.#getUsersJSONDataPath());

        const data = JSON.parse(file.toString());

        const originalImagesFolder = this.#getUsersImagesPath();
        this.#checkAndCreateUsersImageFolder(originalImagesFolder);

        for (let el of data.data) {
            if (el.media_type !== 'IMAGE') {
                continue;
            }

            await this.#getAndSaveImage(el, originalImagesFolder);
        }

        console.log('finished fetching images');
    }

    #checkAndCreateEditedImagesFolder(editedImagesFolder) {
        if (!fs.existsSync(editedImagesFolder)) {
            fs.mkdirSync(editedImagesFolder, { recursive: true });
        }
    }

    async #editImages() {
        const file = fs.readFileSync(this.#getUsersJSONDataPath());
        const data = JSON.parse(file);

        const editedImagesFolder = this.#getUsersEditedPath();
        const originalImagesFolder = this.#getUsersImagesPath();

        const WHITE_COLOR = 0xffffffff;
        const images = fs.readdirSync(originalImagesFolder);

        this.#checkAndCreateEditedImagesFolder(editedImagesFolder);

        console.log('everything loaded');

        const font = await jimp.loadFont(FONT_SANS_SERIF_16_PX);
        const font14px = await jimp.loadFont(FONT_SANS_SERIF_14_PX);
        const smallFont = await jimp.loadFont(jimp.FONT_SANS_10_BLACK);

        for (let i = 0; i < 10; i++) {
            const imageData = data.data[i];

            console.log('image', imageData);

            if (imageData.media_type !== 'IMAGE') {
                continue;
            }

            let textArray = [
                data.username,
                'Posted: ' +
                    new Date(imageData.timestamp).toLocaleDateString('sk-SK', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }),
                ...(imageData.caption?.split('\n') ?? [''])
            ];

            textArray = textArray.filter((text) => text !== '.');

            console.log('Image index: ', imageData.id);

            // Dimensions of image, that is used for final printing
            const TOTAL_MAX_WIDTH = 375;
            const TOTAL_MAX_HEIGHT = 500;

            const BG_PADDING_TOP = 10;
            const BG_PADDING_BOTTOM = 10;
            const BG_PADDING_LEFT = 10;
            const BG_PADDING_RIGHT = 10;

            const MAX_IMAGE_HEIGHT = 276 - BG_PADDING_TOP;
            const MAX_IMAGE_WIDTH =
                TOTAL_MAX_WIDTH - BG_PADDING_LEFT - BG_PADDING_RIGHT;

            const IMAGE_PADDING_BOTTOM = 30;

            const TEXT_DIFF_PARAGRAPH_PADDING = 10;
            const TEXT_WIDTH = 15;
            const TEXT_MAX_WIDTH = MAX_IMAGE_WIDTH - TEXT_WIDTH;

            const sameTextParagraphPadding = 6;
            const lineHeightPadding = 2;
            let textHeight = 0;

            textArray.forEach((text, index) => {
                if (index === 0) {
                    textHeight +=
                        jimp.measureTextHeight(font, text, TEXT_MAX_WIDTH) +
                        TEXT_DIFF_PARAGRAPH_PADDING;
                }

                if (index === 1) {
                    textHeight +=
                        jimp.measureTextHeight(
                            smallFont,
                            text,
                            TEXT_MAX_WIDTH
                        ) + TEXT_DIFF_PARAGRAPH_PADDING;
                }

                if (index > 1) {
                    textHeight +=
                        jimp.measureTextHeight(font14px, text, TEXT_MAX_WIDTH) +
                        sameTextParagraphPadding;
                }
            });

            const REQUIRED_HEIGHT =
                BG_PADDING_TOP +
                MAX_IMAGE_HEIGHT +
                IMAGE_PADDING_BOTTOM +
                textHeight +
                BG_PADDING_BOTTOM;

            const backgroundImage =
                TOTAL_MAX_HEIGHT - REQUIRED_HEIGHT <= 0
                    ? await this.#generateImage(
                          WHITE_COLOR,
                          MAX_IMAGE_WIDTH + BG_PADDING_LEFT + BG_PADDING_RIGHT,
                          REQUIRED_HEIGHT
                      )
                    : await this.#generateImage(WHITE_COLOR, 375, 500);

            const image = await jimp.read(
                originalImagesFolder + imageData.id + '.jpg'
            );
            const initialImageWidth = image._exif.imageSize.width;
            const initialImageHeight = image._exif.imageSize.height;

            const blurredImage = await jimp.read(
                originalImagesFolder + imageData.id + '.jpg'
            );
            const borderRadiusMask = await jimp.read(
                global.BASEDIR + '/../mask-border-radius.jpg'
            );

            image.contain(
                MAX_IMAGE_WIDTH,
                MAX_IMAGE_HEIGHT,
                jimp.HORIZONTAL_ALIGN_CENTER | jimp.VERTICAL_ALIGN_MIDDLE
            );

            blurredImage
                .gaussian(4)
                .cover(
                    MAX_IMAGE_WIDTH,
                    MAX_IMAGE_HEIGHT,
                    jimp.VERTICAL_ALIGN_MIDDLE | jimp.HORIZONTAL_ALIGN_CENTER
                )
                .mask(borderRadiusMask, 0, 0);

            if (initialImageHeight >= initialImageWidth) {
                const newWidth =
                    (MAX_IMAGE_HEIGHT / initialImageHeight) * initialImageWidth;

                borderRadiusMask.resize(newWidth, MAX_IMAGE_HEIGHT);
                image.mask(
                    borderRadiusMask,
                    (MAX_IMAGE_WIDTH - newWidth) / 2,
                    0
                );
            } else {
                const newHeight =
                    (MAX_IMAGE_WIDTH / initialImageWidth) * initialImageHeight;

                borderRadiusMask.resize(MAX_IMAGE_WIDTH, newHeight);
                image.mask(
                    borderRadiusMask,
                    0,
                    (MAX_IMAGE_HEIGHT - newHeight) / 2
                );
            }

            let lineY = MAX_IMAGE_HEIGHT + IMAGE_PADDING_BOTTOM;

            textArray.forEach((text, index) => {
                if (index === 0) {
                    backgroundImage.print(
                        font,
                        TEXT_WIDTH,
                        lineY,
                        text,
                        TEXT_MAX_WIDTH
                    );
                    lineY +=
                        jimp.measureTextHeight(font, text, TEXT_MAX_WIDTH) +
                        TEXT_DIFF_PARAGRAPH_PADDING;
                }

                if (index === 1) {
                    backgroundImage.print(
                        smallFont,
                        TEXT_WIDTH,
                        lineY,
                        text,
                        TEXT_MAX_WIDTH
                    );
                    lineY +=
                        jimp.measureTextHeight(
                            smallFont,
                            text,
                            TEXT_MAX_WIDTH
                        ) + TEXT_DIFF_PARAGRAPH_PADDING;
                }

                if (index > 1) {
                    backgroundImage.print(
                        font14px,
                        TEXT_WIDTH,
                        lineY + lineHeightPadding,
                        text,
                        TEXT_MAX_WIDTH
                    );
                    lineY +=
                        jimp.measureTextHeight(font14px, text, TEXT_MAX_WIDTH) +
                        sameTextParagraphPadding;
                }
            });

            if (initialImageHeight / initialImageWidth === 0.75) {
                console.log('without blurred background');
                backgroundImage
                    .blit(image, 10, 10)
                    .write(editedImagesFolder + images[i]);

                continue;
            }

            backgroundImage
                .blit(blurredImage, 10, 10)
                .blit(image, 10, 10)
                .write(editedImagesFolder + images[i]);
        }
    }

    async start() {
        await this.#fetchUserData();
        await this.#getImages();
        await this.#editImages();
    }
}
