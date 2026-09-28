<script>
    import { onMount } from 'svelte';
    import { sunElevation, localMidnight, localMinutes, phaseFor, dayEvents, fmtMinutes } from '../../lib/sun';

    /**
     * @type {{ portraits: { id: string, src: string, alt: string, caption: string }[],
     *          landscapes: { id: string, src: string, alt: string, caption: string, light: string }[] }}
     */
    let { portraits = [], landscapes = [] } = $props();

    let midnight = $state(0);
    let minutes = $state(12 * 60);
    let live = $state(true);
    let events = $state({ sunrise: null, sunset: null, goldenEveningStart: null, blueEveningEnd: null });
    let sky;
    let dragging = false;

    const elevation = $derived(midnight ? sunElevation(new Date(midnight + minutes * 60000)) : 30);
    const phase = $derived(phaseFor(elevation));

    // --- Colour keyframes by sun elevation, interpolated continuously ---
    const STOPS = [
        { e: -18, top: '#070b18', bot: '#141b36', ink: '#dfe6f5', accent: '#9fb4ff', card: 'rgba(255,255,255,0.06)' },
        { e: -9, top: '#15224a', bot: '#5a6ea3', ink: '#eef1fa', accent: '#c3d0ff', card: 'rgba(255,255,255,0.08)' },
        { e: -3, top: '#3b4f86', bot: '#d9a0a4', ink: '#fff5ee', accent: '#ffd1b3', card: 'rgba(255,255,255,0.12)' },
        { e: 2, top: '#7f9cc9', bot: '#ffb870', ink: '#2e1a0e', accent: '#b8430f', card: 'rgba(255,255,255,0.3)' },
        { e: 8, top: '#8fb5e0', bot: '#ffe0b0', ink: '#2a2016', accent: '#c2530f', card: 'rgba(255,255,255,0.4)' },
        { e: 20, top: '#5f9bd8', bot: '#dbeafe', ink: '#12203a', accent: '#1d4ed8', card: 'rgba(255,255,255,0.5)' }
    ];
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, t) => {
        if (!a.startsWith('#')) return t < 0.5 ? a : b;
        const [x, y] = [hex(a), hex(b)];
        return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
    };
    const palette = $derived.by(() => {
        const e = Math.max(STOPS[0].e, Math.min(STOPS.at(-1).e, elevation));
        const i = Math.max(0, STOPS.findIndex((s) => s.e >= e) - 1);
        const a = STOPS[i], b = STOPS[i + 1] ?? a;
        const t = b.e === a.e ? 0 : (e - a.e) / (b.e - a.e);
        return Object.fromEntries(['top', 'bot', 'ink', 'accent', 'card'].map((k) => [k, mix(a[k], b[k], t)]));
    });

    // Push the palette onto the whole page so the rest of the site follows the light
    $effect(() => {
        const r = document.documentElement.style;
        r.setProperty('--sky-top', palette.top);
        r.setProperty('--sky-bot', palette.bot);
        r.setProperty('--ink', palette.ink);
        r.setProperty('--accent', palette.accent);
        r.setProperty('--card', palette.card);
        document.documentElement.dataset.phase = phase;
    });

    // --- Copy + photo set for each kind of light ---
    const COPY = {
        golden: ['It’s golden hour in Santaquin.', 'This is when I photograph people — warm, low, forgiving light.'],
        blue: ['It’s blue hour in Santaquin.', 'The people go home. I photograph what’s left: fog, snow, the edge of the sea.'],
        night: ['It’s night in Santaquin.', 'Too dark to shoot. Good time to write code.'],
        day: ['It’s the middle of the day in Santaquin.', 'Flat, bright light. Overcast days are secretly the best for landscapes.']
    };
    const shown = $derived.by(() => {
        if (phase === 'golden') return [...portraits.slice(0, 4), ...landscapes.filter((l) => l.light === 'golden')].slice(0, 6);
        if (phase === 'blue') return landscapes.filter((l) => l.light === 'blue').slice(0, 6);
        if (phase === 'night') return landscapes.filter((l) => l.light === 'blue' || l.light === 'overcast').slice(-6);
        return [...landscapes.filter((l) => l.light === 'overcast'), ...portraits.slice(4)].slice(0, 6);
    });

    // --- Sun position on the sky strip ---
    const MAX_EL = 60;
    const sunX = $derived((minutes / 1440) * 100);
    // Once the sun is well down, a (decorative) moon climbs as the sun sinks
    const bodyEl = $derived(elevation < -6 ? Math.min(40, (-elevation - 6) * 2) : elevation);
    const sunY = $derived(72 - (Math.max(-20, Math.min(MAX_EL, bodyEl)) / MAX_EL) * 62); // % from top; horizon at 72%
    const clock = $derived(fmtMinutes(Math.round(minutes)));

    function setFromPointer(e) {
        const r = sky.getBoundingClientRect();
        minutes = Math.round(Math.max(0, Math.min(1439, ((e.clientX - r.left) / r.width) * 1440)));
        live = false;
    }

    function goLive() {
        const now = new Date();
        midnight = localMidnight(now);
        minutes = localMinutes(now);
        events = dayEvents(midnight);
        live = true;
    }

    onMount(() => {
        goLive();
        const t = setInterval(() => live && goLive(), 30000);
        return () => {
            clearInterval(t);
            ['--sky-top', '--sky-bot', '--ink', '--accent', '--card'].forEach((k) => document.documentElement.style.removeProperty(k));
        };
    });
