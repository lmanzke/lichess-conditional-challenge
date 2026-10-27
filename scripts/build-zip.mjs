import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const root = fileURLToPath(new URL('..', import.meta.url));
const { name, version } = JSON.parse(await readFile(root + 'package.json', 'utf8'));
const zipFilename = `${name}-v${version}.zip`;

await mkdir(root + 'dist-zip', { recursive: true });
console.info(`Building ${zipFilename}...`);

const archive = new ZipArchive({ zlib: { level: 9 } });
const stream = createWriteStream(root + 'dist-zip/' + zipFilename);
const closed = new Promise((resolve, reject) => {
  stream.on('close', resolve);
  archive.on('error', reject);
});

archive.pipe(stream);
archive.directory(root + 'dist', false);
await archive.finalize();
await closed;
console.info('OK');
