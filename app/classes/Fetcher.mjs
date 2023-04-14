import fs from 'fs';
import jimp from 'jimp';
import sharp from 'sharp';

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

    // Dimensions of image, that is used for final printing
    #TOTAL_MAX_WIDTH = 750;
    #TOTAL_MAX_HEIGHT = 1000;

    #BG_PADDING_TOP = 10;
    #BG_PADDING_BOTTOM = 10;
    #BG_PADDING_LEFT = 10;
    #BG_PADDING_RIGHT = 10;

    #MAX_TEXT_HEIGHT = 500;

    #MAX_IMAGE_HEIGHT =
        this.#TOTAL_MAX_HEIGHT - this.#MAX_TEXT_HEIGHT - this.#BG_PADDING_TOP;
    #MAX_IMAGE_WIDTH =
        this.#TOTAL_MAX_WIDTH - this.#BG_PADDING_LEFT - this.#BG_PADDING_RIGHT;

    #IMAGE_PADDING_BOTTOM = 30;

    #TEXT_DIFF_PARAGRAPH_PADDING = 10;
    #TEXT_WIDTH = 15;
    #TEXT_MAX_WIDTH = this.#MAX_IMAGE_WIDTH - this.#TEXT_WIDTH;

    #SAME_TEXT_PARAGRAPH_PADDING = 6;
    #LINE_HEIGHT_PADDING = 2;

    #FONT = null;
    #FONT14PX = null;
    #SMALLFONT = null;

    #COLORS = {
        WHITE: 0xffffffff
    };

    constructor(token, font, font14px, smallFont) {
        if (!token) {
            throw 'Token Undefined';
        }

        this.#accessToken = token;

        this.#FONT = font;
        this.#FONT14PX = font14px;
        this.#SMALLFONT = smallFont;
    }

    static async make(token) {
        const font = await jimp.loadFont(FONT_SANS_SERIF_16_PX);
        const font14px = await jimp.loadFont(FONT_SANS_SERIF_14_PX);
        const smallFont = await jimp.loadFont(jimp.FONT_SANS_10_BLACK);

        return new this(token, font, font14px, smallFont);
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

    #getUsersOriginalEditedPath() {
        return this.#getUsersFolderPath() + 'edited/original/';
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

        // data (images links, description, time, etc...)
        do {
            body = await this.#fetchAllMedia(nextLink);

            console.log('fetched all media');

            nextLink = body?.paging?.next;
            content = body.data;
            total += body.data.length;

            // get albums media
            for (let part of content) {
                if (part.media_type === 'CAROUSEL_ALBUM') {
                    await this.#fetchAlbumsMedia(part);
                }
            }
            content = JSON.stringify(body.data);

            // Determine, if trailing comma needed for next batch of data
            content =
                content.substring(1, content.length - 1) +
                (nextLink ? ',' : '');

            await file.write(content);
        } while (nextLink);

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
                let customMime = false;
                let mime = MIME_TYPES[mimeTypeHeader];

                if (!mime) {
                    customMime = true;
                    mime = '.' + mimeTypeHeader.split('/')[1];
                }

                const finalDestination =
                    global.BASEDIR +
                    '/../' +
                    originalImagesFolder +
                    contentData.id +
                    mime;

                if (fs.existsSync(finalDestination)) {
                    return;
                }

                fs.writeFileSync(finalDestination, Buffer.from(arrayBuffer));

                if (customMime) {
                    await this.sleep(1000);
                }
            });

        // await this.sleep(300);
    }

    async #getImages() {
        const file = fs.readFileSync(this.#getUsersJSONDataPath());

        const data = JSON.parse(file.toString());

        const originalImagesFolder = this.#getUsersImagesPath();
        this.#checkAndCreateUsersImageFolder(originalImagesFolder);

        for (let el of data.data) {
            if (el.media_type === 'IMAGE') {
                await this.#getAndSaveImage(el, originalImagesFolder);
            }

            if (el.media_type === 'CAROUSEL_ALBUM') {
                this.#checkAndPrepareAlbumFolder(originalImagesFolder + el.id);

                for (let albumEl of el.children) {
                    await this.#getAndSaveImage(
                        albumEl,
                        originalImagesFolder + el.id + '/'
                    );
                }
            }
        }

        await this.sleep(5000);
        console.log('finished fetching images');
    }

    #checkAndPrepareAlbumFolder(albumFolderPath) {
        if (fs.existsSync(albumFolderPath)) {
            fs.rmdirSync(albumFolderPath);
        }

        fs.mkdirSync(albumFolderPath);
    }

    #checkAndCreateEditedImagesFolder(editedImagesFolder) {
        if (!fs.existsSync(editedImagesFolder)) {
            fs.mkdirSync(editedImagesFolder, { recursive: true });
        }
    }

    #checkAndCreateEditedOriginalImagesFolder(originalImagesFolder) {
        if (!fs.existsSync(originalImagesFolder)) {
            fs.mkdirSync(originalImagesFolder, { recursive: true });
        }
    }

    getTextHeight(textArray) {
        let textHeight = 0;

        textArray.forEach((text, index) => {
            if (index === 0) {
                textHeight +=
                    jimp.measureTextHeight(
                        this.#FONT,
                        text,
                        this.#TEXT_MAX_WIDTH
                    ) + this.#TEXT_DIFF_PARAGRAPH_PADDING;
            }

            if (index === 1) {
                textHeight +=
                    jimp.measureTextHeight(
                        this.#SMALLFONT,
                        text,
                        this.#TEXT_MAX_WIDTH
                    ) + this.#TEXT_DIFF_PARAGRAPH_PADDING;
            }

            if (index > 1) {
                textHeight +=
                    jimp.measureTextHeight(
                        this.#FONT14PX,
                        text,
                        this.#TEXT_MAX_WIDTH
                    ) + this.#SAME_TEXT_PARAGRAPH_PADDING;
            }
        });

        return textHeight;
    }

    #getTextArrayWhichFits(textArray) {
        const newTextArray = [];
        let textHeight = 0;

        for (const [index, text] of textArray.entries()) {
            if (index === 0) {
                newTextArray.push(text);
                textHeight +=
                    jimp.measureTextHeight(
                        this.#FONT,
                        text,
                        this.#TEXT_MAX_WIDTH
                    ) + this.#TEXT_DIFF_PARAGRAPH_PADDING;
                continue;
            }

            if (index === 1) {
                newTextArray.push(text);
                textHeight +=
                    jimp.measureTextHeight(
                        this.#SMALLFONT,
                        text,
                        this.#TEXT_MAX_WIDTH
                    ) + this.#TEXT_DIFF_PARAGRAPH_PADDING;
                continue;
            }

            if (index > 1) {
                const addition =
                    jimp.measureTextHeight(
                        this.#FONT14PX,
                        text,
                        this.#TEXT_MAX_WIDTH
                    ) + this.#SAME_TEXT_PARAGRAPH_PADDING;

                if (
                    addition + textHeight >=
                    this.#TOTAL_MAX_HEIGHT - this.#MAX_IMAGE_HEIGHT
                ) {
                    newTextArray[index - 1] += '...';
                    break;
                }

                textHeight += addition;
                newTextArray.push(text);
            }
        }

        return newTextArray;
    }

    async #editImageJimp(
        imageWidth,
        imageHeight,
        textArray,
        saveImagePath,
        originalImagePath
    ) {
        if (fs.existsSync(saveImagePath)) {
            console.log('File exists', saveImagePath);
            return;
        }

        const backgroundImage = await this.#generateImage(
            this.#COLORS.WHITE,
            imageWidth,
            imageHeight
        );

        // Load the image
        const blurredImage = await jimp.read(originalImagePath);
        const image = await jimp.read(originalImagePath);
        const initialImageWidth = image._exif.imageSize.width;
        const initialImageHeight = image._exif.imageSize.height;

        // Has to be loaded for every image separatelly new instance
        const borderRadiusMask = await jimp.read(
            global.BASEDIR + '/../mask-border-radius.jpg'
        );

        // Adjust image dimensions
        image.contain(
            this.#MAX_IMAGE_WIDTH,
            this.#MAX_IMAGE_HEIGHT,
            jimp.HORIZONTAL_ALIGN_CENTER | jimp.VERTICAL_ALIGN_MIDDLE
        );

        // Create blurry image with rounded corners
        blurredImage
            .gaussian(4)
            .cover(
                this.#MAX_IMAGE_WIDTH,
                this.#MAX_IMAGE_HEIGHT,
                jimp.VERTICAL_ALIGN_MIDDLE | jimp.HORIZONTAL_ALIGN_CENTER
            )
            .mask(borderRadiusMask, 0, 0);

        // Resize radius mask to adjusted image
        if (initialImageHeight >= initialImageWidth) {
            const newWidth =
                (this.#MAX_IMAGE_HEIGHT / initialImageHeight) *
                initialImageWidth;

            borderRadiusMask.resize(newWidth, this.#MAX_IMAGE_HEIGHT);
            image.mask(
                borderRadiusMask,
                (this.#MAX_IMAGE_WIDTH - newWidth) / 2,
                0
            );
        } else {
            const newHeight =
                (this.#MAX_IMAGE_WIDTH / initialImageWidth) *
                initialImageHeight;

            borderRadiusMask.resize(this.#MAX_IMAGE_WIDTH, newHeight);
            image.mask(
                borderRadiusMask,
                0,
                (this.#MAX_IMAGE_HEIGHT - newHeight) / 2
            );
        }

        // Print text
        let lineY = this.#MAX_IMAGE_HEIGHT + this.#IMAGE_PADDING_BOTTOM;

        if (textArray) {
            textArray.forEach((text, index) => {
                if (index === 0) {
                    backgroundImage.print(
                        this.#FONT,
                        this.#TEXT_WIDTH,
                        lineY,
                        text,
                        this.#TEXT_MAX_WIDTH
                    );
                    lineY +=
                        jimp.measureTextHeight(
                            this.#FONT,
                            text,
                            this.#TEXT_MAX_WIDTH
                        ) + this.#TEXT_DIFF_PARAGRAPH_PADDING;
                }

                if (index === 1) {
                    backgroundImage.print(
                        this.#SMALLFONT,
                        this.#TEXT_WIDTH,
                        lineY,
                        text,
                        this.#TEXT_MAX_WIDTH
                    );
                    lineY +=
                        jimp.measureTextHeight(
                            this.#SMALLFONT,
                            text,
                            this.#TEXT_MAX_WIDTH
                        ) + this.#TEXT_DIFF_PARAGRAPH_PADDING;
                }

                if (index > 1) {
                    backgroundImage.print(
                        this.#FONT14PX,
                        this.#TEXT_WIDTH,
                        lineY + this.#LINE_HEIGHT_PADDING,
                        text,
                        this.#TEXT_MAX_WIDTH
                    );
                    lineY +=
                        jimp.measureTextHeight(
                            this.#FONT14PX,
                            text,
                            this.#TEXT_MAX_WIDTH
                        ) + this.#SAME_TEXT_PARAGRAPH_PADDING;
                }
            });
        } else {
            console.log('Textarray undefined', textArray, saveImagePath);
        }

        // Apply blurred image only if visible on c
        if (initialImageHeight / initialImageWidth === 0.75) {
            backgroundImage
                .blit(image, this.#BG_PADDING_LEFT, this.#BG_PADDING_TOP)
                .write(saveImagePath);

            return;
        }

        backgroundImage
            .blit(blurredImage, this.#BG_PADDING_LEFT, this.#BG_PADDING_TOP)
            .blit(image, this.#BG_PADDING_LEFT, this.#BG_PADDING_TOP)
            .write(saveImagePath);
    }

    /**
     *
     * @param {'jimp' | 'sharp'} editor
     */
    async #editImages(editor = 'jimp') {
        const file = fs.readFileSync(this.#getUsersJSONDataPath());
        const data = JSON.parse(file);

        const editedImagesFolder = this.#getUsersEditedPath();
        const editedOrigImagesFolder = this.#getUsersOriginalEditedPath();
        const originalImagesFolder = this.#getUsersImagesPath();

        this.#checkAndCreateEditedImagesFolder(editedImagesFolder);
        this.#checkAndCreateEditedOriginalImagesFolder(editedOrigImagesFolder);

        for (let i = 0; i < data.total; i++) {
            const imageData = data.data[i];

            // Get final text printed
            let textArray = [
                data.username,
                'Posted: ' +
                    new Date(imageData.timestamp).toLocaleDateString('sk-SK', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }),
                ...(imageData.caption?.split('\n') ?? [''])
            ].filter((text) => text !== '.');

            const requiredHeight =
                this.#BG_PADDING_TOP +
                this.#MAX_IMAGE_HEIGHT +
                this.#IMAGE_PADDING_BOTTOM +
                this.getTextHeight(textArray) +
                this.#BG_PADDING_BOTTOM;

            if (imageData.media_type === 'IMAGE') {
                console.log('Image ID: ', imageData.id);

                await this.decideIfAlsoCreateOriginal(
                    requiredHeight,
                    textArray,
                    editedOrigImagesFolder + imageData.id + '.jpg',
                    editedImagesFolder + imageData.id + '.jpg',
                    originalImagesFolder + imageData.id + '.jpg',
                    editor
                );
                continue;
            }

            if (imageData.media_type === 'CAROUSEL_ALBUM') {
                console.log('Album ID: ', imageData.id);

                for (let [index, albumEl] of imageData.children.entries()) {
                    if (albumEl.media_type === 'VIDEO') {
                        continue;
                    }

                    console.log('Sub-image ID: ', albumEl.id);

                    const arrayCopy = [...textArray];
                    arrayCopy[1] += ` (${index + 1})`;

                    const imageName = `${imageData.id}-${index + 1}.jpg`;

                    // first image with content
                    if (index === 0) {
                        await this.decideIfAlsoCreateOriginal(
                            requiredHeight,
                            arrayCopy,
                            editedOrigImagesFolder + imageName,
                            editedImagesFolder + imageName,
                            originalImagesFolder +
                                imageData.id +
                                '/' +
                                albumEl.id +
                                '.jpg',
                            editor
                        );

                        continue;
                    }

                    await this.decideIfAlsoCreateOriginal(
                        requiredHeight,
                        arrayCopy.slice(0, 2),
                        editedOrigImagesFolder + imageName,
                        editedImagesFolder + imageName,
                        originalImagesFolder +
                            imageData.id +
                            '/' +
                            albumEl.id +
                            '.jpg',
                        editor
                    );

                    continue;
                }
            }
        }

        await this.sleep(2000);
    }

    /**
     *
     * @param {*} requiredHeight
     * @param {*} textArray
     * @param {*} editedOriginalPath
     * @param {*} editedImagePath
     * @param {*} originalImagePath
     * @param {'jimp' | 'sharp'} editor
     */
    async decideIfAlsoCreateOriginal(
        requiredHeight,
        textArray,
        editedOriginalPath,
        editedImagePath,
        originalImagePath,
        editor = 'jimp'
    ) {
        if (editor === 'sharp') {
            // when Sharp used, this decision is automatically handled inside
            await this.#editImageSharp(
                this.#TOTAL_MAX_WIDTH,
                this.#TOTAL_MAX_HEIGHT,
                textArray,
                editedImagePath,
                editedOriginalPath,
                originalImagePath
            );

            return;
        }

        const overflowsImage = this.#TOTAL_MAX_HEIGHT - requiredHeight <= 0;

        if (overflowsImage && textArray.length > 2) {
            // Create original
            if (editor === 'jimp') {
                await this.#editImageJimp(
                    this.#TOTAL_MAX_WIDTH,
                    requiredHeight,
                    textArray,
                    editedOriginalPath,
                    originalImagePath
                );
            }
        }

        // Create cropped
        if (editor === 'jimp') {
            await this.#editImageJimp(
                this.#TOTAL_MAX_WIDTH,
                this.#TOTAL_MAX_HEIGHT,
                overflowsImage
                    ? this.#getTextArrayWhichFits(textArray)
                    : textArray,
                editedImagePath,
                originalImagePath
            );
        }
    }

    async #editImageSharp(
        imageWidth,
        imageHeight,
        textArray,
        saveImagePath,
        saveImagePathNonCropped,
        originalImagePath
    ) {
        if (fs.existsSync(saveImagePath)) {
            console.log('File exists', saveImagePath);
            return;
        }

        const textLinesMarkup = textArray
            .map((line, index) => {
                switch (index) {
                    case 0:
                        return `<span foreground="black" font="14" line_height="1.3"><b>${
                            line + '\n'
                        }</b></span>`;
                    case 1:
                        return `<span foreground="black" font="11" line_height="2.3"><i>${
                            line + '\n'
                        }</i></span>`;
                    default:
                        return `<span foreground="black" font="13" line_height="1.15">${this.checkBadCharacters(
                            line
                        )}</span>`;
                }
            })
            .join('');

        const text = await sharp({
            text: {
                text: textLinesMarkup,
                font: 'Arial',
                fontfile:
                    global.BASEDIR + '/assets/fonts/NotoColorEmoji-Regular.ttf',
                rgba: true,
                width: this.#MAX_IMAGE_WIDTH,
                dpi: 124,
                wrap: 'char'
            }
        })
            .png()
            .toBuffer();

        const textMetadata = await sharp(text).metadata();

        let textOverflowingValue = textMetadata.height - this.#MAX_TEXT_HEIGHT;

        const imagesWithSavePath = [
            {
                backgroundImage: await sharp({
                    create: {
                        width: imageWidth,
                        height: imageHeight,
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: 255 }
                    }
                })
                    .jpeg()
                    .toBuffer(),
                savePath: saveImagePath
            }
        ];

        // here we create edited image with whole content
        if (textOverflowingValue > 0) {
            imagesWithSavePath.push({
                backgroundImage: await sharp({
                    create: {
                        width: imageWidth,
                        height:
                            textOverflowingValue +
                            this.#IMAGE_PADDING_BOTTOM +
                            this.#BG_PADDING_BOTTOM +
                            imageHeight,
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: 255 }
                    }
                })
                    .jpeg()
                    .toBuffer(),
                savePath: saveImagePathNonCropped
            });
        }

        imagesWithSavePath.forEach(async (data) => {
            const curviture = 10;
            const borderOnBlurredImage = Buffer.from(
                `<svg><rect x="0" y="0" width="${
                    this.#MAX_IMAGE_WIDTH
                }" height="${
                    this.#MAX_IMAGE_HEIGHT
                }" rx="${curviture}" ry="${curviture}"/></svg>`
            );

            console.log(
                'Preparing image',
                this.#MAX_IMAGE_WIDTH,
                this.#MAX_IMAGE_HEIGHT
            );

            const image = await sharp(originalImagePath)
                .resize({
                    width: this.#MAX_IMAGE_WIDTH,
                    height: this.#MAX_IMAGE_HEIGHT,
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toBuffer();

            const blurredImage = await sharp(originalImagePath)
                .resize({
                    width: this.#MAX_IMAGE_WIDTH,
                    height: this.#MAX_IMAGE_HEIGHT,
                    fit: 'cover'
                })
                .composite([{ input: borderOnBlurredImage, blend: 'dest-in' }])
                .blur(4)
                .png()
                .toBuffer();

            // Composite image, background, and text
            await sharp(data.backgroundImage)
                .composite([
                    {
                        input: blurredImage,
                        left: this.#BG_PADDING_LEFT,
                        top: this.#BG_PADDING_TOP
                    },
                    {
                        input: image,
                        left: this.#BG_PADDING_LEFT,
                        top: this.#BG_PADDING_TOP
                    },
                    {
                        input: text,
                        top:
                            (await sharp(blurredImage).metadata()).height +
                            this.#IMAGE_PADDING_BOTTOM,
                        left: this.#BG_PADDING_LEFT
                    }
                ])
                .jpeg()
                .toFile(data.savePath);
        });
    }

    /**
     *
     * @param {string} text
     */
    checkBadCharacters(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        const reg = /[&<>"'/]/gi;
        return text.replace(reg, (match) => map[match]);
    }

    async sleep(timeMs) {
        console.log('sleeping');
        return new Promise((resolve) =>
            setTimeout(() => {
                console.log('end-sleeping');
                resolve();
            }, timeMs)
        );
    }

    async start() {
        await this.#fetchUserData();
        await this.#getImages();
        await this.#editImages('sharp');

        await this.sleep(1000);
    }
}