</script>

<section class="hero">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="sky"
        bind:this={sky}
        onpointerdown={(e) => {
            dragging = true;
            sky.setPointerCapture(e.pointerId);
            setFromPointer(e);
        }}
        onpointermove={(e) => dragging && setFromPointer(e)}
        onpointerup={() => (dragging = false)}
        onpointercancel={() => (dragging = false)}
    >
        <div class="stars" style:opacity={Math.max(0, Math.min(1, (-elevation - 4) / 10))} aria-hidden="true"></div>
        <div
            class="sun"
            class:moon={elevation < -6}
            style:left="{sunX}%"
            style:top="{sunY}%"
            aria-hidden="true"
        ></div>
        <div class="horizon" aria-hidden="true">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
                <!-- Wasatch-ish ridge silhouette -->
                <path d="M0 120 L0 70 L90 52 L160 64 L240 30 L300 44 L360 22 L430 48 L520 36 L600 58 L680 40 L760 60 L850 34 L930 50 L1010 28 L1090 54 L1200 46 L1200 120 Z" />
            </svg>
        </div>

        <div class="sky-text">
            <p class="kicker">Jason Wride · Photographer & developer</p>
            <h1>{COPY[phase][0]}</h1>
            <p class="sub">{COPY[phase][1]}</p>
        </div>
    </div>

    <div class="controls">
        <label class="scrub">
            <span class="clock">{clock}</span>
            <input
                type="range"
                min="0"
                max="1439"
                step="1"
                bind:value={minutes}
                oninput={() => (live = false)}
                aria-label="Time of day in Santaquin"
            />
        </label>
        <button class="live" class:on={live} onclick={goLive}>{live ? '● Live' : 'Back to now'}</button>
        <p class="events">
            ☀︎ {fmtMinutes(events.sunrise)} → {fmtMinutes(events.sunset)} · golden from {fmtMinutes(events.goldenEveningStart)} · blue until {fmtMinutes(events.blueEveningEnd)}
        </p>
        <p class="hint">Drag the sun across the sky (or the slider) to change the light.</p>
    </div>
</section>

