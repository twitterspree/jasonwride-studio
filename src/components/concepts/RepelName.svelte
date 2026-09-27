<script>
    import { onMount } from 'svelte';

    let { text = 'JASON WRIDE', radius = 220 } = $props();

    const letters = [...text];
    let els = $state([]);
    let springs = letters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, w: 112 }));
    let centers = [];
    let mouse = null;
    let frame = 0;

    function measure() {
        centers = els.map((el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const s = springs[els.indexOf(el)];
            // Subtract the current offset so we store the letter's resting centre (page coords)
            return { x: r.left + r.width / 2 - s.x + window.scrollX, y: r.top + r.height / 2 - s.y + window.scrollY };
        });
    }

    function tick() {
        let active = false;
        springs.forEach((s, i) => {
            const c = centers[i];
            if (!c) return;
            let tx = 0;
            let ty = 0;
            let tw = 112;
            if (mouse) {
                const dx = c.x - window.scrollX - mouse.x;
                const dy = c.y - window.scrollY - mouse.y;
                const d = Math.hypot(dx, dy) || 1;
                if (d < radius) {
                    const f = 1 - d / radius;
                    tx = (dx / d) * f * 60;
                    ty = (dy / d) * f * 60;
                    tw = 112 - f * 50; // squeeze as the cursor gets close (wdth 62–112)
                }
            }
            // Springy follow
            s.vx = (s.vx + (tx - s.x) * 0.12) * 0.78;
            s.vy = (s.vy + (ty - s.y) * 0.12) * 0.78;
            s.x += s.vx;
            s.y += s.vy;
            s.w += (tw - s.w) * 0.15;
            if (Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 || Math.abs(tw - s.w) > 0.2) active = true;
            const el = els[i];
            if (el) {
                el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
                el.style.fontVariationSettings = `'wdth' ${s.w.toFixed(1)}`;
            }
        });
        frame = active || mouse ? requestAnimationFrame(tick) : 0;
    }

    function wake() {
        if (!frame) frame = requestAnimationFrame(tick);
    }

    onMount(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        measure();
        const onMove = (e) => {
            mouse = { x: e.clientX, y: e.clientY };
            wake();
        };
        const onLeave = () => {
            mouse = null;
            wake();
        };
        const ro = new ResizeObserver(measure);
        ro.observe(document.body);
        document.fonts?.ready.then(measure);
        window.addEventListener('pointermove', onMove);
        document.documentElement.addEventListener('pointerleave', onLeave);
        return () => {
            cancelAnimationFrame(frame);
            ro.disconnect();
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
        };
    });
</script>

<h1 class="repel" aria-label={text}>
    {#each letters as ch, i}
        {#if ch === ' '}
            <br />
        {:else}
            <span bind:this={els[i]} aria-hidden="true">{ch}</span>
        {/if}
    {/each}
</h1>

<style>
    .repel {
        font-family: 'Archivo', sans-serif;
        font-weight: 900;
        font-size: clamp(4.5rem, 17vw, 15rem);
        line-height: 0.8;
        letter-spacing: -0.04em;
        font-variation-settings: 'wdth' 112;
        user-select: none;
    }
    span {
        display: inline-block;
        will-change: transform;
    }
</style>
