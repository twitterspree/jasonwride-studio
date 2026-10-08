<script>
    import { onMount, tick } from 'svelte';
    import DofPortrait from './DofPortrait.svelte';

    /**
     * @typedef {{ f: number, shutter: string, iso: number, focal: number }} Exif
     * @typedef {{ id: string, kind: 'photo', src: string, alt: string, caption: string, exif: Exif | null }} PhotoScene
     * @typedef {{ id: string, title: string, text: string, stack: string, href?: string, art: string, tint: string }} Project
     * @type {{ portrait: { src: string, depthSrc: string, bgSrc: string, alt: string }, portraits: PhotoScene[], landscapes: PhotoScene[], projects: Project[] }}
     */
    let { portrait, portraits = [], landscapes = [], projects = [] } = $props();

    // ----------------------------------------------------------- modes
    const MODES = [
        { id: 'A+', name: 'Auto', blurb: 'Start here. Click to focus, turn the aperture dial.' },
        { id: 'P', name: 'People', blurb: 'Portraits — friends, seniors, dances.' },
        { id: 'L', name: 'Landscape', blurb: 'Santaquin + the Oregon coast.' },
        { id: 'M', name: 'Manual', blurb: 'Game: guess my real camera settings.' },
        { id: 'C', name: 'Code', blurb: 'Things I build when I’m not shooting.' }
    ];
    let mode = $state('A+');
    let idx = $state({ P: 0, L: 0, C: 0 });
    const modeIndex = $derived(MODES.findIndex((m) => m.id === mode));

    // Third-stop scales real cameras use
    const APERTURES = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16];
    const SHUTTERS = ['1/30', '1/40', '1/50', '1/60', '1/80', '1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400', '1/500', '1/640', '1/800', '1/1000', '1/1250', '1/1600', '1/2000', '1/2500', '1/3200', '1/4000'];
    const ISOS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400];
    const nearest = (list, v) => {
        const num = (x) => (typeof x === 'string' ? 1 / Number(x.split('/')[1] ?? 1) : x);
        let best = 0;
        list.forEach((x, i) => {
            if (Math.abs(Math.log(num(x) / num(v))) < Math.abs(Math.log(num(list[best]) / num(v)))) best = i;
        });
        return best;
    };

    // ----------------------------------------------------------- A+ portrait (Av mode)
    let apIdx = $state(0); // f/1.4
    const aperture = $derived(APERTURES[apIdx]);
    let focusDepth = $state(0.85);
    // Aperture priority: camera picks the shutter to keep exposure constant
    const avShutter = $derived(SHUTTERS[Math.min(SHUTTERS.length - 1, Math.max(0, SHUTTERS.length - 1 - apIdx))]);

    // ----------------------------------------------------------- current scene
    const scene = $derived.by(() => {
        if (mode === 'P') return portraits[idx.P];
        if (mode === 'L') return landscapes[idx.L];
        if (mode === 'M') return game.rounds[game.round];
        if (mode === 'C') return { kind: 'project', ...projects[idx.C] };
        return { kind: 'portrait', id: 'me', src: portrait.src, alt: portrait.alt, caption: 'Jason Wride — photographer & developer. Information Systems, University of Utah.' };
    });

    const readout = $derived.by(() => {
        if (mode === 'A+') return { f: `F${aperture}`, t: avShutter, iso: 'ISO 100', tag: 'Av' };
        if (mode === 'C' || !scene) return { f: 'F--', t: '--', iso: 'ISO --', tag: 'C' };
        if (mode === 'M') {
            const g = game.guess;
            return { f: `F${APERTURES[g.f]}`, t: SHUTTERS[g.t], iso: `ISO ${ISOS[g.iso]}`, tag: 'M' };
        }
        const e = scene.exif;
        return e ? { f: `F${e.f}`, t: e.shutter, iso: `ISO ${e.iso}`, tag: mode } : { f: 'F--', t: '--', iso: 'ISO --', tag: mode };
    });

    // ----------------------------------------------------------- AF point + spot meter + histogram
    let evf;
    let af = $state({ x: 50, y: 45 });
    let afLocked = $state(false);
    let histo = $state([]);
    let meter = $state(0);
    let lum = null; // { w, h, data: Float32Array } luminance of the current image, small
    let depthLum = null;

    async function analyse(url) {
        if (!url) {
            histo = [];
            lum = null;
            return;
        }
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        if (!img.naturalWidth) return;
        const w = 160, h = Math.round((160 * img.naturalHeight) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, w, h);
        const px = x.getImageData(0, 0, w, h).data;
        const data = new Float32Array(w * h);
        const bins = new Array(64).fill(0);
        for (let i = 0; i < w * h; i++) {
            const l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
            data[i] = l;
            bins[Math.min(63, Math.floor(l * 64))]++;
        }
        const max = Math.max(...bins);
        // square-root scale so one huge bin (e.g. a black backdrop) doesn't flatten the rest
        histo = bins.map((b) => Math.sqrt(b / max));
        lum = { w, h, data, aspect: img.naturalWidth / img.naturalHeight };
        spotMeter();
    }

    async function analyseDepth(url) {
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        const w = 120, h = Math.round((120 * img.naturalHeight) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, w, h);
        const px = x.getImageData(0, 0, w, h).data;
        const data = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) data[i] = px[i * 4] / 255;
        depthLum = { w, h, data, aspect: img.naturalWidth / img.naturalHeight, fit: 'contain' };
        // Start focused on the face, roughly where it sits in the frame
        if (evf) {
            const saved = af;
            af = { x: 50, y: 30 };
            focusDepth = sample(depthLum, 3);
            af = saved;
        }
    }

    // Map a point in the (object-fit: cover) viewfinder to image pixel coords
    // Map a point in the viewfinder to image pixel coords. Photos are object-fit: cover;
    // the A+ portrait is fitted with contain, so points beside it are "background" (null).
    function toImage(map, px, py) {
        const r = evf.getBoundingClientRect();
        const ca = r.width / r.height;
        let u = px / 100, v = py / 100;
        if (map.fit === 'contain') {
            if (ca > map.aspect) u = 0.5 + (u - 0.5) * (ca / map.aspect);
            else v = 0.5 + (v - 0.5) * (map.aspect / ca);
            if (u < 0 || u > 1 || v < 0 || v > 1) return null;
        } else if (ca > map.aspect) v = 0.5 + (v - 0.5) * (map.aspect / ca);
        else u = 0.5 + (u - 0.5) * (ca / map.aspect);
        return [Math.min(map.w - 1, Math.max(0, Math.round(u * map.w))), Math.min(map.h - 1, Math.max(0, Math.round(v * map.h)))];
    }

    function sample(map, rad = 3) {
        const pt = toImage(map, af.x, af.y);
        if (!pt) return 0; // beside the portrait = the far background
        const [cx, cy] = pt;
        let s = 0, n = 0;
        for (let y = cy - rad; y <= cy + rad; y++)
            for (let x = cx - rad; x <= cx + rad; x++)
                if (x >= 0 && y >= 0 && x < map.w && y < map.h) {
                    s += map.data[y * map.w + x];
                    n++;
                }
        return n ? s / n : 0.5;
    }

    function spotMeter() {
        if (!lum || !evf) return;
        // Middle grey (~18% reflectance) sits around 0.46 in sRGB
        meter = Math.max(-3, Math.min(3, Math.log2(Math.max(0.01, sample(lum)) / 0.46)));
    }

    function onEvfMove(e) {
        const r = evf.getBoundingClientRect();
        af = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
        afLocked = false;
        spotMeter();
    }

    function onEvfClick(e) {
        onEvfMove(e); // focus where you clicked/tapped, not where the cursor last hovered
        afLocked = true;
        beep();
        if (mode === 'A+' && depthLum) focusDepth = sample(depthLum, 2);
    }

    // ----------------------------------------------------------- shutter, roll, sound
    let sound = $state(true);
    let flash = $state(false);
    let roll = $state([]);
    const ROLL_SIZE = 24;
    let audio;

    function ctx() {
        audio ??= new (window.AudioContext || window.webkitAudioContext)();
        return audio;
    }
    function beep() {
        if (!sound) return;
        const a = ctx();
        [0, 0.09].forEach((at) => {
            const o = a.createOscillator();
            const g = a.createGain();
            o.frequency.value = 2400;
            g.gain.setValueAtTime(0.04, a.currentTime + at);
            g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + 0.06);
            o.connect(g).connect(a.destination);
            o.start(a.currentTime + at);
            o.stop(a.currentTime + at + 0.07);
        });
    }
    function clack() {
        if (!sound) return;
        const a = ctx();
        // two short filtered noise bursts: mirror/shutter down… and up
        [0, 0.07].forEach((at, k) => {
            const len = Math.floor(a.sampleRate * 0.035);
            const buf = a.createBuffer(1, len, a.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
            const s = a.createBufferSource();
            const f = a.createBiquadFilter();
            const g = a.createGain();
            s.buffer = buf;
            f.type = 'bandpass';
            f.frequency.value = k ? 2600 : 1600;
            g.gain.value = 0.5;
            s.connect(f).connect(g).connect(a.destination);
            s.start(a.currentTime + at);
        });
    }

    async function shutter() {
        clack();
        flash = true;
        setTimeout(() => (flash = false), 110);
        if (mode === 'M') return gameShutter();
        if (roll.length >= ROLL_SIZE) return;
        const thumb = scene.kind === 'project' ? null : scene.src;
        roll.push({ key: `${mode}-${scene.id}-${roll.length}`, mode, i: mode === 'P' || mode === 'L' || mode === 'C' ? idx[mode] : 0, thumb, label: scene.kind === 'project' ? scene.title : scene.alt, art: scene.art, tint: scene.tint });
    }

    function step(d) {
        if (mode === 'A+') {
            apIdx = Math.max(0, Math.min(APERTURES.length - 1, apIdx + d));
            return;
        }
        if (mode === 'M') {
            if (game.revealed) gameShutter();
            return;
        }
        const len = mode === 'P' ? portraits.length : mode === 'L' ? landscapes.length : projects.length;
        idx[mode] = (idx[mode] + d + len) % len;
    }

    function jumpTo(shot) {
        mode = shot.mode;
        if (shot.mode in idx) idx[shot.mode] = shot.i;
    }

    // ----------------------------------------------------------- Manual mode game
    const ROUNDS = 5;
    let game = $state({ rounds: [], round: 0, guess: { f: 3, t: 14, iso: 0 }, revealed: false, result: null, scores: [], done: false });

    function newGame() {
        const pool = [...portraits, ...landscapes].filter((s) => s.exif);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        game = { rounds: pool.slice(0, ROUNDS), round: 0, guess: { f: 3, t: 14, iso: 0 }, revealed: false, result: null, scores: [], done: false };
    }

    function nudge(key, d) {
        if (game.revealed) return;
        const len = key === 'f' ? APERTURES.length : key === 't' ? SHUTTERS.length : ISOS.length;
        game.guess[key] = Math.max(0, Math.min(len - 1, game.guess[key] + d));
    }

    const thirds = (n) => {
        const whole = Math.floor(n / 3), rem = n % 3;
        return `${whole || (rem ? '' : '0')}${rem === 1 ? '⅓' : rem === 2 ? '⅔' : ''}`;
    };

    function gameShutter() {
        if (game.done) return newGame();
        if (!game.revealed) {
            const e = game.rounds[game.round].exif;
            const real = { f: nearest(APERTURES, e.f), t: nearest(SHUTTERS, e.shutter), iso: nearest(ISOS, e.iso) };
            const off = {
                f: Math.abs(real.f - game.guess.f),
                t: Math.abs(real.t - game.guess.t),
                iso: Math.abs(real.iso - game.guess.iso)
            };
            const total = off.f + off.t + off.iso; // in thirds of a stop
            const pts = Math.max(0, Math.round(10 - total / 3 * 1.5));
            game.result = { real, off, total, pts };
            game.scores.push(pts);
            game.revealed = true;
            return;
        }
        if (game.round + 1 >= ROUNDS) {
            game.done = true;
            return;
        }
        game.round += 1;
        game.revealed = false;
        game.result = null;
    }

    const finalScore = $derived(game.scores.reduce((a, b) => a + b, 0));
    const rank = $derived(
        finalScore >= 42 ? 'Basically a light meter' : finalScore >= 32 ? 'Wedding-photographer energy' : finalScore >= 20 ? 'Solid. Leave it in Av.' : 'Auto mode is valid'
    );

    // ----------------------------------------------------------- mode dial
    function setMode(id) {
        if (id === mode) return;
        mode = id;
        afLocked = false;
        if (id === 'M' && !game.rounds.length) newGame();
    }

    $effect(() => {
        // re-analyse whenever the image in the viewfinder changes
        const url = scene?.kind === 'project' ? null : scene?.src;
        analyse(url);
    });

    function onKey(e) {
        if (e.target.closest('input, textarea')) return;
        if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === ' ') {
            e.preventDefault();
            shutter();
        } else if (/^[1-5]$/.test(e.key)) setMode(MODES[+e.key - 1].id);
    }

    // swipe in the viewfinder on touch screens
    let touchX = null;

    onMount(() => {
        analyseDepth(portrait.depthSrc);
    });
