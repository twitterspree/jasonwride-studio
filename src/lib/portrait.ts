import { getImage } from 'astro:assets';
import profile from '../assets/profile.avif';
import profileDepth from '../assets/profile-depth.png';

/** Portrait + depth map for DepthProfile, sized identically so they line up pixel-for-pixel. */
export async function loadPortrait() {
  const [img, depth] = await Promise.all([
    getImage({ src: profile, format: 'webp', quality: 85 }),
    getImage({ src: profileDepth, width: profile.width, height: profile.height, fit: 'fill', format: 'webp', quality: 90 }),
  ]);
  return { src: img.src, depthSrc: depth.src, width: profile.width, height: profile.height };
}
