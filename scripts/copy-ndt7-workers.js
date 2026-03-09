import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const ndt7Src = join(root, 'node_modules', '@m-lab', 'ndt7', 'src');

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

const workers = ['ndt7-download-worker.js', 'ndt7-upload-worker.js'];

for (const worker of workers) {
  const src = join(ndt7Src, worker);
  const dest = join(publicDir, worker);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`Copied ${worker} to public/`);
  } else {
    console.warn(`Warning: ${src} not found — NDT7 may not work correctly`);
  }
}
