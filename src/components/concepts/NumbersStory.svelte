<script>
    import { onMount } from 'svelte';

    /**
     * @type {{ stats: any, images: { portrait: string, cover: string[], landscape: string } }}
     */
    let { stats, images } = $props();
    const P = stats.people;
    const L = stats.landscapes;

    // ------------------------------------------------------------ derived numbers
    const pct = (n, d = P.photos) => Math.round((n / d) * 100);
    const lensMain = P.lenses['Viltrox AF 56/1.4M'] ?? 0;
    const lensPct = ((lensMain / P.photos) * 100).toFixed(1);
    const apertures = Object.entries(P.apertures)
        .map(([f, n]) => ({ f: Number(f), n }))
        .sort((a, b) => a.f - b.f);
    const topAp = apertures.reduce((a, b) => (b.n > a.n ? b : a));
    const wideOpen = P.apertures['1.4'] ?? 0;
    const weekdays = Array.from({ length: 7 }, (_, i) => P.weekdays[i] ?? 0);
    const satPct = pct(weekdays[6]);
    const hours = Array.from({ length: 24 }, (_, i) => P.hours[i] ?? 0);
    const topHour = hours.indexOf(Math.max(...hours));
    const lateAft = pct(hours[16] + hours[17] + hours[18]);
    const months = Array.from({ length: 12 }, (_, i) => P.months[i] ?? 0);
    const golden = P.sun.phases.golden ?? 0;
    const goldenPct = pct(golden);
    const medBefore = P.sun.medianMinutesBeforeSunset;
    const elev = Object.entries(P.sun.elevationBins3deg)
        .map(([b, n]) => ({ b: Number(b), n }))
        .sort((a, b) => a.b - b.b);
    const landIso100 = L.isos['100'] ?? 0;
    const hourLabel = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const span = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // ------------------------------------------------------------ slides
    const SLIDES = [
        { id: 'cover', bg: '#121212', fg: '#f4efe6', accent: '#ffb547' },
        { id: 'count', bg: '#ffb547', fg: '#1a1208', accent: '#1a1208' },
        { id: 'lens', bg: '#1f2d55', fg: '#eef1fb', accent: '#8fb0ff' },
        { id: 'aperture', bg: '#efe6d6', fg: '#1d1a15', accent: '#d2512b' },
        { id: 'saturday', bg: '#d2512b', fg: '#fff3ea', accent: '#ffd8bf' },
        { id: 'clock', bg: '#0f1a14', fg: '#e3efe7', accent: '#5fe39a' },
        { id: 'sun', bg: '#2a1f3d', fg: '#f6eeff', accent: '#ffb547' },
        { id: 'season', bg: '#f4efe6', fg: '#141414', accent: '#2f5d3a' },
        { id: 'record', bg: '#8fb0ff', fg: '#0b1530', accent: '#0b1530' },
        { id: 'land', bg: '#9aa5ae', fg: '#101418', accent: '#ffffff' },
        { id: 'outro', bg: '#121212', fg: '#f4efe6', accent: '#ffb547' }
    ];
    const DURATION = 7000;

    let i = $state(0);
    let progress = $state(0); // 0–1 of the current slide
    let paused = $state(false);
    let held = false;
    let mode = $state('story'); // 'story' | 'page'
    let raf = 0;
    let last = 0;

    const slide = $derived(SLIDES[i]);

    function go(n) {
        i = Math.max(0, Math.min(SLIDES.length - 1, n));
        progress = 0;
    }
    function next() {
        if (i < SLIDES.length - 1) go(i + 1);
        else paused = true;
    }

    function loop(t) {
        const dt = last ? t - last : 0;
        last = t;
        if (!paused && !held && mode === 'story' && !document.hidden) {
            progress += dt / DURATION;
            if (progress >= 1) next();
        }
        raf = requestAnimationFrame(loop);
    }

    function onTap(e) {
        if (e.target.closest('a, button')) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX - r.left < r.width / 3) go(i - 1);
        else next();
    }

    function onKey(e) {
        if (mode !== 'story') return;
        if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') go(i - 1);
        else if (e.key === ' ') {
            e.preventDefault();
            paused = !paused;
        }
    }

    async function share() {
        const data = { title: 'Jason Wride, by the numbers', url: location.href };
        if (navigator.share) await navigator.share(data).catch(() => {});
        else {
            await navigator.clipboard?.writeText(location.href);
            copied = true;
            setTimeout(() => (copied = false), 1600);
        }
    }
    let copied = $state(false);

    // ------------------------------------------------------------ count-up numbers
    function countUp(node, target) {
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const decimals = String(target).includes('.') ? String(target).split('.')[1].length : 0;
        const start = performance.now();
        let id;
        const tick = (now) => {
            const k = reduce ? 1 : Math.min(1, (now - start) / 1100);
            const eased = 1 - Math.pow(1 - k, 3);
            node.textContent = (Number(target) * eased).toFixed(decimals);
            if (k < 1) id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return { destroy: () => cancelAnimationFrame(id) };
    }

    onMount(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) paused = true;
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    });

    const max = (arr) => Math.max(...arr);
