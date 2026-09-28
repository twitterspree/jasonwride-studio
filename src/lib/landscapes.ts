import { getImage } from 'astro:assets';
import meta from '../data/landscapes.json';

export type Light = 'golden' | 'blue' | 'overcast';

export interface Landscape {
  id: string;
  alt: string;
  place: string;
  light: Light;
  date: string;
  exif: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
}

type Meta = { alt: string; place: string; light: Light; date: string; aperture: number; shutter: string; iso: number; focal: number };

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/landscapes/*.{jpg,jpeg,png,webp,avif}', { eager: true });

/** Optimised versions of the landscape set (Santaquin + Oregon coast), described in src/data/landscapes.json. */
export async function loadLandscapes(): Promise<Landscape[]> {
  return Promise.all(
    Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([path, mod]) => {
        const id = path.split('/').pop()!.replace(/\.\w+$/, '');
        const m = (meta as Record<string, Meta>)[id];
        const src = mod.default;
        const [thumb, full] = await Promise.all([
          getImage({ src, width: 900, format: 'webp', quality: 80 }),
          getImage({ src, width: 2000, format: 'webp', quality: 82 }),
        ]);
        return {
          id,
          alt: m?.alt ?? 'Landscape photograph by Jason Wride',
          place: m?.place ?? '',
          light: m?.light ?? 'overcast',
          date: m?.date ?? '',
          exif: m ? `${m.focal}mm · f/${m.aperture} · ${m.shutter} · ISO ${m.iso}` : '',
          thumb: thumb.src,
          full: full.src,
          width: src.width,
          height: src.height,
        };
      })
  );
}
