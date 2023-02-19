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
  const mediaFileName = process.env.MEDIA_FILE + "_" + username + ".json";
  console.log("user:", username);

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

  if (!fs.existsSync(editedImagesFolder)) {
    fs.mkdirSync(editedImagesFolder, { recursive: true });
  }

  const images = fs.readdirSync(originalImagesFolder);

  console.log("everything loaded");

  const font = await jimp.loadFont(jimp.FONT_SANS_12_BLACK);
  const smallFont = await jimp.loadFont(jimp.FONT_SANS_10_BLACK);

  for (let i = 0; i < data.data.length - 1; i++) {
    const imageData = data.data[i];

    if (imageData.media_type !== "IMAGE") {
      continue;
    }

    console.log("Image index: ", imageData.id);

    const backgroundImage = await jimp.read("./background.jpg");

    const image = await jimp.read(originalImagesFolder + imageData.id + ".jpg");
    const initialImageWidth = image._exif.imageSize.width;
    const initialImageHeight = image._exif.imageSize.height;

    const blurredImage = await jimp.read(
      originalImagesFolder + imageData.id + ".jpg"
    );
    const borderRadiusMask = await jimp.read("./mask-border-radius.jpg");

    const MAX_HEIGHT = 266;
    const MAX_WIDTH = 355;

    image.contain(
      MAX_WIDTH,
      MAX_HEIGHT,
      jimp.HORIZONTAL_ALIGN_CENTER | jimp.VERTICAL_ALIGN_MIDDLE
    );

    blurredImage
      .gaussian(4)
      .cover(
        MAX_WIDTH,
        MAX_HEIGHT,
        jimp.VERTICAL_ALIGN_MIDDLE | jimp.HORIZONTAL_ALIGN_CENTER
      )
      .mask(borderRadiusMask, 0, 0);

    if (initialImageHeight >= initialImageWidth) {
      const newWidth = (MAX_HEIGHT / initialImageHeight) * initialImageWidth;

      borderRadiusMask.resize(newWidth, MAX_HEIGHT);
      image.mask(borderRadiusMask, (MAX_WIDTH - newWidth) / 2, 0);
    } else {
      const newHeight = (MAX_WIDTH / initialImageWidth) * initialImageHeight;

      borderRadiusMask.resize(MAX_WIDTH, newHeight);
      image.mask(borderRadiusMask, 0, (MAX_HEIGHT - newHeight) / 2);
    }

    let lineY = 290;
    const maxTextWidth = MAX_WIDTH - 15;
    let textArray = [data.username, imageData.timestamp, ...imageData.caption?.split('\n') ?? ['']];
    
    textArray = textArray.filter(text => text !== '.');

    textArray.forEach((text, index) => {
        if(index === 0){
            backgroundImage.print(font, 15, lineY, text, maxTextWidth);
            lineY += jimp.measureTextHeight(font, text, maxTextWidth) + 6;
        }

        if(index === 1){
            backgroundImage.print(smallFont, 15, lineY, text, maxTextWidth);
            lineY += jimp.measureTextHeight(smallFont, text, maxTextWidth) + 6;
        }

        if(index > 1){
            backgroundImage.print(font, 15, lineY, text, maxTextWidth);
            lineY += jimp.measureTextHeight(font, text, maxTextWidth);
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
