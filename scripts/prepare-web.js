const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const outDir = path.resolve(__dirname, '..', 'www');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy files
const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'summary.html',
  'summary.css',
  'summary.js',
  'card-offscreen.html',
  'card-offscreen.css',
  'card-offscreen.js'
];

filesToCopy.forEach(f => {
  const src = path.join(srcDir, f);
  const dest = path.join(outDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${f} to www/`);
  }
});

// Copy core directory
const coreSrc = path.join(srcDir, 'core');
const coreDest = path.join(outDir, 'core');
if (!fs.existsSync(coreDest)) {
  fs.mkdirSync(coreDest, { recursive: true });
}
if (fs.existsSync(coreSrc)) {
  fs.readdirSync(coreSrc).forEach(f => {
    fs.copyFileSync(path.join(coreSrc, f), path.join(coreDest, f));
    console.log(`Copied core/${f} to www/core/`);
  });
}

console.log('Web assets prepared successfully in www/');