</script>

<svelte:window onkeydown={onKey} />

<div class="camera">
    <!-- ================= EVF ================= -->
    <div class="evf-wrap">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
            class="evf"
            bind:this={evf}
            onpointermove={onEvfMove}
            onclick={onEvfClick}
            ontouchstart={(e) => (touchX = e.touches[0].clientX)}
            ontouchend={(e) => {
                if (touchX == null) return;
                const dx = e.changedTouches[0].clientX - touchX;
                if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
                touchX = null;
            }}
        >
            {#if mode === 'A+'}
                <DofPortrait src={portrait.src} depthSrc={portrait.depthSrc} bgSrc={portrait.bgSrc} alt={portrait.alt} {aperture} focus={focusDepth} />
            {:else if scene?.kind === 'project'}
                <div class="project" style:--tint={scene.tint}>
                    <span class="p-art" aria-hidden="true">{scene.art}</span>
                    <h3>{scene.title}</h3>
                    <p>{scene.text}</p>
                    <p class="p-stack">{scene.stack}</p>
                    {#if scene.href}<a href={scene.href} onclick={(e) => e.stopPropagation()}>Open it ↗</a>{/if}
                </div>
            {:else if scene}
                {#key scene.id}
                    <img class="shot" src={scene.src} alt={scene.alt} />
                {/key}
            {/if}

            <!-- overlays -->
            <div class="grid" aria-hidden="true"></div>
            <div class="af" class:locked={afLocked} style:left="{af.x}%" style:top="{af.y}%" aria-hidden="true"></div>

            <div class="hud top" aria-hidden="true">
                <span class="tag">{readout.tag}</span>
                <span>AF-S</span>
                <span>RAW</span>
                <span class="spacer"></span>
                {#if histo.length}
                    <svg class="histo" viewBox="0 0 64 24" preserveAspectRatio="none">
                        <path d={'M0 24 ' + histo.map((v, i) => `L${i} ${24 - v * 22}`).join(' ') + ' L63 24 Z'} />
                    </svg>
                {/if}
                <span class="batt"><i></i></span>
            </div>

            {#if mode === 'M' && game.rounds.length}
                <div class="m-overlay" aria-live="polite">
                    {#if game.done}
                        <p class="big">{finalScore}<small>/50</small></p>
                        <p>{rank}</p>
                        <p class="dim">Press the shutter to play again</p>
                    {:else if game.revealed && game.result}
                        <p class="dim">Round {game.round + 1}/{ROUNDS} · real settings</p>
                        <p class="real">
                            F{APERTURES[game.result.real.f]} · {SHUTTERS[game.result.real.t]} · ISO {ISOS[game.result.real.iso]}
                        </p>
                        <p>
                            {game.result.total === 0 ? 'Nailed it.' : `${thirds(game.result.total)} stops off`} · +{game.result.pts}
                        </p>
                        <p class="dim">Shutter for next round</p>
                    {:else}
                        <p class="dim">Round {game.round + 1}/{ROUNDS} — set the dials, then shoot to lock in your guess</p>
                    {/if}
                </div>
            {/if}

            <div class="hud bottom" aria-hidden="true">
                <span>{readout.t}</span>
                <span>{readout.f}</span>
                <span class="scale">
                    <b>-3..2..1..</b><b class="zero">0</b><b>..1..2..+3</b>
                    <i style:left="{50 + meter * 15.5}%"></i>
                </span>
                <span>{readout.iso}</span>
                <span class="shots">[{ROLL_SIZE - roll.length}]</span>
            </div>

            <div class="blackout" class:on={flash} aria-hidden="true"></div>
        </div>

        <div class="lcd">
            <p class="caption">
                {#if mode === 'M'}
                    {game.done ? 'Game over — nice shooting.' : 'Guess the real exposure of this photo.'}
                {:else if scene?.kind === 'project'}
                    {scene.title} — {scene.stack}
                {:else}
                    {scene?.caption ?? ''}
                {/if}
            </p>
            <p class="hint">
                Move = spot meter · Click = focus · Space = shutter · ←/→ = next
            </p>
        </div>

        <div class="roll" aria-label="Your roll">
            <span class="roll-label">Your roll {roll.length}/{ROLL_SIZE}</span>
            {#each roll as shot (shot.key)}
                <button class="frame" onclick={() => jumpTo(shot)} title={shot.label} aria-label="Go to {shot.label}">
                    {#if shot.thumb}<img src={shot.thumb} alt="" />{:else}<span style:background={shot.tint}>{shot.art}</span>{/if}
                </button>
            {/each}
            {#if !roll.length}<span class="empty">press the shutter to start a roll</span>{/if}
        </div>
    </div>

    <!-- ================= TOP PLATE ================= -->
    <div class="plate">
        <div class="dial-area">
            <div class="dial" style:transform="rotate({-modeIndex * 72}deg)">
                {#each MODES as m, i}
                    <button
                        class="dial-label"
                        class:on={m.id === mode}
                        style:transform="rotate({i * 72}deg) translateY(-62px) rotate({0}deg)"
                        onclick={() => setMode(m.id)}
                        aria-pressed={m.id === mode}
                        aria-label="{m.name} mode"
                    >{m.id}</button>
                {/each}
                <span class="knurl" aria-hidden="true"></span>
            </div>
            <span class="index" aria-hidden="true">▼</span>
        </div>
        <p class="mode-name">{MODES[modeIndex].name}</p>
        <p class="mode-blurb">{MODES[modeIndex].blurb}</p>

        <button class="shutter-btn" onclick={shutter} aria-label="Shutter">
            <span></span>
        </button>

        {#if mode === 'A+'}
            <label class="wheel">
                <span>Aperture</span>
                <input type="range" min="0" max={APERTURES.length - 1} bind:value={apIdx} aria-label="Aperture" />
                <b>f/{aperture}</b>
            </label>
            <p class="tip">Wide open = blurry background. Click the background in the viewfinder to focus there instead.</p>
        {:else if mode === 'M'}
            <div class="steppers">
                {#each [['f', 'Aperture', (i) => `f/${APERTURES[i]}`], ['t', 'Shutter', (i) => SHUTTERS[i]], ['iso', 'ISO', (i) => ISOS[i]]] as [key, label, fmt]}
                    <div class="stepper">
                        <span>{label}</span>
                        <button onclick={() => nudge(key, -1)} aria-label="Lower {label}" disabled={game.revealed}>−</button>
                        <b>{fmt(game.guess[key])}</b>
                        <button onclick={() => nudge(key, 1)} aria-label="Raise {label}" disabled={game.revealed}>+</button>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="nav">
                <button onclick={() => step(-1)} aria-label="Previous">‹</button>
                <span>
                    {mode === 'P' ? idx.P + 1 : mode === 'L' ? idx.L + 1 : idx.C + 1}/{mode === 'P' ? portraits.length : mode === 'L' ? landscapes.length : projects.length}
                </span>
                <button onclick={() => step(1)} aria-label="Next">›</button>
            </div>
        {/if}

        <div class="plate-foot">
            <button class="sound" onclick={() => (sound = !sound)} aria-pressed={sound}>{sound ? '🔊 sound' : '🔇 muted'}</button>
            <a href="mailto:jason.wride@utah.edu">jason.wride@utah.edu</a>
        </div>
    </div>
</div>

<style>
    .camera {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 290px;
        gap: 1.4rem;
        max-width: 1320px;
        margin: 0 auto;
        padding: 3.5rem 1.4rem 2rem;
        color: #e9e7e3;
        font-family: 'Chakra Petch', system-ui, sans-serif;
    }

    /* ---------- EVF ---------- */
    .evf-wrap { min-width: 0; }
    .evf {
        position: relative;
        aspect-ratio: 3 / 2;
        background: #000;
        border-radius: 18px;
        overflow: hidden;
        cursor: none;
        box-shadow: 0 0 0 10px #0c0c0d, 0 0 0 12px #2a2a2c, 0 30px 60px rgba(0, 0, 0, 0.6);
        touch-action: pan-y;
        user-select: none;
    }
    .shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: fadein 0.35s ease; }
    @keyframes fadein { from { opacity: 0; } }

    .grid {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
            linear-gradient(90deg, transparent calc(33.33% - 0.5px), rgba(255, 255, 255, 0.28) calc(33.33% - 0.5px), rgba(255, 255, 255, 0.28) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255, 255, 255, 0.28) calc(66.66% - 0.5px), rgba(255, 255, 255, 0.28) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)),
            linear-gradient(transparent calc(33.33% - 0.5px), rgba(255, 255, 255, 0.28) calc(33.33% - 0.5px), rgba(255, 255, 255, 0.28) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255, 255, 255, 0.28) calc(66.66% - 0.5px), rgba(255, 255, 255, 0.28) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px));
    }

    .af {
        position: absolute;
        width: 64px;
        height: 64px;
        margin: -32px 0 0 -32px;
        pointer-events: none;
        background:
            linear-gradient(#fff, #fff) top left / 14px 2px no-repeat,
            linear-gradient(#fff, #fff) top left / 2px 14px no-repeat,
            linear-gradient(#fff, #fff) top right / 14px 2px no-repeat,
            linear-gradient(#fff, #fff) top right / 2px 14px no-repeat,
            linear-gradient(#fff, #fff) bottom left / 14px 2px no-repeat,
            linear-gradient(#fff, #fff) bottom left / 2px 14px no-repeat,
            linear-gradient(#fff, #fff) bottom right / 14px 2px no-repeat,
            linear-gradient(#fff, #fff) bottom right / 2px 14px no-repeat;
        filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.8));
        transition: transform 0.15s;
    }
    .af.locked {
        transform: scale(0.82);
        background:
            linear-gradient(#3dff6e, #3dff6e) top left / 14px 2px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) top left / 2px 14px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) top right / 14px 2px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) top right / 2px 14px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) bottom left / 14px 2px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) bottom left / 2px 14px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) bottom right / 14px 2px no-repeat,
            linear-gradient(#3dff6e, #3dff6e) bottom right / 2px 14px no-repeat;
    }

    .hud {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        gap: 1.1rem;
        padding: 0.7rem 1rem;
        font: 500 clamp(0.7rem, 1.4vw, 0.95rem) 'IBM Plex Mono', monospace;
        color: #fff;
        text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
        pointer-events: none;
    }
    .hud > span { white-space: nowrap; }
    .hud.top { top: 0; background: linear-gradient(rgba(0, 0, 0, 0.45), transparent); }
    .hud.bottom { bottom: 0; justify-content: center; background: linear-gradient(transparent, rgba(0, 0, 0, 0.55)); }
    .tag { border: 1.5px solid #fff; padding: 0 0.35rem; border-radius: 3px; }
    .spacer { flex: 1; }
    .histo { width: 96px; height: 34px; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.5); }
    .histo path { fill: rgba(255, 255, 255, 0.85); }
    .batt { width: 26px; height: 12px; border: 1.5px solid #fff; border-radius: 2px; position: relative; }
    .batt i { position: absolute; inset: 1.5px; right: 6px; background: #fff; }
    .batt::after { content: ''; position: absolute; right: -4px; top: 3px; width: 2px; height: 4px; background: #fff; }

    .scale { position: relative; display: inline-flex; letter-spacing: -0.04em; font-size: 0.85em; }
    .scale b { font-weight: 500; }
    .scale .zero { padding: 0 0.1em; }
    .scale i {
        position: absolute;
        bottom: -7px;
        width: 4px;
        height: 4px;
        margin-left: -2px;
        background: #fff;
        transition: left 0.12s;
    }
    .shots { opacity: 0.9; }

    .blackout { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity 0.12s; }
    .blackout.on { opacity: 1; transition: none; }

    .m-overlay {
        position: absolute;
        left: 50%;
        top: 14%;
        transform: translateX(-50%);
        text-align: center;
        padding: 0.8rem 1.2rem;
        background: rgba(0, 0, 0, 0.62);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        font-family: 'IBM Plex Mono', monospace;
        max-width: 90%;
        pointer-events: none;
    }
    .m-overlay .real { font-size: 1.2rem; color: #ffd84a; margin: 0.3rem 0; }
    .m-overlay .big { font-size: 3rem; line-height: 1; }
    .m-overlay small { font-size: 1rem; opacity: 0.7; }
    .dim { opacity: 0.7; font-size: 0.8rem; }

    .project {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 8% 10%;
        background: radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--tint) 80%, #fff 0%), #0b0b0c 75%);
    }
    .p-art { font-size: clamp(2.5rem, 7vw, 5rem); }
    .project h3 { font: 700 clamp(1.8rem, 4.5vw, 3.4rem)/1 'Chakra Petch', sans-serif; }
    .project p { max-width: 46ch; line-height: 1.5; opacity: 0.9; }
    .p-stack { font: 0.85rem 'IBM Plex Mono', monospace; opacity: 0.7 !important; }
    .project a { color: #fff; border: 1.5px solid #fff; padding: 0.35rem 0.9rem; border-radius: 999px; text-decoration: none; cursor: pointer; }

    .lcd { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 1.4rem; }
    .caption { font-size: 1rem; }
    .hint { font: 0.75rem 'IBM Plex Mono', monospace; opacity: 0.5; }
    @media (hover: none) { .hint { display: none; } }
    @media (max-width: 520px) { .hud { gap: 0.6rem; padding: 0.5rem 0.6rem; } .scale { display: none; } }

    .roll {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 1rem;
        padding: 8px 10px;
        background: #121213;
        border-radius: 8px;
        overflow-x: auto;
        min-height: 56px;
    }
    .roll-label { font: 0.72rem 'IBM Plex Mono', monospace; color: #ff9b3d; white-space: nowrap; margin-right: 4px; }
    .frame { flex: none; width: 54px; height: 36px; border: 0; padding: 0; border-radius: 2px; overflow: hidden; cursor: pointer; animation: fadein 0.3s; }
    .frame img { width: 100%; height: 100%; object-fit: cover; }
    .frame span { display: grid; place-items: center; width: 100%; height: 100%; }
    .empty { font: 0.75rem 'IBM Plex Mono', monospace; opacity: 0.4; }

    /* ---------- top plate ---------- */
    .plate {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
        padding: 1.6rem 1.2rem;
        border-radius: 22px;
        background:
            radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 1.5px) 0 0 / 5px 5px,
            linear-gradient(160deg, #2a2a2d, #161618);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 40px rgba(0, 0, 0, 0.5);
        align-self: start;
    }

    .dial-area { position: relative; width: 170px; height: 170px; margin-top: 0.4rem; }
    .dial {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: repeating-conic-gradient(#2e2e31 0 3deg, #1b1b1d 3deg 6deg);
        box-shadow: inset 0 0 0 18px #222225, inset 0 2px 0 18px rgba(255, 255, 255, 0.05), 0 6px 14px rgba(0, 0, 0, 0.6);
        transition: transform 0.45s cubic-bezier(0.3, 1.5, 0.5, 1);
    }
    .dial-label {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 40px;
        height: 30px;
        margin: -15px 0 0 -20px;
        border: 0;
        background: none;
        color: #cfcac2;
        font: 700 1rem 'Chakra Petch', sans-serif;
        cursor: pointer;
        transform-origin: 50% 50%;
    }
    .dial-label.on { color: #fff; text-shadow: 0 0 8px rgba(255, 255, 255, 0.5); }
    .dial-label:hover { color: #ff6b3d; }
    .knurl { position: absolute; inset: 52px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #3a3a3e, #19191b); }
    .index { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); color: #ff4a3d; font-size: 0.8rem; }

    .mode-name { font-size: 1.3rem; font-weight: 700; letter-spacing: 0.04em; }
    .mode-blurb { font-size: 0.85rem; opacity: 0.7; text-align: center; min-height: 2.4em; }

    .shutter-btn {
        width: 74px;
        height: 74px;
        border-radius: 50%;
        border: 0;
        background: radial-gradient(circle at 40% 35%, #4a4a4f, #1c1c1e);
        box-shadow: 0 0 0 6px #111, 0 0 0 8px #3a3a3d, 0 8px 16px rgba(0, 0, 0, 0.6);
        cursor: pointer;
        display: grid;
        place-items: center;
        margin: 0.6rem 0;
    }
    .shutter-btn span { width: 46px; height: 46px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #d9d6d0, #8f8b84); transition: transform 0.08s; }
    .shutter-btn:active span { transform: scale(0.88); }

    .wheel { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem; width: 100%; font-size: 0.85rem; }
    .wheel input { accent-color: #ff4a3d; }
    .wheel b { font-family: 'IBM Plex Mono', monospace; min-width: 3.5em; text-align: right; }
    .tip { font-size: 0.78rem; opacity: 0.6; text-align: center; }

    .steppers { display: grid; gap: 0.45rem; width: 100%; }
    .stepper { display: grid; grid-template-columns: 5em 2rem 1fr 2rem; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
    .stepper b { text-align: center; font-family: 'IBM Plex Mono', monospace; }
    .stepper button,
    .nav button {
        height: 2rem;
        border-radius: 8px;
        border: 1px solid #444;
        background: #232326;
        color: #fff;
        font: 700 1rem 'Chakra Petch', sans-serif;
        cursor: pointer;
    }
    .stepper button:disabled { opacity: 0.3; }
    .nav { display: grid; grid-template-columns: 3rem auto 3rem; align-items: center; gap: 1rem; font-family: 'IBM Plex Mono', monospace; }

    .plate-foot { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; margin-top: 0.6rem; font-size: 0.8rem; }
    .sound { background: none; border: 1px solid #444; color: #ccc; border-radius: 999px; padding: 0.25rem 0.8rem; font: inherit; cursor: pointer; }
    .plate-foot a { color: #ff9b3d; }

    @media (max-width: 900px) {
        .camera { grid-template-columns: 1fr; padding-top: 3.2rem; }
        .evf { cursor: crosshair; }
        .plate { display: grid; grid-template-columns: auto 1fr; align-items: center; justify-items: start; }
        .dial-area { grid-row: span 3; }
        .shutter-btn { grid-column: 2; }
        .wheel, .steppers, .nav, .tip, .plate-foot { grid-column: 1 / -1; justify-self: stretch; }
        .mode-blurb { text-align: left; }
    }
</style>
