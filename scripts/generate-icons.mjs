import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

mkdirSync(publicDir, { recursive: true });

function buildSvg(size) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.54);
  const textY = Math.round(size * 0.72);
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#4f46e5"/>
      <text
        x="${size / 2}" y="${textY}"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="white"
      >M</text>
    </svg>
  `);
}

const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of icons) {
  const outPath = join(publicDir, name);
  await sharp(buildSvg(size)).png().toFile(outPath);
  console.log(`✓ ${name} (${size}x${size})`);
}
