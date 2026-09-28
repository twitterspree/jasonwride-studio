// Import circled photos into the site: `bun run photos:import`
// - Only photos from shoots marked "OK to feature" are imported.
// - Copies are resized for the web and stripped of ALL metadata (incl. GPS).
// - Camera settings + date are read from the original and saved to photos.json.
// Non-destructive: it never deletes photos that are already in the site.

import sharp from 'sharp';
import exifr from 'exifr';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { ROOT, scanLibrary, loadState } from './library';

const OUT_DIR = join(ROOT, 'src/assets/photos');
const META_FILE = join(ROOT, 'src/data/photos.json');
const MAX_EDGE = 2400; // Astro makes smaller versions from this at build time

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function shutter(t?: number) {
  if (!t) return undefined;
  return t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`;
}

function localDate(d?: Date) {
  if (!(d instanceof Date) || isNaN(+d)) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const { shoots, byId } = await scanLibrary();
const state = await loadState();
const meta: Record<string, Record<string, unknown>> = JSON.parse(await readFile(META_FILE, 'utf8'));

const circled = Object.keys(state.selects).filter((id) => state.selects[id] && byId.has(id));
const blocked = circled.filter((id) => !state.approved[byId.get(id)!.shoot]);
const ready = circled.filter((id) => state.approved[byId.get(id)!.shoot]);

let added = 0;
let skipped = 0;
for (const id of ready) {
  const photo = byId.get(id)!;
  const shoot = shoots.find((s) => s.key === photo.shoot)!;
  const key = `${slug(shoot.name)}-${slug(basename(photo.path, extname(photo.path)))}`;
  const out = join(OUT_DIR, `${key}.jpg`);

  if (existsSync(out)) {
    skipped++;
    continue;
  }

  // .rotate() bakes in EXIF orientation; sharp drops all metadata unless told to keep it
  await sharp(photo.path)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(out);

  const exif = await exifr
    .parse(photo.path, ['FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal'])
    .catch(() => ({}));

  meta[key] = {
    ...(meta[key] ?? {}),
    alt: (meta[key]?.alt as string) ?? '',
    shoot: shoot.name,
    date: localDate(exif?.DateTimeOriginal),
    aperture: exif?.FNumber,
    shutter: shutter(exif?.ExposureTime),
    iso: exif?.ISO,
    focal: exif?.FocalLength ? Math.round(exif.FocalLength) : undefined,
  };
  added++;
  console.log(`+ ${key}`);
}

await writeFile(META_FILE, JSON.stringify(meta, null, 2) + '\n');

console.log(`\nImported ${added} new photo(s)` + (skipped ? `, ${skipped} already in the site` : '') + '.');
if (blocked.length) {
  const names = [...new Set(blocked.map((id) => shoots.find((s) => s.key === byId.get(id)!.shoot)!.name))];
  console.log(`Skipped ${blocked.length} circled photo(s) from shoots not marked "OK to feature": ${names.join(', ')}`);
}
const missingAlt = Object.entries(meta).filter(([, m]) => !m.alt).map(([k]) => k);
if (missingAlt.length) console.log(`\n${missingAlt.length} photo(s) still need alt text in src/data/photos.json.`);
