const fs = require('fs');
const p = require('path');
const root = 'g:/Code/StoryForge/web';
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(p.join(d, e.name))
      : e.name.endsWith('.test.ts')
      ? [p.relative(root, p.join(d, e.name)).split(p.sep).join('/')]
      : []
  );
const disk = walk(p.join(root, 'src'));
const listed = require(p.join(root, 'package.json')).scripts.test.match(/src\/[^ ]+\.test\.ts/g) || [];
console.log('disk=' + disk.length + ' listed=' + listed.length);
console.log('UNRUN:');
disk.filter((f) => !listed.includes(f)).forEach((f) => console.log('  ' + f));
console.log('STALE:');
listed.filter((f) => !disk.includes(f)).forEach((f) => console.log('  ' + f));