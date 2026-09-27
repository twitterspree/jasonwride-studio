<script>
    /** @type {{ photos: import('../../lib/photos').Photo[], perStrip?: number }} */
    let { photos = [], perStrip = 4 } = $props();

    const ZOOM = 3;
    const LOUPE = 190;

    let developed = $state({});
    let selects = $state({});
    let loupe = $state(null); // { photo, x, y, fw, fh, mx, my }

    const strips = $derived(
        Array.from({ length: Math.ceil(photos.length / perStrip) }, (_, s) => photos.slice(s * perStrip, s * perStrip + perStrip))
    );
    const selectCount = $derived(Object.values(selects).filter(Boolean).length);

    // Slightly wobbly hand-drawn ellipse, different for each frame
    function circlePath(i) {
        const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        const pts = [];
        for (let k = 0; k <= 26; k++) {
            const t = (k / 24) * Math.PI * 2 + r(1);
            const wob = 1 + (r(k + 2) - 0.5) * 0.08;
            pts.push([50 + Math.cos(t) * 47 * wob, 50 + Math.sin(t) * 44 * wob]);
        }
        return 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L');
    }

    function frameNo(i) {
        return String(i + 12).padStart(2, '0');
    }

    function onMove(e, photo) {
        if (e.pointerType !== 'mouse') return;
        const rect = e.currentTarget.getBoundingClientRect();
        loupe = {
            photo,
            x: e.clientX,
            y: e.clientY,
            fw: rect.width,
            fh: rect.height,
            mx: e.clientX - rect.left,
            my: e.clientY - rect.top
        };
    }

    function onEnter(id) {
        developed[id] = true;
    }

    function onClick(id) {
        // First tap on touch develops; after that, taps toggle the grease-pencil circle
        if (!developed[id]) {
            developed[id] = true;
            return;
        }
        selects[id] = !selects[id];
    }

    function developAll() {
        photos.forEach((p) => (developed[p.id] = true));
    }
</script>

<div class="sheet-tools">
    <button class="grease" onclick={developAll}>Develop all</button>
    <span class="count" aria-live="polite">Selects: <strong>{selectCount}</strong> / {photos.length}</span>
</div>