</script>

<svelte:window onkeydown={onKey} />

{#snippet content(s, active)}
    {#if s.id === 'cover'}
        <div class="cover-grid" aria-hidden="true">
            {#each images.cover as src}<img {src} alt="" />{/each}
        </div>
        <p class="kicker">jasonwride.studio</p>
        <h2 class="huge">Jason Wride,<br />by the numbers.</h2>
        <p class="sub">A data story pulled from the camera data of {P.photos + L.photos} photographs. Every number here is real.</p>
        <p class="hint">Tap to start →</p>
    {:else if s.id === 'count'}
        <p class="kicker">Since {span(P.firstDate)}</p>
        {#if active}<p class="mega" use:countUp={P.photos}>{P.photos}</p>{:else}<p class="mega">{P.photos}</p>{/if}
        <h2>finished portraits.</h2>
        <p class="sub">Across <b>{P.sessions}</b> sessions on <b>{P.shootingDays}</b> different days — friends’ senior pictures, couples, dances.</p>
    {:else if s.id === 'lens'}
        <p class="kicker">The lens</p>
        <div class="donut-wrap">
            <svg viewBox="0 0 120 120" class="donut" class:grow={active} aria-hidden="true">
                <circle cx="60" cy="60" r="48" class="track" />
                <circle cx="60" cy="60" r="48" class="arc" pathLength="100" style:stroke-dasharray="{lensPct} 100" />
            </svg>
            {#if active}<p class="in-donut"><span use:countUp={lensPct}>{lensPct}</span>%</p>{:else}<p class="in-donut">{lensPct}%</p>{/if}
        </div>
        <h2>through one lens.</h2>
        <p class="sub">A Viltrox 56mm f/1.4 on a Canon M50 — {lensMain} of {P.photos}. The other {P.photos - lensMain} were on a 22mm.</p>
    {:else if s.id === 'aperture'}
        <p class="kicker">Plot twist</p>
        <h2>It’s an f/1.4 lens.<br />I shoot it at f/{topAp.f}.</h2>
        <div class="bars" class:grow={active}>
            {#each apertures.filter((a) => a.f <= 5.6) as a}
                <div class="bar" class:hi={a.f === topAp.f}>
                    <span class="fill" style:--h="{(a.n / topAp.n) * 100}%"></span>
                    <small>{a.f}</small>
                </div>
            {/each}
        </div>
        <p class="sub">f/{topAp.f}: {topAp.n} frames. Wide open at f/1.4: just {wideOpen}. f/{topAp.f} is the comfort zone.</p>
    {:else if s.id === 'saturday'}
        <p class="kicker">When</p>
        {#if active}<p class="mega"><span use:countUp={satPct}>{satPct}</span>%</p>{:else}<p class="mega">{satPct}%</p>{/if}
        <h2>were shot on a Saturday.</h2>
        <div class="bars week" class:grow={active}>
            {#each weekdays as n, d}
                <div class="bar" class:hi={d === 6}>
                    <span class="fill" style:--h="{(n / max(weekdays)) * 100}%"></span>
                    <small>{DAYS[d]}</small>
                </div>
            {/each}
        </div>
        <p class="sub">Which is when dances happen. 💃</p>
    {:else if s.id === 'clock'}
        <p class="kicker">What time</p>
        <svg viewBox="-110 -110 220 220" class="clock" class:grow={active} aria-hidden="true">
            {#each hours as n, h}
                {@const a = (h / 24) * Math.PI * 2 - Math.PI / 2}
                {@const len = 18 + (n / max(hours)) * 72}
                <line x1={Math.cos(a) * 18} y1={Math.sin(a) * 18} x2={Math.cos(a) * len} y2={Math.sin(a) * len} class:hi={h >= 16 && h <= 18} class:zero={!n} />
            {/each}
            <text y="5" text-anchor="middle">24h</text>
            {#each [0, 6, 12, 18] as h}
                {@const a = (h / 24) * Math.PI * 2 - Math.PI / 2}
                <text x={Math.cos(a) * 102} y={Math.sin(a) * 102 + 4} text-anchor="middle" class="tick">{hourLabel(h)}</text>
            {/each}
        </svg>
        <h2>{lateAft}% between 4 and 7 p.m.</h2>
        <p class="sub">Busiest hour: {hourLabel(topHour)} ({hours[topHour]} frames). Never once before noon.</p>
    {:else if s.id === 'sun'}
        <p class="kicker">The honest part</p>
        <h2>I thought I was a golden-hour photographer.</h2>
        <div class="elev" class:grow={active}>
            {#each elev as e}
                <div class="col" class:golden={e.b >= -3 && e.b < 7} class:blue={e.b < -3}>
                    <span class="fill" style:--h="{(e.n / max(elev.map((x) => x.n))) * 100}%"></span>
                </div>
            {/each}
        </div>
        <p class="axis"><span>below horizon</span><span>sun height →</span><span>high noon</span></p>
        <p class="sub">Only <b>{goldenPct}%</b> of frames were in true golden hour. The typical shot: <b>{Math.floor(medBefore / 60)} hr {medBefore % 60} min</b> before sunset. I shoot in the warm-up.</p>
    {:else if s.id === 'season'}
        <p class="kicker">When, again</p>
        <h2>October is dance season.</h2>
        <div class="bars months" class:grow={active}>
            {#each months as n, m}
                <div class="bar" class:hi={m === 9 || m === 3}>
                    <span class="fill" style:--h="{(n / max(months)) * 100}%"></span>
                    <small>{MONTHS[m][0]}</small>
                </div>
            {/each}
        </div>
        <p class="sub">{pct(months[9])}% of everything in October (Sadie’s, homecoming). April is prom + senior pictures: {months[3]} frames.</p>
    {:else if s.id === 'record'}
        <p class="kicker">Personal record</p>
        {#if active}<p class="mega" use:countUp={P.busiestDay}>{P.busiestDay}</p>{:else}<p class="mega">{P.busiestDay}</p>{/if}
        <h2>finished photos from a single day.</h2>
        <p class="sub">Fastest shutter: {P.fastestShutter}. Highest ISO: {P.maxIso}. Lowest: {P.minIso}.</p>
    {:else if s.id === 'land'}
        <img class="full-bleed" src={images.landscape} alt="Dune grass rolling into fog at twilight on the Oregon coast" />
        <div class="over">
            <p class="kicker">And when nobody’s around</p>
            <h2>{L.photos} landscapes. {landIso100} at ISO 100.</h2>
            <p class="sub">{L.utah} in Santaquin, Utah. {L.oregon} on the Oregon coast. Fog, snow, sea foam — slow light, low ISO.</p>
        </div>
    {:else if s.id === 'outro'}
        <img class="avatar" src={images.portrait} alt="Portrait of Jason Wride" />
        <p class="kicker">That’s the data.</p>
        <h2 class="huge">Here’s the person.</h2>
        <p class="sub">Jason Wride — Information Systems at the University of Utah. Photographer. Builds things like <a href="/tree-of-life">the Tree of Life</a> and a local AI that reads your texts (offline).</p>
        <div class="cta">
            <a class="btn" href="mailto:jason.wride@utah.edu">Say hi</a>
            <button class="btn ghost" onclick={() => go(0)}>Replay ↺</button>
            <button class="btn ghost" onclick={share}>{copied ? 'Link copied' : 'Share'}</button>
        </div>
        <p class="fine">{stats.note}</p>
    {/if}
{/snippet}

<div class="wrap">
    <div class="mode-switch">
        <button class:on={mode === 'story'} onclick={() => (mode = 'story')}>Story</button>
        <button class:on={mode === 'page'} onclick={() => (mode = 'page')}>All on one page</button>
    </div>

    {#if mode === 'story'}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
            class="story"
            style:--bg={slide.bg}
            style:--fg={slide.fg}
            style:--accent={slide.accent}
            onclick={onTap}
            onpointerdown={() => (held = true)}
            onpointerup={() => (held = false)}
            onpointerleave={() => (held = false)}
            aria-roledescription="story"
            aria-label="Slide {i + 1} of {SLIDES.length}"
        >
            <div class="progress" aria-hidden="true">
                {#each SLIDES as _, k}
                    <span><i style:width="{k < i ? 100 : k === i ? progress * 100 : 0}%"></i></span>
                {/each}
            </div>
            <button class="pause" onclick={() => (paused = !paused)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
            {#key i}
                <section class="slide s-{slide.id}" aria-live="polite">
                    {@render content(slide, true)}
                </section>
            {/key}
        </div>
        <p class="help">Tap right for next, left for back. Hold to pause. ← → on a keyboard.</p>
    {:else}
        <div class="page">
            {#each SLIDES as s (s.id)}
                <section class="slide page-slide s-{s.id}" style:--bg={s.bg} style:--fg={s.fg} style:--accent={s.accent}>
                    {@render content(s, false)}
                </section>
            {/each}
        </div>
    {/if}
</div>

<style>
    .wrap { display: flex; flex-direction: column; align-items: center; padding: 3.4rem 1rem 2rem; font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
    .mode-switch { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); margin-bottom: 1rem; }
    .mode-switch button { font: 600 0.85rem 'Bricolage Grotesque', sans-serif; border: 0; border-radius: 999px; padding: 0.4rem 0.9rem; background: none; color: #bbb; cursor: pointer; }
    .mode-switch .on { background: #f4efe6; color: #121212; }

    .story {
        position: relative;
        width: min(440px, 100%);
        height: min(820px, calc(100dvh - 8rem));
        min-height: 560px;
        border-radius: 22px;
        overflow: hidden;
        background: var(--bg);
        color: var(--fg);
        box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
        transition: background 0.5s, color 0.5s;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .progress { position: absolute; top: 12px; left: 12px; right: 52px; display: flex; gap: 4px; z-index: 3; }
    .progress span { flex: 1; height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--fg) 25%, transparent); overflow: hidden; }
    .progress i { display: block; height: 100%; background: var(--fg); }
    .pause { position: absolute; top: 4px; right: 10px; z-index: 3; border: 0; background: none; color: var(--fg); font-size: 0.8rem; padding: 0.4rem; cursor: pointer; }
    .help { margin-top: 0.8rem; font-size: 0.8rem; color: #9a958c; }

    .slide {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.7rem;
        padding: 3.2rem 1.8rem 2rem;
        animation: slideIn 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
    }
    @keyframes slideIn { from { opacity: 0; transform: translateY(18px); } }
    .slide > * { animation: rise 0.6s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    .slide > :nth-child(2) { animation-delay: 0.08s; }
    .slide > :nth-child(3) { animation-delay: 0.16s; }
    .slide > :nth-child(4) { animation-delay: 0.24s; }
    .slide > :nth-child(5) { animation-delay: 0.32s; }
    @keyframes rise { from { opacity: 0; transform: translateY(14px); } }

    .kicker { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
    h2 { font-size: clamp(1.7rem, 6vw, 2.3rem); font-weight: 800; line-height: 1.02; letter-spacing: -0.02em; }
    .huge { font-size: clamp(2.6rem, 10vw, 3.4rem); }
    .mega { font-size: clamp(5rem, 26vw, 8.5rem); font-weight: 800; line-height: 0.85; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; color: var(--accent); }
    .sub { font-size: 1.02rem; line-height: 1.45; opacity: 0.9; }
    .sub a { color: inherit; }
    .hint { font-weight: 700; margin-top: 1rem; }

    .cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 0.8rem; }
    .cover-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
    .cover-grid img:nth-child(odd) { transform: rotate(-2deg); }
    .cover-grid img:nth-child(even) { transform: rotate(2deg) translateY(8px); }

    .donut-wrap { position: relative; width: 210px; align-self: center; }
    .donut { width: 100%; transform: rotate(-90deg); }
    .donut circle { fill: none; stroke-width: 16; }
    .donut .track { stroke: color-mix(in srgb, var(--fg) 15%, transparent); }
    .donut .arc { stroke: var(--accent); stroke-linecap: round; }
    .donut.grow .arc { animation: dash 1.3s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    @keyframes dash { from { stroke-dasharray: 0 100; } }
    .in-donut { position: absolute; inset: 0; display: grid; place-items: center; font-size: 2.6rem; font-weight: 800; letter-spacing: -0.03em; }

    .bars { display: flex; align-items: flex-end; gap: 6px; height: 170px; margin: 0.4rem 0; }
    .bar { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; }
    .bar .fill { display: block; width: 100%; height: var(--h); min-height: 2px; border-radius: 4px 4px 0 0; background: color-mix(in srgb, var(--fg) 30%, transparent); }
    .bar.hi .fill { background: var(--accent); }
    .bar small { font-size: 0.7rem; opacity: 0.8; font-variant-numeric: tabular-nums; }
    .grow .fill { animation: grow 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) both; transform-origin: bottom; }
    @keyframes grow { from { transform: scaleY(0); } }
    .bars.week, .bars.months { height: 130px; }

    .clock { width: 230px; align-self: center; overflow: visible; }
    .clock line { stroke: color-mix(in srgb, var(--fg) 35%, transparent); stroke-width: 7; stroke-linecap: round; }
    .clock line.hi { stroke: var(--accent); }
    .clock line.zero { stroke: color-mix(in srgb, var(--fg) 12%, transparent); }
    .clock text { fill: var(--fg); font: 700 13px 'Bricolage Grotesque', sans-serif; }
    .clock .tick { font-size: 9px; font-weight: 500; opacity: 0.7; }
    .clock.grow line { animation: fadein 0.8s ease both; }
    @keyframes fadein { from { opacity: 0; } }

    .elev { display: flex; align-items: flex-end; gap: 3px; height: 150px; margin-top: 0.4rem; }
    .elev .col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
    .elev .fill { display: block; width: 100%; height: var(--h); border-radius: 3px 3px 0 0; background: color-mix(in srgb, var(--fg) 30%, transparent); }
    .elev .golden .fill { background: var(--accent); }
    .elev .blue .fill { background: #7d8cff; }
    .elev.grow .fill { animation: grow 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) both; transform-origin: bottom; }
    .axis { display: flex; justify-content: space-between; font-size: 0.7rem; opacity: 0.7; }

    .s-land { padding: 0; justify-content: flex-end; }
    .full-bleed { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .over { position: relative; display: flex; flex-direction: column; gap: 0.6rem; padding: 6rem 1.8rem 2rem; background: linear-gradient(transparent, rgba(16, 20, 24, 0.85)); color: #f2f4f6; }
    .over .kicker { color: #fff; }

    .avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; object-position: 50% 22%; border: 3px solid var(--accent); }
    .cta { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem; }
    .btn { font: 700 0.95rem 'Bricolage Grotesque', sans-serif; padding: 0.6rem 1.1rem; border-radius: 999px; border: 2px solid var(--accent); background: var(--accent); color: #121212; text-decoration: none; cursor: pointer; }
    .btn.ghost { background: transparent; color: var(--fg); }
    .fine { font-size: 0.72rem; opacity: 0.55; margin-top: 0.6rem; }

    /* "All on one page" mode */
    .page { display: grid; gap: 1.2rem; width: min(560px, 100%); }
    .page-slide { position: relative; inset: auto; min-height: 0; border-radius: 22px; overflow: hidden; background: var(--bg); color: var(--fg); padding: 2rem 1.8rem; animation: none; }
    .page-slide.s-land { min-height: 420px; padding: 0; }

    @media (max-width: 520px) {
        .wrap { padding: 3.2rem 0 1rem; }
        .story { width: 100%; height: calc(100dvh - 7.5rem); border-radius: 0; }
    }
</style>
