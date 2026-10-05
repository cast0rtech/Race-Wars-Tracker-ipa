const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const outDir = path.resolve(__dirname, '..', 'www');

// Clean www/ before rebuilding to prevent stale files
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log('Cleaned www/ (stale files removed)');
}
fs.mkdirSync(outDir, { recursive: true });

// Root-level web assets
const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'summary.html',
  'summary.css',
  'summary.js',
  'card-offscreen.html',
  'card-offscreen.css',
  'card-offscreen.js',
  'capacitor.config.json'
];

let copied = 0;
let missing = [];

filesToCopy.forEach(f => {
  const src = path.join(srcDir, f);
  const dest = path.join(outDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${f}`);
    copied++;
  } else {
    missing.push(f);
    console.warn(`  ✗ MISSING: ${f}`);
  }
});

// Copy core/ directory recursively
const coreSrc = path.join(srcDir, 'core');
const coreDest = path.join(outDir, 'core');

if (fs.existsSync(coreSrc)) {
  fs.mkdirSync(coreDest, { recursive: true });
  const coreFiles = fs.readdirSync(coreSrc);
  coreFiles.forEach(f => {
    const src = path.join(coreSrc, f);
    const dest = path.join(coreDest, f);
    // Only copy files (skip subdirectories if any)
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ core/${f}`);
      copied++;
    }
  });
} else {
  console.warn('  ✗ MISSING: core/ directory');
}

console.log(`\nWeb assets prepared: ${copied} files → www/`);
if (missing.length > 0) {
  console.error(`WARNING: ${missing.length} file(s) not found: ${missing.join(', ')}`);
  process.exit(1);
}
