// Local-only photo picker: `bun run picker`, then open http://localhost:4400
// Serves a contact sheet of every photo in your source folders. Circle selects,
// mark which shoots you have permission to feature, then run `bun run photos:import`.

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, scanLibrary, loadState, saveState, type Photo } from './library';

const PORT = Number(process.env.PICKER_PORT ?? 4400);
const SIZES = { thumb: 480, full: 1800 } as const;

let library = await scanLibrary();
await mkdir(CACHE_DIR, { recursive: true });

// Resize on first request, then serve from disk cache
const inflight = new Map<string, Promise<string>>();
function cached(photo: Photo, size: keyof typeof SIZES): Promise<string> {
  const file = join(CACHE_DIR, `${photo.id}-${size}.webp`);
  if (existsSync(file)) return Promise.resolve(file);
  const key = file;
  if (!inflight.has(key)) {
    inflight.set(
      key,
      sharp(photo.path)
        .rotate() // respect EXIF orientation
        .resize(SIZES[size], SIZES[size], { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: size === 'thumb' ? 70 : 85 })
        .toFile(file)
        .then(() => file)
        .finally(() => inflight.delete(key))
    );
  }
  return inflight.get(key)!;
}

const server = Bun.serve({
  hostname: '127.0.0.1', // never reachable from other machines
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/') return new Response(Bun.file(join(import.meta.dir, 'index.html')));

    if (url.pathname === '/api/library') {
      if (url.searchParams.has('rescan')) library = await scanLibrary();
      const state = await loadState();
      return Response.json({
        sources: library.sources,
        shoots: library.shoots.map((s) => ({
          key: s.key,
          name: s.name,
          source: s.source,
          // Only ids + file names go to the browser, never filesystem paths
          photos: s.photos.map((p) => ({ id: p.id, name: p.name })),
        })),
        state,
      });
    }

    if (url.pathname === '/api/state' && req.method === 'POST') {
      await saveState(await req.json());
      return Response.json({ ok: true });
    }

    const img = url.pathname.match(/^\/(thumb|full)\/([0-9a-f]+)$/);
    if (img) {
      const photo = library.byId.get(img[2]);
      if (!photo) return new Response('Not found', { status: 404 });
      try {
        const file = await cached(photo, img[1] as keyof typeof SIZES);
        return new Response(Bun.file(file), { headers: { 'Cache-Control': 'max-age=31536000, immutable' } });
      } catch (err) {
        return new Response(`Could not read image: ${(err as Error).message}`, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
});

const total = library.shoots.reduce((n, s) => n + s.photos.length, 0);
console.log(`Photo picker: ${total} photos in ${library.shoots.length} shoots`);
for (const s of library.sources) console.log(`  source: ${s}`);
console.log(`→ http://localhost:${server.port}`);