<section class="light-gallery" aria-live="polite">
    <h2><span class="dot"></span>{phase === 'golden' ? 'Golden light' : phase === 'blue' ? 'Blue light' : phase === 'night' ? 'After dark' : 'Daylight'} — right now</h2>
    <div class="grid">
        {#each shown as p (p.id)}
            <figure class="shot">
                <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
                <figcaption>{p.caption}</figcaption>
            </figure>
        {/each}
    </div>
</section>

<style>
    .hero { position: relative; }
    .sky {
        position: relative;
        height: min(78vh, 720px);
        min-height: 480px;
        background: linear-gradient(to bottom, var(--sky-top), var(--sky-bot));
        overflow: hidden;
        cursor: grab;
        touch-action: pan-y;
        user-select: none;
        transition: background 0.4s;
    }
    .sky:active { cursor: grabbing; }

    .stars {
        position: absolute;
        inset: 0 0 28% 0;
        background-image:
            radial-gradient(1px 1px at 12% 20%, #fff, transparent),
            radial-gradient(1px 1px at 28% 8%, #fff, transparent),
            radial-gradient(1.5px 1.5px at 44% 26%, #fff, transparent),
            radial-gradient(1px 1px at 63% 12%, #fff, transparent),
            radial-gradient(1px 1px at 77% 30%, #fff, transparent),
            radial-gradient(1.5px 1.5px at 88% 16%, #fff, transparent),
            radial-gradient(1px 1px at 6% 40%, #fff, transparent),
            radial-gradient(1px 1px at 52% 44%, #fff, transparent),
            radial-gradient(1px 1px at 93% 42%, #fff, transparent);
        transition: opacity 0.6s;
    }

    .sun {
        position: absolute;
        width: 72px;
        height: 72px;
        margin: -36px 0 0 -36px;
        border-radius: 50%;
        background: radial-gradient(circle, #fff7d6 0 35%, #ffd27a 60%, rgba(255, 190, 90, 0) 72%);
        box-shadow: 0 0 80px 30px rgba(255, 200, 110, 0.45);
        transition: box-shadow 0.4s, background 0.4s;
        pointer-events: none;
    }
    .sun.moon {
        width: 44px;
        height: 44px;
        margin: -22px 0 0 -22px;
        background: radial-gradient(circle at 35% 35%, #f5f3ea, #cfd3dc 70%);
        box-shadow: 0 0 40px 8px rgba(200, 210, 240, 0.25), inset -10px -6px 0 rgba(0, 0, 0, 0.12);
    }

    .horizon { position: absolute; left: 0; right: 0; bottom: 0; height: 28%; }
    .horizon svg { width: 100%; height: 100%; display: block; }
    .horizon path { fill: color-mix(in srgb, var(--sky-top) 70%, #000); transition: fill 0.4s; }

    .sky-text {
        position: absolute;
        left: clamp(1.25rem, 5vw, 4rem);
        right: clamp(1.25rem, 5vw, 4rem);
        bottom: 32%;
        color: var(--ink);
        pointer-events: none;
        text-shadow: 0 1px 20px rgba(0, 0, 0, 0.12);
    }
    .kicker { font: 600 0.8rem 'Karla', sans-serif; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.8; }
    h1 {
        font-family: 'Newsreader', Georgia, serif;
        font-weight: 400;
        font-size: clamp(2.6rem, 7vw, 5.8rem);
        line-height: 1;
        letter-spacing: -0.02em;
        margin: 0.6rem 0 0.8rem;
        max-width: 16ch;
    }
    .sub { font: italic 400 clamp(1.1rem, 2vw, 1.4rem) 'Newsreader', serif; max-width: 42ch; opacity: 0.9; }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem 1.2rem;
        padding: 1rem clamp(1.25rem, 5vw, 4rem);
        color: var(--ink);
        font-family: 'Karla', sans-serif;
    }
    .scrub { display: flex; align-items: center; gap: 0.8rem; flex: 1 1 320px; }
    .clock { font: 500 1.4rem 'Newsreader', serif; min-width: 5.5ch; }
    .scrub input { flex: 1; accent-color: var(--accent); }
    .live {
        font: 700 0.8rem 'Karla', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        border: 1.5px solid var(--accent);
        background: transparent;
        color: var(--accent);
        cursor: pointer;
    }
    .live.on { background: var(--accent); color: var(--sky-bot); }
    .events { font-size: 0.85rem; opacity: 0.8; width: 100%; }
    .hint { font-size: 0.8rem; opacity: 0.6; width: 100%; }

    .light-gallery { padding: 2rem clamp(1.25rem, 5vw, 4rem) 4rem; color: var(--ink); }
    .light-gallery h2 {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font: 400 clamp(1.8rem, 4vw, 2.8rem) 'Newsreader', serif;
        margin-bottom: 1.5rem;
    }
    .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 16px var(--accent); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.2rem; }
    .shot { animation: rise 0.6s ease both; }
    @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
    .shot img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; display: block; }
    .shot figcaption { font: 0.82rem 'Karla', sans-serif; opacity: 0.75; margin-top: 0.4rem; }
</style>
