import fs from 'fs';
import jimp from 'jimp';
import sharp from 'sharp';

class Test {
    #TOTAL_MAX_WIDTH = 375;
    #TOTAL_MAX_HEIGHT = 500;

    #BG_PADDING_TOP = 10;
    #BG_PADDING_BOTTOM = 10;
    #BG_PADDING_LEFT = 10;
    #BG_PADDING_RIGHT = 10;

    #MAX_TEXT_HEIGHT = 276;

    #MAX_IMAGE_HEIGHT = this.#MAX_TEXT_HEIGHT - this.#BG_PADDING_TOP;
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

    /**
     *
     * @param {string[]} textArray
     * @param {*} saveImagePath
     * @param {*} originalImagePath
     */
    async editImageSharp(textArray, saveImagePath, originalImagePath) {
        const imageWidth = this.#TOTAL_MAX_WIDTH,
            imageHeight = this.#TOTAL_MAX_HEIGHT;

        if (fs.existsSync(saveImagePath)) {
            console.log('Removing existing', saveImagePath);
            fs.unlinkSync(saveImagePath);
        }

        const backgroundImage = await sharp({
            create: {
                width: imageWidth,
                height: imageHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 255 }
            }
        })
            .jpeg()
            .toBuffer();

        const curviture = 10;
        const borderOnBlurredImage = Buffer.from(
            `<svg><rect x="0" y="0" width="${this.#MAX_IMAGE_WIDTH}" height="${
                this.#MAX_IMAGE_HEIGHT
            }" rx="${curviture}" ry="${curviture}"/></svg>`
        );

        console.log('Preparing image');

        const image = await sharp(originalImagePath)
            .resize({
                width: this.#MAX_IMAGE_WIDTH,
                height: this.#MAX_IMAGE_HEIGHT,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toBuffer();

        console.log('image fine');

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

        console.log(image, blurredImage);

        const textLinesMarkup = textArray
            .map((line, index) => {
                switch (index) {
                    case 0:
                        return `<span foreground="black" font="14" line_height="1.3"><b>${line + '\n'}</b></span>`;
                    case 1:
                        return `<span foreground="black" font="11" line_height="2.3"><i>${line + '\n'}</i></span>`;
                    default:
                        return `<span foreground="black" font="14">${line}</span>`;
                }
            })
            .join('');

        const text = await sharp({
            text: {
                text: textLinesMarkup,
                fontfile: './NotoColorEmoji-Regular.ttf',
                rgba: true,
                width: this.#MAX_IMAGE_WIDTH
            }
        }).png().toBuffer();

        // Composite image, background, and text
        await sharp(backgroundImage)
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
            .toFile(saveImagePath);
    }
}

(async function () {
    console.log('Starting test');

    const x = new Test();

    await x.editImageSharp(
        [
            'cico.__',
            'today',
            'Nepozeraj sa na všetko tak čiernobielo trošku pohybu treba 😏😊 . . . .\n#deepmind #blackAndWhiteIsNotAlwaysRight #WouldntItBeEasierPutTitanfallToF2P #respawnentertainment 🙂'
        ],
        './testResult.jpg',
        './users-data/cico__/images/17867217443104388.jpg'
    );

    console.log('Ending test');
})();
