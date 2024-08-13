const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// -------------------- Configuration Options --------------------

// Paths and File Names
const imagesFolder = './src/exported';
const outputFileDark = './output/flagPreviewDark.png';
const outputFileLight = './output/flagPreviewLight.png';
const fontFilePath = './src/font.ttf';

// Image Grid Settings
const flagsPerRow = 10;
const thumbnailSize = 100;
const spacing = 10;
const edgeSpacing = 20;

// Text Settings
const fontSize = 25;
const darkModeTextColor = 'white';
const lightModeTextColor = 'black';

// ---------------------------------------------------------------

/**
 * Retrieves image file paths from a specified folder and sorts them alphabetically.
 * @param {string} folder - The folder path containing images.
 * @returns {string[]} - Array of sorted image file paths.
 */
function getImages(folder) {
    return fs.readdirSync(folder)
        .filter(file => /\.(svg)$/i.test(file))
        .map(file => path.join(folder, file))
        .sort((a, b) => {
            const current = path.basename(a, path.extname(a)).toLowerCase();
            const next = path.basename(b, path.extname(b)).toLowerCase();
            return current.localeCompare(next);
        });
}

/**
 * Creates an image with text below it, using a specified font and text color.
 * @param {string} imgPath - Path to the image file.
 * @param {string} text - Text to display below the image.
 * @param {number} size - Size of the image thumbnail.
 * @param {number} fontSize - Font size for the text.
 * @param {string} fontFilePath - Path to the custom font file.
 * @param {string} textColor - Color of the text (e.g., 'black' or 'white').
 * @returns {Promise<Buffer>} - Promise that resolves to the image buffer with text.
 */
async function createImageWithText(imgPath, text, size, fontSize, fontFilePath, textColor) {
    const textHeight = fontSize + 10;
    const imgBuffer = await sharp(imgPath)
        .resize(size, size, { fit: 'contain' })
        .toFormat('png')
        .toBuffer();

    const fontData = fs.readFileSync(fontFilePath);
    const fontBase64 = fontData.toString('base64');

    const textSvg = `<svg width="${size}" height="${size + textHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        @font-face {
          font-family: 'CustomFont';
          src: url('data:font/truetype;base64,${fontBase64}');
        }
        .text {
          font-family: 'CustomFont';
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: ${textColor};
          text-anchor: middle;
        }
      </style>
    </defs>
    <rect width="100%" height="100%" fill="transparent"/>
    <image href="data:image/png;base64,${imgBuffer.toString('base64')}" x="0" y="0" width="${size}" height="${size}"/>
    <text x="50%" y="${size + fontSize - 10}" class="text">${text}</text>
  </svg>`;

    return sharp(Buffer.from(textSvg))
        .toFormat('png')
        .toBuffer();
}

/**
 * Creates a grid image composed of multiple images with text labels.
 * @param {string[]} images - Array of image file paths.
 * @param {number} flagsPerRow - Number of images per row in the grid.
 * @param {number} thumbnailSize - Size of each image thumbnail.
 * @param {number} spacing - Spacing between images.
 * @param {number} edgeSpacing - Space to leave on the edges of the grid.
 * @param {string} fontFilePath - Path to the custom font file.
 * @param {string} textColor - Color of the text (e.g., 'black' or 'white').
 * @param {string} outputFile - Path to the output file.
 * @returns {Promise<void>} - Promise that resolves when the grid image is created.
 */
async function createGrid(images, flagsPerRow, thumbnailSize, spacing, edgeSpacing, fontFilePath, textColor, outputFile) {
    if (images.length === 0) {
        throw new Error('No images found in the specified folder.');
    }

    const thumbPromises = images.map(async imgPath => {
        const fileName = path.basename(imgPath, path.extname(imgPath));
        return createImageWithText(imgPath, fileName, thumbnailSize, fontSize, fontFilePath, textColor);
    });

    const thumbs = await Promise.all(thumbPromises);

    const rows = Math.ceil(thumbs.length / flagsPerRow);
    const width = (thumbnailSize + spacing) * flagsPerRow - spacing + 2 * edgeSpacing;
    const height = (thumbnailSize + spacing + fontSize + 10) * rows - spacing + 2 * edgeSpacing;

    const imageGrid = sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    });

    const composites = thumbs.map((thumb, index) => {
        const row = Math.floor(index / flagsPerRow);
        const col = index % flagsPerRow;
        const top = row * (thumbnailSize + spacing + fontSize + 10) + edgeSpacing;
        const left = col * (thumbnailSize + spacing) + edgeSpacing;

        return {
            input: thumb,
            top: top,
            left: left
        };
    });

    await imageGrid.composite(composites).toFile(outputFile);

    console.log(`Grid image created: ${outputFile}`);
}

(async () => {
    try {
        // Ensure output directories exist
        if (!fs.existsSync(path.dirname(outputFileDark))) {
            fs.mkdirSync(path.dirname(outputFileDark), { recursive: true });
        }

        if (!fs.existsSync(path.dirname(outputFileLight))) {
            fs.mkdirSync(path.dirname(outputFileLight), { recursive: true });
        }

        const imagePaths = getImages(imagesFolder);

        // Create dark mode grid
        await createGrid(imagePaths, flagsPerRow, thumbnailSize, spacing, edgeSpacing, fontFilePath, darkModeTextColor, outputFileDark);

        // Create light mode grid
        await createGrid(imagePaths, flagsPerRow, thumbnailSize, spacing, edgeSpacing, fontFilePath, lightModeTextColor, outputFileLight);

    } catch (error) {
        console.error('Error creating grid images:', error.message);
    }
})();
