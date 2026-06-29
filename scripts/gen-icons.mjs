import sharp from "sharp"

async function makeIcon(size, outPath) {
  const r = Math.round(size * 0.2)
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#10b981"/>
    <text x="${size / 2}" y="${size / 2}" font-family="Arial,sans-serif" font-size="${Math.round(size * 0.55)}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">K</text>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(outPath)
}

await makeIcon(192, "public/icon-192.png")
await makeIcon(512, "public/icon-512.png")
console.log("Icons created: icon-192.png, icon-512.png")
