const zlib = require('node:zlib');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;
    rgba.copy(raw, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function createCanvas(width, height, color = [255, 255, 255, 255]) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  }
  return pixels;
}

function setPixel(pixels, width, height, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const offset = (py * width + px) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function fillRect(pixels, width, height, x, y, rectWidth, rectHeight, color) {
  const startX = clamp(Math.floor(x), 0, width);
  const endX = clamp(Math.ceil(x + rectWidth), 0, width);
  const startY = clamp(Math.floor(y), 0, height);
  const endY = clamp(Math.ceil(y + rectHeight), 0, height);

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      setPixel(pixels, width, height, px, py, color);
    }
  }
}

function drawCircle(pixels, width, height, centerX, centerY, radius, color) {
  const startX = Math.floor(centerX - radius);
  const endX = Math.ceil(centerX + radius);
  const startY = Math.floor(centerY - radius);
  const endY = Math.ceil(centerY + radius);
  const r2 = radius * radius;

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= r2) {
        setPixel(pixels, width, height, x, y, color);
      }
    }
  }
}

function drawLine(pixels, width, height, x1, y1, x2, y2, color) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const steps = Math.max(dx, dy);
  if (steps === 0) {
    setPixel(pixels, width, height, x1, y1, color);
    return;
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    setPixel(pixels, width, height, x, y, color);
  }
}

function drawGrid(pixels, width, height, step, color) {
  for (let x = 0; x < width; x += step) {
    drawLine(pixels, width, height, x, 0, x, height - 1, color);
  }
  for (let y = 0; y < height; y += step) {
    drawLine(pixels, width, height, 0, y, width - 1, y, color);
  }
}

function projectPoint(x, y, worldWidth, worldHeight, imageWidth, imageHeight, padding) {
  const innerWidth = imageWidth - padding * 2;
  const innerHeight = imageHeight - padding * 2;
  return {
    x: padding + clamp(x / worldWidth, 0, 1) * innerWidth,
    y: padding + clamp(y / worldHeight, 0, 1) * innerHeight
  };
}

function countryColor(index) {
  const palette = [
    [33, 150, 243, 255],
    [76, 175, 80, 255],
    [255, 152, 0, 255],
    [156, 39, 176, 255],
    [244, 67, 54, 255],
    [0, 188, 212, 255]
  ];
  return palette[index % palette.length];
}

function renderWorldMap(worldData, options = {}) {
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const padding = options.padding ?? 48;
  const pixels = createCanvas(width, height, [8, 18, 34, 255]);

  fillRect(pixels, width, height, padding, padding, width - padding * 2, height - padding * 2, [14, 34, 57, 255]);
  drawGrid(pixels, width, height, 96, [24, 52, 84, 255]);

  const countries = worldData.countries ?? [];
  const worldWidth = Math.max(worldData.width ?? 1, 1);
  const worldHeight = Math.max(worldData.height ?? 1, 1);

  countries.forEach((country, index) => {
    const color = countryColor(index);
    const capital = projectPoint(country.capital_x ?? 0, country.capital_y ?? 0, worldWidth, worldHeight, width, height, padding);

    drawCircle(pixels, width, height, capital.x, capital.y, 22, [color[0], color[1], color[2], 70]);
    drawCircle(pixels, width, height, capital.x, capital.y, 7, color);

    for (const city of country.cities ?? []) {
      const point = projectPoint(city.pos_x, city.pos_y, worldWidth, worldHeight, width, height, padding);
      drawLine(pixels, width, height, capital.x, capital.y, point.x, point.y, [color[0], color[1], color[2], 110]);
      drawCircle(pixels, width, height, point.x, point.y, Math.max(3, 2 + (city.tier ?? 1)), [255, 255, 255, 255]);
      drawCircle(pixels, width, height, point.x, point.y, Math.max(2, 1 + (city.tier ?? 1)), color);
    }
  });

  return encodePng(width, height, pixels);
}

module.exports = { renderWorldMap };
