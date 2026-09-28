<script>
    import { onMount } from 'svelte';

    /** @type {{ src: string, alt: string, caption?: string, writing?: string, sub?: string, tall?: boolean }} */
    let { src, alt, caption = '', writing = '', sub = '', tall = false } = $props();

    let pane;
    let canvas;
    let img;
    let revealed = $state(false);
    let hintGone = $state(false);

    onMount(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const ctx = canvas.getContext('2d');
        const fog = document.createElement('canvas');
        const fctx = fog.getContext('2d');
        const probe = document.createElement('canvas');
        probe.width = 48;
        probe.height = 30;
        const pctx = probe.getContext('2d', { willReadFrequently: true });

        let W = 0, H = 0, dpr = 1;
        let visible = false;
        let frame = 0;
        let tick = 0;
        let last = null;
        let drips = [];
        let writeProgress = writing ? 0 : 1;

        // Blurry, milky copy of the photo: draw it tiny, scale it back up, tint it pale
        function buildFog() {
            fog.width = canvas.width;
            fog.height = canvas.height;
            const tiny = document.createElement('canvas');
            tiny.width = Math.max(8, Math.round(W / 22));
            tiny.height = Math.max(6, Math.round(H / 22));
            const tctx = tiny.getContext('2d');
            // cover-fit the photo into the tiny canvas
            const ir = img.naturalWidth / img.naturalHeight, cr = tiny.width / tiny.height;
            const [sw, sh] = ir > cr ? [img.naturalHeight * cr, img.naturalHeight] : [img.naturalWidth, img.naturalWidth / cr];
            tctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, tiny.width, tiny.height);
            fctx.imageSmoothingQuality = 'high';
            fctx.drawImage(tiny, 0, 0, fog.width, fog.height);
            fctx.fillStyle = 'rgba(214, 222, 230, 0.62)';
            fctx.fillRect(0, 0, fog.width, fog.height);
            // condensation beads
            for (let i = 0; i < (W * H) / 900; i++) {
                const x = Math.random() * fog.width, y = Math.random() * fog.height, r = (Math.random() * 1.6 + 0.4) * dpr;
                fctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.25})`;
                fctx.beginPath();
                fctx.arc(x, y, r, 0, Math.PI * 2);
                fctx.fill();
            }
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            W = pane.clientWidth;
            H = pane.clientHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            if (!img.complete || !img.naturalWidth) return;
            buildFog();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.drawImage(fog, 0, 0);
        }

        // Clear a soft round spot of fog
        function wipeAt(x, y, r = 46) {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r * dpr);
            g.addColorStop(0, 'rgba(0,0,0,1)');
            g.addColorStop(0.6, 'rgba(0,0,0,0.85)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r * dpr, 0, Math.PI * 2);
            ctx.fill();
        }

        function wipeLine(a, b) {
            const dist = Math.hypot(b.x - a.x, b.y - a.y);
            const steps = Math.max(1, Math.ceil(dist / (8 * dpr)));
            for (let i = 0; i <= steps; i++) wipeAt(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
            // Occasionally a drop gathers and runs down the glass
            if (!reduced && Math.random() < 0.08) drips.push({ x: b.x + (Math.random() - 0.5) * 30 * dpr, y: b.y + 30 * dpr, v: 1.5 + Math.random() * 1.5, life: 60 + Math.random() * 120 });
            hintGone = true;
            wake();
        }

        function pos(e) {
            const r = canvas.getBoundingClientRect();
            return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
        }

        function onMove(e) {
            // Mouse wipes on hover; touch/pen wipe while dragging
            if (e.pointerType !== 'mouse' && e.buttons === 0 && e.pressure === 0) return;
            const p = pos(e);
            if (last) wipeLine(last, p);
            else wipeAt(p.x, p.y);
            last = p;
        }
        const onLeave = () => (last = null);

        // Finger-write the pane's word into the fog, left to right
        function writeStep() {
            if (writeProgress >= 1 || !writing) return;
            writeProgress = Math.min(1, writeProgress + 0.012);
            let size = Math.min(H * 0.24, 150) * dpr;
            ctx.save();
            ctx.font = `600 ${size}px Caveat, cursive`;
            // shrink to fit comfortably inside the pane
            const fit = (canvas.width * 0.84) / ctx.measureText(writing).width;
            if (fit < 1) {
                size *= fit;
                ctx.font = `600 ${size}px Caveat, cursive`;
            }
            const tw = ctx.measureText(writing).width;
            const x0 = (canvas.width - tw) / 2;
            ctx.beginPath();
            ctx.rect(x0 - 10, 0, (tw + 20) * writeProgress, canvas.height);
            ctx.clip();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.textBaseline = 'middle';
            ctx.fillText(writing, x0, canvas.height * 0.42);
            ctx.restore();
        }

        function measureClear() {
            pctx.clearRect(0, 0, 48, 30);
            pctx.drawImage(canvas, 0, 0, 48, 30);
            const d = pctx.getImageData(0, 0, 48, 30).data;
            let a = 0;
            for (let i = 3; i < d.length; i += 4) a += d[i];
            return 1 - a / (255 * (d.length / 4));
        }

        function loop() {
            tick++;
            writeStep();

            // drips run down clearing a thin trail, slowing as they go
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            drips = drips.filter((d) => {
                ctx.beginPath();
                ctx.arc(d.x, d.y, 3 * dpr, 0, Math.PI * 2);
                ctx.fill();
                d.y += d.v * dpr;
                d.v *= 0.985;
                d.x += (Math.random() - 0.5) * 0.6;
                return --d.life > 0 && d.y < canvas.height;
            });

            // fog slowly creeps back
            if (!reduced && writeProgress >= 1) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 0.0018;
                ctx.drawImage(fog, 0, 0);
                ctx.globalAlpha = 1;
            }

            if (tick % 20 === 0 && !revealed && measureClear() > 0.33) revealed = true;
            frame = visible ? requestAnimationFrame(loop) : 0;
        }

        function wake() {
            if (!frame && visible) frame = requestAnimationFrame(loop);
        }

        const io = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            wake();
        }, { threshold: 0.05 });

        const ro = new ResizeObserver(resize);

        const start = async () => {
            await document.fonts?.load('600 80px Caveat').catch(() => {});
            resize();
            ro.observe(pane);
            io.observe(pane);
        };
        if (img.complete && img.naturalWidth) start();
        else img.addEventListener('load', start, { once: true });

        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerdown', onMove);
        canvas.addEventListener('pointerleave', onLeave);
        canvas.addEventListener('pointerup', onLeave);

        return () => {
            cancelAnimationFrame(frame);
            io.disconnect();
            ro.disconnect();
        };
    });
</script>

<figure class="pane" class:tall bind:this={pane}>
    <img bind:this={img} {src} {alt} decoding="async" crossorigin="anonymous" />
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
    {#if sub}<p class="sub">{sub}</p>{/if}
    {#if !hintGone}<span class="hint" aria-hidden="true">wipe the glass</span>{/if}
    {#if caption}
        <figcaption class:show={revealed}>{caption}</figcaption>
    {/if}
</figure>

<style>
    .pane {
        position: relative;
        height: min(82vh, 760px);
        min-height: 420px;
        overflow: hidden;
        background: #9aa6b2;
        /* window frame */
        border: 14px solid var(--frame, #2b2f33);
        border-bottom-width: 22px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 40px rgba(0, 0, 0, 0.35);
    }
    .pane.tall { height: min(92vh, 900px); }
    img, canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
    }
    img { object-fit: cover; }
    canvas { cursor: crosshair; touch-action: pan-y; }

    .sub {
        position: absolute;
        left: 50%;
        top: 62%;
        transform: translateX(-50%);
        width: min(90%, 38ch);
        text-align: center;
        font: 500 1.05rem/1.5 'Instrument Sans', sans-serif;
        color: #1f2830;
        pointer-events: none;
        text-shadow: 0 0 12px rgba(230, 236, 242, 0.9);
    }
    .hint {
        position: absolute;
        right: 1rem;
        bottom: 1rem;
        font: 1.2rem 'Caveat', cursive;
        color: #33404c;
        pointer-events: none;
        animation: bob 2s ease-in-out infinite;
    }
    @keyframes bob { 50% { transform: translateX(-8px); } }

    figcaption {
        position: absolute;
        left: 1rem;
        bottom: 1rem;
        padding: 0.4rem 0.7rem;
        font: 500 0.8rem 'Instrument Sans', sans-serif;
        letter-spacing: 0.02em;
        color: #fff;
        background: rgba(20, 26, 32, 0.6);
        backdrop-filter: blur(4px);
        border-radius: 3px;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.6s, transform 0.6s;
        pointer-events: none;
    }
    figcaption.show { opacity: 1; transform: none; }
</style>
