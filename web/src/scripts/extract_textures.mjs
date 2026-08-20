import fs from 'fs';

const buf = fs.readFileSync('public/models/d20.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const binOffset = 20 + jsonLen + 8;

console.log('Images in GLB:', json.images);
json.images.forEach((img, i) => {
  const bv = json.bufferViews[img.bufferView];
  const imgData = buf.slice(binOffset + bv.byteOffset, binOffset + bv.byteOffset + bv.byteLength);
  const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  fs.writeFileSync(`public/models/texture_${i}_${img.name || 'img'}.${ext}`, imgData);
  console.log(`Saved texture_${i} (${img.mimeType}, ${imgData.length} bytes)`);
});
