import dotenv from "dotenv";
import fs from "fs";
import { Readable } from "stream";
import jimp from "jimp";

dotenv.config();

const URL = "https://graph.instagram.com";
const QUERY_MEDIA = `?fields=id,caption,media_url,media_type,timestamp&access_token=${process.env.IG_TOKEN}`;
const QUERY_USER = `?fields=id,username&access_token=${process.env.IG_TOKEN}`;
const MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};
const FONT_SANS_SERIF_16_PX = "/home/kristian/projects/intagram-photos/assets/fonts/sans-serif.fnt";
const FONT_SANS_SERIF_14_PX = "/home/kristian/projects/intagram-photos/assets/fonts/sans-serif-14.fnt";

async function getUsername() {
  return (await (await fetch(URL + "/me" + QUERY_USER)).json()).username;
}

async function downloadAllMedia(next = null) {
  const response = await fetch(next ?? URL + "/me/media" + QUERY_MEDIA);
  return await response.json();
}

async function downloadChildren(mediaId) {
  const response = await fetch(
    URL + "/" + mediaId + "/children?" + QUERY_MEDIA
  );
  return await response.json();
}

await async function main() {
  const username = await getUsername();
  const mediaFileName = process.env.MEDIA_FOLDER + "/" + username + ".json";

  console.log("user:", username);

  if(!fs.existsSync(process.env.MEDIA_FOLDER)){
    fs.mkdir(process.env.MEDIA_FOLDER);
  }

  // Remove old user's media file
  if (fs.existsSync(mediaFileName)) {
    fs.rmSync(mediaFileName);
  }

  const file = await fs.promises.open(mediaFileName, "a+");

  await file.write("{\n");

  await file.write(`  "username":"${username}",
        "data": [ `);

  let body = null;
  let nextLink = null;
  let content = null;
  let total = 0;

  do {
    body = await downloadAllMedia(nextLink);
    nextLink = body?.paging?.next;
    content = body.data;

    total += body.data.length;

    // get albums media
    content.forEach(async (el) => {
      if (el.media_type === "CAROUSEL_ALBUM") {
        el.children = [];
        const content = await downloadChildren(el.id);
        const data = content.data;

        console.log(data);

        el.children.push(...data);
      }
    });

    content = JSON.stringify(body.data);
    content = content.substring(1, content.length - 1) + (nextLink ? "," : "");

    await file.write(content);

    body = null;

    console.log("Next batch: ", nextLink);
  } while (nextLink);

  await file.write(`], "total": ${total}}\n`);
}

await async function getImages() {
  const file = fs.readFileSync("./media_cico.__.json");
  const data = JSON.parse(file);
  const originalImagesFolder = "_images/" + data.username + "/";

  // Create dir
  if (!fs.existsSync(originalImagesFolder)) {
    fs.mkdirSync(originalImagesFolder, { recursive: true });
  }

  // Download images
  data.data.forEach((el) => {
    if (el.media_type !== "IMAGE") {
      return;
    }

    fetch(el.media_url).then((response) =>
      Readable.fromWeb(response.body).pipe(
        fs.createWriteStream(
          originalImagesFolder +
          el.id +
          MIME_TYPES[response.headers.get("content-type")]
        )
      )
    );
  });
};