<div class="sheet">
    {#each strips as strip, s}
        <div class="strip">
            <div class="edge top" aria-hidden="true">
                {#each strip as _, j}
                    <span>▸ {frameNo(s * perStrip + j)}</span><span>{frameNo(s * perStrip + j)}A</span>
                {/each}
            </div>
            <div class="sprockets" aria-hidden="true"></div>
            <div class="frames">
                {#each strip as p, j (p.id)}
                    {@const i = s * perStrip + j}
                    <button
                        class="frame"
                        class:developed={developed[p.id]}
                        class:selected={selects[p.id]}
                        onpointerenter={() => onEnter(p.id)}
                        onpointermove={(e) => onMove(e, p)}
                        onpointerleave={() => (loupe = null)}
                        onclick={() => onClick(p.id)}
                        aria-pressed={!!selects[p.id]}
                        aria-label="Frame {frameNo(i)}: {p.alt}"
                    >
                        <img src={p.thumb} srcset={p.srcset} alt="" loading="lazy" decoding="async" draggable="false" />
                        <svg class="circle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <path d={circlePath(i)} pathLength="1" />
                        </svg>
                        {#if selects[p.id]}<span class="tick" aria-hidden="true">✓</span>{/if}
                    </button>
                {/each}
            </div>
            <div class="sprockets" aria-hidden="true"></div>
            <div class="edge bottom" aria-hidden="true">
                <span>JW 400</span><span>SAFETY FILM</span><span>JW 400</span><span>SAFETY FILM</span>
            </div>
        </div>
    {/each}
</div>

{#if loupe}
    <div
        class="loupe"
        style:left="{loupe.x - LOUPE / 2}px"
        style:top="{loupe.y - LOUPE / 2}px"
        style:width="{LOUPE}px"
        style:height="{LOUPE}px"
        aria-hidden="true"
    >
        <img
            src={loupe.photo.full}
            alt=""
            style:width="{loupe.fw * ZOOM}px"
            style:height="{loupe.fh * ZOOM}px"
            style:left="{LOUPE / 2 - loupe.mx * ZOOM}px"
            style:top="{LOUPE / 2 - loupe.my * ZOOM}px"
        />
        {#if loupe.photo.exif}<span class="loupe-exif">{loupe.photo.exif}</span>{/if}
    </div>
{/if}

<style>
    .sheet-tools {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        font-family: 'Space Mono', monospace;
        font-size: 0.8rem;
    }
    .grease {
        font-family: 'Permanent Marker', cursive;
        font-size: 1.1rem;
        color: var(--grease);
        background: none;
        border: 2px solid var(--grease);
        border-radius: 40% 50% 45% 55% / 60% 50% 55% 45%;
        padding: 0.3rem 1rem;
        cursor: pointer;
        transform: rotate(-2deg);
    }
    .grease:hover { background: var(--grease); color: #0d0d0c; }
    .count strong { color: var(--grease); font-size: 1rem; }

    .sheet {
        display: flex;
        flex-direction: column;
        gap: 1.4rem;
        padding: 1.5rem;
        background: #f4f1ea; /* photo paper */
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
        transform: rotate(-0.4deg);
    }

    .strip {
        background: #141210;
        padding: 0.2rem 0.6rem;
    }

    .edge {
        display: flex;
        justify-content: space-around;
        font: 700 0.6rem/1.4 'Space Mono', monospace;
        letter-spacing: 0.1em;
        color: var(--rebate);
    }

    .sprockets {
        height: 12px;
        background: radial-gradient(circle, transparent 0, transparent 0) ;
        background-image: linear-gradient(90deg, transparent 6px, #f4f1ea 6px, #f4f1ea 14px, transparent 14px);
        background-size: 22px 8px;
        background-repeat: repeat-x;
        background-position: 0 center;
        opacity: 0.85;
        border-radius: 2px;
    }

    .frames {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.6rem;
        padding: 0.35rem 0;
    }

    .frame {
        position: relative;
        aspect-ratio: 3 / 2;
        border: 0;
        padding: 0;
        background: #000;
        cursor: none;
        overflow: visible;
    }

    .frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        /* Colour-negative look: inverted with an orange mask */
        filter: invert(1) sepia(0.8) saturate(2.5) hue-rotate(-15deg) brightness(0.85) contrast(0.9);
        transition: filter 1.4s ease;
        pointer-events: none;
    }
    .frame.developed img { filter: none; }

    .circle {
        position: absolute;
        inset: -14% -10%;
        width: 120%;
        height: 128%;
        pointer-events: none;
        overflow: visible;
    }
    .circle path {
        fill: none;
        stroke: var(--grease);
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        transition: stroke-dashoffset 0.5s ease;
    }
    .selected .circle path { stroke-dashoffset: 0; }

    .tick {
        position: absolute;
        right: -0.4rem;
        bottom: -0.6rem;
        font-family: 'Permanent Marker', cursive;
        font-size: 1.6rem;
        color: var(--grease);
        transform: rotate(8deg);
    }

    .loupe {
        position: fixed;
        z-index: 50;
        border-radius: 50%;
        overflow: hidden;
        pointer-events: none;
        border: 6px solid #1c1c1c;
        box-shadow: 0 0 0 2px #444, 0 20px 40px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 0, 0, 0.5);
        background: #000;
    }
    .loupe img {
        position: absolute;
        max-width: none;
        object-fit: cover;
    }
    .loupe-exif {
        position: absolute;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font: 700 0.55rem 'Space Mono', monospace;
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
    }

    @media (max-width: 800px) {
        .frames { grid-template-columns: repeat(2, 1fr); }
        .sheet { padding: 0.8rem; transform: none; }
        .frame { cursor: pointer; }
    }
</style>
