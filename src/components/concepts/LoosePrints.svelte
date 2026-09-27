<script>
    import { onMount } from 'svelte';

    /** @type {{ photos: import('../../lib/photos').Photo[] }} */
    let { photos = [] } = $props();

    let table;
    let top = 10;
    let frame = 0;

    // Deterministic "casual pile" so SSR and client agree
    const seed = (i) => ((Math.sin(i * 91.7) + 1) / 2);
    let prints = $state(
        photos.map((p, i) => ({
            ...p,
            x: 0,
            y: 0,
            rot: (seed(i) - 0.5) * 24,
            vx: 0,
            vy: 0,
            z: i + 1,
            flipped: false,
            dragging: false,
            placed: false
        }))
    );
    let els = $state([]);

    let drag = null; // { i, lastX, lastY, moved }

    function scatter() {
        const w = table.clientWidth;
        const h = table.clientHeight;
        prints.forEach((p, i) => {
            const el = els[i];
            if (!el) return;
            const cols = Math.min(4, prints.length);
            const col = i % cols;
            const row = Math.floor(i / cols);
            p.x = ((col + 0.5) / cols) * w - el.offsetWidth / 2 + (seed(i + 3) - 0.5) * 60;
            p.y = row * (h * 0.42) + 20 + (seed(i + 7) - 0.5) * 40;
            p.placed = true;
        });
    }

    function step() {
        let moving = false;
        const w = table.clientWidth;
        const h = table.clientHeight;
        prints.forEach((p, i) => {
            if (p.dragging) return;
            if (Math.abs(p.vx) < 0.1 && Math.abs(p.vy) < 0.1) return;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vx * 0.15; // prints spin a little as they skid
            p.vx *= 0.93;
            p.vy *= 0.93;
            const el = els[i];
            const pw = el.offsetWidth;
            const ph = el.offsetHeight;
            if (p.x < -pw * 0.3) { p.x = -pw * 0.3; p.vx *= -0.6; }
            if (p.x > w - pw * 0.7) { p.x = w - pw * 0.7; p.vx *= -0.6; }
            if (p.y < -ph * 0.3) { p.y = -ph * 0.3; p.vy *= -0.6; }
            if (p.y > h - ph * 0.7) { p.y = h - ph * 0.7; p.vy *= -0.6; }
            moving = true;
        });
        frame = moving ? requestAnimationFrame(step) : 0;
    }

    function down(e, i) {
        const p = prints[i];
        p.z = ++top;
        p.dragging = true;
        p.vx = p.vy = 0;
        drag = { i, lastX: e.clientX, lastY: e.clientY, moved: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function move(e) {
        if (!drag) return;
        const p = prints[drag.i];
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        p.x += dx;
        p.y += dy;
        p.vx = dx;
        p.vy = dy;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
    }

    function up() {
        if (!drag) return;
        const p = prints[drag.i];
        p.dragging = false;
        // A click (not a drag) flips the print over
        if (drag.moved < 4) p.flipped = !p.flipped;
        else if (!frame) frame = requestAnimationFrame(step);
        drag = null;
    }

    const fmt = (d) =>
        d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    onMount(() => {
        scatter();
        return () => cancelAnimationFrame(frame);
    });
</script>

<div class="table" bind:this={table}>
    {#each prints as p, i (p.id)}
        <button
            bind:this={els[i]}
            class="print"
            class:portrait={p.portrait}
            class:flipped={p.flipped}
            class:dragging={p.dragging}
            class:placed={p.placed}
            style:transform="translate({p.x}px, {p.y}px) rotate({p.rot}deg)"
            style:z-index={p.z}
            onpointerdown={(e) => down(e, i)}
            onpointermove={move}
            onpointerup={up}
            onpointercancel={up}
            aria-label="{p.alt}. Click to flip, drag to move."
        >
            <span class="card">
                <span class="face front">
                    <img src={p.thumb} srcset={p.srcset} alt="" draggable="false" loading="lazy" />
                </span>
                <span class="face back">
                    <span class="note">{fmt(p.date)}</span>
                    <span class="note small">{p.exif}</span>
                    <span class="note tiny">— J.W.</span>
                </span>
            </span>
        </button>
    {/each}
</div>

<style>
    .table {
        position: relative;
        height: 640px;
        border-radius: 4px;
        background:
            radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.35), transparent 60%),
            #d9cbb3;
        box-shadow: inset 0 2px 30px rgba(60, 40, 10, 0.25);
        overflow: hidden;
        touch-action: none;
    }

    .print {
        position: absolute;
        left: 0;
        top: 0;
        width: 260px;
        aspect-ratio: 3 / 2.2;
        border: 0;
        background: none;
        padding: 0;
        cursor: grab;
        perspective: 1200px;
        opacity: 0;
        transition: opacity 0.4s ease;
    }
    .print.placed { opacity: 1; }
    .print.portrait { width: 180px; aspect-ratio: 2.2 / 3; }
    .print.dragging { cursor: grabbing; }

    .card {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1.2);
    }
    .flipped .card { transform: rotateY(180deg); }

    .face {
        position: absolute;
        inset: 0;
        backface-visibility: hidden;
        background: #fbf8f1;
        padding: 10px;
        box-shadow: 0 2px 3px rgba(0, 0, 0, 0.15), 0 10px 24px rgba(40, 25, 5, 0.25);
    }
    .dragging .face { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.12), 0 30px 50px rgba(40, 25, 5, 0.35); }

    .front img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
    }

    .back {
        transform: rotateY(180deg);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 0.3rem;
        color: #3a4a8c; /* ballpoint blue */
        font-family: 'Caveat', cursive;
        background:
            repeating-linear-gradient(transparent 0 23px, rgba(58, 74, 140, 0.12) 23px 24px),
            #fbf8f1;
    }
    .note { font-size: 1.6rem; transform: rotate(-3deg); }
    .note.small { font-size: 1.1rem; }
    .note.tiny { font-size: 1rem; align-self: flex-end; margin-right: 1rem; }

    @media (max-width: 700px) {
        .table { height: 760px; }
        .print { width: 180px; }
        .print.portrait { width: 130px; }
    }
</style>