await (async function editImage() {
  const file = fs.readFileSync("./media_cico.__.json");
  const data = JSON.parse(file);
  const editedImagesFolder = "_edited/" + data.username + "/";
  const originalImagesFolder = "_images/" + data.username + "/";
  const WHITE_COLOR = 0xFFFFFFFF;

  if (!fs.existsSync(editedImagesFolder)) {
    fs.mkdirSync(editedImagesFolder, { recursive: true });
  }

  const images = fs.readdirSync(originalImagesFolder);

  console.log("everything loaded");

  const font = await jimp.loadFont(FONT_SANS_SERIF_16_PX);
  const font14px = await jimp.loadFont(FONT_SANS_SERIF_14_PX);
  const smallFont = await jimp.loadFont(jimp.FONT_SANS_10_BLACK);

  for (let i = 0; i < 10; i++) {
    const imageData = data.data[i];

    if (imageData.media_type !== "IMAGE") {
      continue;
    }

    let textArray = [
      data.username,
      "Posted: " + (new Date(imageData.timestamp)).toLocaleDateString('sk-SK', { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      ...imageData.caption?.split('\n') ?? ['']
    ];

    textArray = textArray.filter(text => text !== '.');

    console.log("Image index: ", imageData.id);

    // Dimensions of image, that is used for final printing
    const TOTAL_MAX_WIDTH = 375;
    const TOTAL_MAX_HEIGHT = 500;

    const BG_PADDING_TOP = 10;
    const BG_PADDING_BOTTOM = 10;
    const BG_PADDING_LEFT = 10;
    const BG_PADDING_RIGHT = 10;

    const MAX_IMAGE_HEIGHT = 276 - BG_PADDING_TOP;
    const MAX_IMAGE_WIDTH = TOTAL_MAX_WIDTH - BG_PADDING_LEFT - BG_PADDING_RIGHT;

    const IMAGE_PADDING_BOTTOM = 30;

    const TEXT_DIFF_PARAGRAPH_PADDING = 10;
    const TEXT_WIDTH = 15;
    const TEXT_MAX_WIDTH = MAX_IMAGE_WIDTH - TEXT_WIDTH;

    const sameTextParagraphPadding = 6;
    const lineHeightPadding = 2;
    let textHeight = 0;

    textArray.forEach((text, index) => {
      if (index === 0) {
        textHeight += jimp.measureTextHeight(font, text, TEXT_MAX_WIDTH) + TEXT_DIFF_PARAGRAPH_PADDING;
      }

      if (index === 1) {
        textHeight += jimp.measureTextHeight(smallFont, text, TEXT_MAX_WIDTH) + TEXT_DIFF_PARAGRAPH_PADDING;
      }

      if (index > 1) {
        textHeight += jimp.measureTextHeight(font14px, text, TEXT_MAX_WIDTH) + sameTextParagraphPadding;
      }
    });

    const REQUIRED_HEIGHT = BG_PADDING_TOP + MAX_IMAGE_HEIGHT + IMAGE_PADDING_BOTTOM + textHeight + BG_PADDING_BOTTOM;

    const backgroundImage = TOTAL_MAX_HEIGHT - REQUIRED_HEIGHT <= 0 ? await generateImage(
      WHITE_COLOR,
      MAX_IMAGE_WIDTH + BG_PADDING_LEFT + BG_PADDING_RIGHT,
      REQUIRED_HEIGHT,
    ) : await generateImage(WHITE_COLOR, 375, 500);

    const image = await jimp.read(originalImagesFolder + imageData.id + ".jpg");
    const initialImageWidth = image._exif.imageSize.width;
    const initialImageHeight = image._exif.imageSize.height;

    const blurredImage = await jimp.read(
      originalImagesFolder + imageData.id + ".jpg"
    );
    const borderRadiusMask = await jimp.read("./mask-border-radius.jpg");

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
      const newWidth = (MAX_IMAGE_HEIGHT / initialImageHeight) * initialImageWidth;

      borderRadiusMask.resize(newWidth, MAX_IMAGE_HEIGHT);
      image.mask(borderRadiusMask, (MAX_IMAGE_WIDTH - newWidth) / 2, 0);
    } else {
      const newHeight = (MAX_IMAGE_WIDTH / initialImageWidth) * initialImageHeight;

      borderRadiusMask.resize(MAX_IMAGE_WIDTH, newHeight);
      image.mask(borderRadiusMask, 0, (MAX_IMAGE_HEIGHT - newHeight) / 2);
    }

    let lineY = MAX_IMAGE_HEIGHT + IMAGE_PADDING_BOTTOM;

    textArray.forEach((text, index) => {
      if (index === 0) {
        backgroundImage.print(font, TEXT_WIDTH, lineY, text, TEXT_MAX_WIDTH);
        lineY += jimp.measureTextHeight(font, text, TEXT_MAX_WIDTH) + TEXT_DIFF_PARAGRAPH_PADDING;
      }

      if (index === 1) {
        backgroundImage.print(smallFont, TEXT_WIDTH, lineY, text, TEXT_MAX_WIDTH);
        lineY += jimp.measureTextHeight(smallFont, text, TEXT_MAX_WIDTH) + TEXT_DIFF_PARAGRAPH_PADDING;
      }

      if (index > 1) {
        backgroundImage.print(font14px, TEXT_WIDTH, lineY + lineHeightPadding, text, TEXT_MAX_WIDTH);
        lineY += jimp.measureTextHeight(font14px, text, TEXT_MAX_WIDTH) + sameTextParagraphPadding;
      }
    });


    if (initialImageHeight / initialImageWidth === 0.75) {
      console.log("without blurred background");
      backgroundImage.blit(image, 10, 10).write(editedImagesFolder + images[i]);

      continue;
    }

    backgroundImage
      .blit(blurredImage, 10, 10)
      .blit(image, 10, 10)
      .write(editedImagesFolder + images[i]);
  }
})();

async function generateImage(hexNumber, width, height) {
  return new jimp(width, height, (err, image) => {
    for (let row = 0; row < width; row++) {
      for (let column = 0; column < height; column++) {
        image.setPixelColor(hexNumber, row, column)
      }
    }
  })
}