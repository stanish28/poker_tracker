/* One-off / npm script: renders SVG brand tiles to PNG for PWA manifest. */
const sharp = require('sharp');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

function tileSvg(size, spadeSize) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#075985"/>
      <stop offset="100%" style="stop-color:#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" rx="${Math.round(size * 0.2)}"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui,Segoe UI,sans-serif" font-weight="700" font-size="${spadeSize}" fill="#ffffff">♠</text>
</svg>`;
}

/** Extra inset so glyph stays inside Android/iOS maskable safe zone (~66% circle). */
function maskableSvg(size) {
  const inset = Math.round(size * 0.16);
  const inner = size - inset * 2;
  const spade = Math.round(inner * 0.45);
  const rx = Math.round(inner * 0.22);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgm" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#075985"/>
      <stop offset="100%" style="stop-color:#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#f9fafb"/>
  <rect x="${inset}" y="${inset}" width="${inner}" height="${inner}" fill="url(#bgm)" rx="${rx}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui,Segoe UI,sans-serif" font-weight="700" font-size="${spade}" fill="#ffffff">♠</text>
</svg>`;
}

async function main() {
  const targets = [
    ['logo192.png', tileSvg(192, 112)],
    ['logo512.png', tileSvg(512, 300)],
    ['logo512-maskable.png', maskableSvg(512)],
  ];
  for (const [filename, svg] of targets) {
    await sharp(Buffer.from(svg)).png().toFile(path.join(publicDir, filename));
  }
  await sharp(Buffer.from(tileSvg(32, 18))).png().toFile(path.join(publicDir, 'favicon.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
