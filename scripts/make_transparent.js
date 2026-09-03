const { Jimp } = require('jimp');
const fs = require('fs');

async function processLogo() {
  try {
    const srcPath = 'assets/img/edupeak_logo.png';
    const image = await Jimp.read(srcPath);

    const width = image.bitmap.width;
    const height = image.bitmap.height;

    let minX = width, minY = height, maxX = 0, maxY = 0;

    // Scan pixels
    image.scan(0, 0, width, height, (x, y, idx) => {
      const r = image.bitmap.data[idx + 0];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];

      // Calculate how close this pixel is to pure white
      // Distance from #ffffff (255, 255, 255)
      const distFromWhite = Math.sqrt(
        Math.pow(255 - r, 2) + 
        Math.pow(255 - g, 2) + 
        Math.pow(255 - b, 2)
      );

      // Thresholds:
      // distFromWhite = 0 -> pure white
      // distFromWhite < 25 -> fully transparent
      // 25 <= distFromWhite < 65 -> smooth alpha feathering
      if (distFromWhite < 25) {
        image.bitmap.data[idx + 3] = 0; // completely transparent
      } else if (distFromWhite < 65) {
        // Smooth alpha falloff for antialiased edges
        const factor = (distFromWhite - 25) / 40;
        image.bitmap.data[idx + 3] = Math.round(factor * 255);
      } else {
        // Pixel is logo content
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    });

    // Add small padding around the bounding box
    const pad = 15;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(width - cropX, (maxX - minX) + pad * 2);
    const cropH = Math.min(height - cropY, (maxY - minY) + pad * 2);

    if (cropW > 0 && cropH > 0) {
      image.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
    }

    await image.write('assets/img/edupeak_logo.png');
    await image.write('assets/img/edupeak_logo_transparent.png');
    await image.write('assets/img/logo.png');

    console.log(`✓ Transparent logo created successfully! Dimensions: ${image.bitmap.width}x${image.bitmap.height}`);
  } catch (err) {
    console.error('Error processing transparent logo:', err);
  }
}

processLogo();
