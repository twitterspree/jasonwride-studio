import { getImage } from 'astro:assets';
import meta from '../data/photos.json';

// Every gallery shot so far: Canon EOS M50 + Viltrox AF 56mm f/1.4 (from the RAW EXIF)
export const CAMERA = 'Canon EOS M50';
export const LENS = 'Viltrox 56mm f/1.4';

export interface Photo {
  id: string;
  alt: string;
  date?: string;
  exif?: string; // e.g. "56mm · f/1.4 · 1/1000 · ISO 6400"
  thumb: string;
  srcset: string;
  width: number;
  height: number;
  full: string;
  portrait: boolean;
}

type Meta = { alt: string; date?: string; aperture?: number; shutter?: string; iso?: number; focal?: number };

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.{avif,jpg,jpeg,png,webp}', {
  eager: true,
});

/**
 * Optimised versions of every photo in src/assets/photos.
 * Add a photo: drop it in that folder and describe it in src/data/photos.json.
 */
export async function loadPhotos(thumbHeight = 300): Promise<Photo[]> {
  return Promise.all(
    Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([path, mod]) => {
        const id = path.split('/').pop()!.replace(/\.\w+$/, '');
        const src = mod.default;
        const m = (meta as Record<string, Meta>)[id];
        const [thumb, thumb2x, full] = await Promise.all([
          getImage({ src, height: thumbHeight, format: 'webp' }),
          getImage({ src, height: thumbHeight * 2, format: 'webp' }),
          getImage({ src, width: src.width > src.height ? 1800 : 1200, format: 'webp', quality: 85 }),
        ]);
        return {
          id,
          alt: m?.alt ?? 'Photograph by Jason Wride',
          date: m?.date,
          exif: m ? `${m.focal}mm · f/${m.aperture} · ${m.shutter} · ISO ${m.iso}` : undefined,
          thumb: thumb.src,
          srcset: `${thumb.src} 1x, ${thumb2x.src} 2x`,
          width: Number(thumb.attributes.width),
          height: thumbHeight,
          full: full.src,
          portrait: src.height > src.width,
        };
      })
  );
}
