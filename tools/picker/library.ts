// Shared helpers for the local photo picker and importer.
// Everything the picker writes lives in _raw/picker/ (gitignored) so
// originals, thumbnails and selections never reach the repo or the site.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative, extname, basename, sep } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

export const ROOT = resolve(import.meta.dir, '../..');
export const DATA_DIR = join(ROOT, '_raw/picker');
export const CACHE_DIR = join(DATA_DIR, 'cache');
const SOURCES_FILE = join(DATA_DIR, 'sources.json');
const STATE_FILE = join(DATA_DIR, 'state.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);

export interface Photo {
  id: string;
  name: string;
  path: string; // absolute; never sent to the browser
  shoot: string;
}

export interface Shoot {
  key: string; // "<source>/<folder>" — stable id for approvals
  name: string;
  source: string;
  photos: Photo[];
}

export interface PickerState {
  /** photo id → circled */
  selects: Record<string, boolean>;
  /** shoot key → "the people in it said OK to feature publicly" */
  approved: Record<string, boolean>;
}

/** Folders to scan. Edit _raw/picker/sources.json to add more (e.g. photos copied from another computer). */
export async function loadSources(): Promise<string[]> {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(SOURCES_FILE)) {
    const defaults = [join(homedir(), 'Pictures/Lightroom Exports')];
    await writeFile(SOURCES_FILE, JSON.stringify(defaults, null, 2) + '\n');
  }
  const list: string[] = JSON.parse(await readFile(SOURCES_FILE, 'utf8'));
  return list.map((p) => resolve(p.replace(/^~(?=$|\/)/, homedir()))).filter((p) => existsSync(p));
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (IMAGE_EXT.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

export const photoId = (absPath: string) => createHash('sha1').update(absPath).digest('hex').slice(0, 14);

/** Every image under every source, grouped by its top-level folder ("shoot"). */
export async function scanLibrary(): Promise<{ sources: string[]; shoots: Shoot[]; byId: Map<string, Photo> }> {
  const sources = await loadSources();
  const shoots = new Map<string, Shoot>();
  const byId = new Map<string, Photo>();

  for (const source of sources) {
    const files = (await walk(source)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const file of files) {
      const rel = relative(source, file).split(sep);
      const shootName = rel.length > 1 ? rel[0] : basename(source);
      const key = `${basename(source)}/${shootName}`;
      if (!shoots.has(key)) shoots.set(key, { key, name: shootName, source: basename(source), photos: [] });
      const photo: Photo = { id: photoId(file), name: rel.slice(1).join(' / ') || rel[0], path: file, shoot: key };
      shoots.get(key)!.photos.push(photo);
      byId.set(photo.id, photo);
    }
  }
  return { sources, shoots: [...shoots.values()], byId };
}

export async function loadState(): Promise<PickerState> {
  try {
    const s = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    return { selects: s.selects ?? {}, approved: s.approved ?? {} };
  } catch {
    return { selects: {}, approved: {} };
  }
}

export async function saveState(state: PickerState) {
  await mkdir(DATA_DIR, { recursive: true });
  // Drop false entries so the file stays readable
  const clean = (o: Record<string, boolean>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
  await writeFile(STATE_FILE, JSON.stringify({ selects: clean(state.selects), approved: clean(state.approved) }, null, 2) + '\n');
}
