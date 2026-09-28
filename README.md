# jasonwride.studio

Personal portfolio for Jason Wride — IS student, developer, and photographer. Live at [jasonwride.studio](https://jasonwride.studio).

Static [Astro](https://astro.build) site with [Svelte 5](https://svelte.dev) islands, deployed to Cloudflare as static assets.

## Highlights

- **Depth-mapped portrait** (`DepthProfile.svelte`): a WebGL fragment shader offsets each pixel by a grayscale depth map for a parallax "look around" effect. Server-renders a plain `<img>` first, so the page paints instantly and still works without WebGL.
- **Tree of Life** (`/tree-of-life`, `RadialTree.svelte`): a radial cladogram drawn on Canvas 2D with a custom recursive layout. Select a trait to highlight every lineage that evolved it independently.
- **Theme Lab** (`ThemeDock.svelte`): four palettes plus a custom accent. Tokens live in `global.css` under `[data-theme]`, and an inline boot script in `Base.astro` applies the saved choice before first paint.
- **Photo marquee** with build-time optimized thumbnails and an accessible lightbox.

## Project structure

```text
src/
├── assets/          # Images processed by astro:assets (photos, portrait, depth map)
├── components/      # Svelte islands
├── content/blog/    # Markdown posts (content collection, not routed yet)
├── data/            # tree.json (generated) + traits.json (trait write-ups)
├── layouts/Base.astro
├── pages/           # index, tree-of-life, 404
├── scripts/         # Plain TS modules (particle background)
└── styles/global.css
public/              # favicon, og-image.jpg
build_tree.py        # Generates + validates src/data/tree.json
```

## Commands

| Command            | Action                                                  |
| :----------------- | :------------------------------------------------------ |
| `bun install`      | Install dependencies                                    |
| `bun run dev`      | Dev server at `localhost:4321`                          |
| `bun run build`    | Build the static site to `./dist/`                      |
| `bun run preview`  | Preview the build locally                               |
| `bun run check`    | Type-check `.astro`, `.svelte` and `.ts` files          |
| `bun run tree`     | Regenerate `tree.json` and validate it against traits   |
| `bun run deploy`   | Build and deploy to Cloudflare with Wrangler            |

## Adding content

- **Photos**: drop an image into `src/assets/photos/` and add its alt text (and optionally date and exposure settings) to `src/data/photos.json`, keyed by filename without the extension.
- **Tree species / traits**: edit `tree_data` in `build_tree.py`, describe any new trait in `src/data/traits.json`, then run `bun run tree`.
