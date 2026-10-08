<script>
    import { onMount } from 'svelte';
    import { localMidnight, dayEvents, fmtMinutes, sunElevation, phaseFor } from '../../lib/sun';

    /**
     * @type {{
     *   photos: { id: string, src: string, alt: string, caption: string }[],
     *   landscapes: { id: string, src: string, alt: string, caption: string }[],
     *   portrait: string,
     *   concepts: { id: string, label: string, thesis: string }[]
     * }}
     */
    let { photos = [], landscapes = [], portrait, concepts = [] } = $props();

    // ------------------------------------------------------------ floors (top → bottom)
    const FLOORS = [
        { key: 'R', name: 'Roof', note: 'The view' },
        { key: '4', name: 'Office', note: 'Hiring' },
        { key: '3', name: 'Workshop', note: 'Code' },
        { key: '2', name: 'Studio', note: 'Photos' },
        { key: '1', name: 'Lobby', note: 'Start here' },
        { key: 'B', name: 'Darkroom', note: 'Old designs' }
    ];
    const LOBBY = 4;
    let at = $state(LOBBY); // floor the car is at / passing
    let shown = $state(LOBBY); // floor whose interior is visible
    let doors = $state('open'); // 'open' | 'closing' | 'closed' | 'opening'
    let dir = $state(0); // -1 up, 1 down (index direction)
    let calls = $state(new Set());
    let moving = false;
    let toast = $state('');

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    async function ride(to) {
        if (moving || to === shown) return;
        moving = true;
        calls = new Set([...calls, to]);
        doors = 'closing';
        await wait(reduce() ? 50 : 650);
        doors = 'closed';
        dir = to < at ? -1 : 1;
        while (at !== to) {
            await wait(reduce() ? 60 : 520);
            at += dir;
        }
        dir = 0;
        shown = to;
        ding();
        await wait(reduce() ? 50 : 250);
        doors = 'opening';
        await wait(reduce() ? 50 : 650);
        doors = 'open';
        calls.delete(to);
        calls = new Set(calls);
        moving = false;
    }

    // Needle indicator: sweeps across a half-dial, one tick per floor
    const needle = $derived(-70 + ((FLOORS.length - 1 - at) / (FLOORS.length - 1)) * 140);

    // ------------------------------------------------------------ sound
    let audio;
    const ac = () => (audio ??= new (window.AudioContext || window.webkitAudioContext)());
    function tone(freq, start, dur, vol = 0.12, type = 'sine') {
        const a = ac();
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, a.currentTime + start);
        g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
        o.connect(g).connect(a.destination);
        o.start(a.currentTime + start);
        o.stop(a.currentTime + start + dur + 0.05);
    }
    let soundOn = $state(true);
    function ding() {
        if (!soundOn) return;
        tone(1318.5, 0, 1.4, 0.1);
        tone(1046.5, 0.22, 1.8, 0.1);
    }
    function alarm() {
        if (soundOn) for (let k = 0; k < 6; k++) tone(980, k * 0.12, 0.09, 0.08, 'square');
        say('Please remain calm. Jason has been notified. (He hasn’t. Email him.)');
    }
    function say(msg) {
        toast = msg;
        setTimeout(() => toast === msg && (toast = ''), 3200);
    }

    // Elevator music: a gentle I–vi–IV–V arpeggio, generated live
    let muzak = $state(false);
    let muzakTimer;
    const CHORDS = [
        [261.6, 329.6, 392.0, 493.9],
        [220.0, 261.6, 329.6, 392.0],
        [174.6, 220.0, 261.6, 329.6],
        [196.0, 246.9, 293.7, 349.2]
    ];
    function toggleMuzak() {
        muzak = !muzak;
        clearInterval(muzakTimer);
        if (!muzak) return;
        let bar = 0;
        const play = () => {
            const c = CHORDS[bar++ % CHORDS.length];
            c.forEach((f, k) => tone(f, k * 0.28, 1.1, 0.035, 'triangle'));
            tone(c[0] / 2, 0, 1.9, 0.04, 'sine');
        };
        play();
        muzakTimer = setInterval(play, 1150);
    }

    // ------------------------------------------------------------ floor details
    // Lobby: felt letter board
    const BOARD = ['WELCOME TO', 'JASONWRIDE.STUDIO', '', 'ROOF ......... R', 'HIRING ....... 4', 'CODE ......... 3', 'PHOTOS ....... 2', 'OLD DESIGNS .. B'];

    // Studio: easel + softbox + golden hour planner
    let print = $state(0);
    let light = $state({ x: 30, y: 30 });
    let planDate = $state('');
    const plan = $derived.by(() => {
        if (!planDate) return null;
        const [y, m, d] = planDate.split('-').map(Number);
        const mid = localMidnight(new Date(Date.UTC(y, m - 1, d, 18)));
        return dayEvents(mid);
    });

    // Workshop: project crates
    const PROJECTS = [
        { key: 'tree', label: 'TREE OF LIFE', icon: '🌳', text: 'Interactive radial tree of convergent evolution. Pick a trait, watch unrelated lineages light up.', stack: 'Svelte · Canvas 2D · Python', href: '/tree-of-life' },
        { key: 'rag', label: 'LOCAL RAG', icon: '💬', text: 'macOS/iOS app: a local language model over your iMessage history. Fully offline.', stack: 'SwiftUI · Ollama · Vector DB' },
        { key: 'site', label: 'THIS BUILDING', icon: '🏢', text: 'The site you’re standing in. Astro + Svelte; the ding is synthesized live.', stack: 'Astro · Svelte · Web Audio', href: 'https://github.com/twitterspree/jasonwride-studio' }
    ];
    let openCrate = $state(null);

    // Office: desk lamp
    let lamp = $state(true);

    // Roof: live sky
    let sky = $state({ phase: 'day', el: 30, sunset: null });
    let roofPic = $state(0);

    // Darkroom: pull-chain light
    let safelight = $state(true);

    onMount(() => {
        const now = new Date();
        const mid = localMidnight(now);
        const el = sunElevation(now);
        sky = { phase: phaseFor(el), el, sunset: dayEvents(mid).sunset };
        planDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
        return () => clearInterval(muzakTimer);
    });

    const SKY = {
        night: ['#070b18', '#1b2340'],
        blue: ['#1d2f5c', '#7a6fa3'],
        golden: ['#7f9cc9', '#ffb870'],
        day: ['#5f9bd8', '#cfe3fb']
    };

    function onKey(e) {
        if (e.target.closest('input')) return;
        if (e.key === 'ArrowUp') ride(Math.max(0, shown - 1));
        else if (e.key === 'ArrowDown') ride(Math.min(FLOORS.length - 1, shown + 1));
    }
</script>

<svelte:window onkeydown={onKey} />

<div class="building">
    <!-- ================= SHAFT / CAR ================= -->
    <div class="car">
        <div class="header-plate">
            <div class="dial" aria-hidden="true">
                <svg viewBox="-100 -100 200 110">
                    <path d="M -86 0 A 86 86 0 0 1 86 0" class="arc" />
                    {#each FLOORS as f, k}
                        {@const a = ((-70 + ((FLOORS.length - 1 - k) / (FLOORS.length - 1)) * 140) - 90) * (Math.PI / 180)}
                        <text x={Math.cos(a) * 70} y={Math.sin(a) * 70 + 5} text-anchor="middle" class:lit={k === at}>{f.key}</text>
                    {/each}
                    <line x1="0" y1="0" x2="0" y2="-78" class="needle" style:transform="rotate({needle}deg)" />
                    <circle r="7" class="hub" />
                </svg>
            </div>
            <p class="floor-name" aria-live="polite">
                {#if dir !== 0}<span class="arrow">{dir < 0 ? '▲' : '▼'}</span>{/if}
                {FLOORS[at].key} — {FLOORS[at].name}
            </p>
        </div>

        <div class="doorway">
            <div class="interior f-{FLOORS[shown].key}" class:dark={FLOORS[shown].key === 'B' && safelight} class:lampoff={FLOORS[shown].key === '4' && !lamp}>
                {#if FLOORS[shown].key === '1'}
                    <!-- LOBBY -->
                    <div class="lobby">
                        <div class="letterboard" aria-label={BOARD.join(' ')}>
                            {#each BOARD as line, li}
                                <p>
                                    {#each [...line] as ch, ci}
                                        <span style:--d="{(li * 7 + ci) % 11}">{ch === ' ' ? ' ' : ch}</span>
                                    {/each}
                                </p>
                            {/each}
                        </div>
                        <div class="desk">
                            <img class="host" src={portrait} alt="Jason Wride, your host" />
                            <p class="welcome">Jason Wride — photographer & developer. Information Systems at the University of Utah.</p>
                            <button class="bell" onclick={() => { ding(); say('Ding! Jason will be right with you. (Or email: jason.wride@utah.edu)'); }} aria-label="Ring the front desk bell">🛎️</button>
                            <p class="small">Use the elevator panel → or ↑/↓ keys.</p>
                        </div>
                    </div>
                {:else if FLOORS[shown].key === '2'}
                    <!-- STUDIO -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="studio"
                        onpointermove={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            light = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
                        }}
                        style:--lx="{light.x}%"
                        style:--ly="{light.y}%"
                    >
                        <div class="sweep" aria-hidden="true"></div>
                        <div class="softbox" aria-hidden="true"></div>
                        <figure class="easel">
                            <img src={photos[print].src} alt={photos[print].alt} />
                            <figcaption>{photos[print].caption}</figcaption>
                            <div class="easel-nav">
                                <button onclick={() => (print = (print - 1 + photos.length) % photos.length)} aria-label="Previous print">‹</button>
                                <span>{print + 1}/{photos.length}</span>
                                <button onclick={() => (print = (print + 1) % photos.length)} aria-label="Next print">›</button>
                            </div>
                        </figure>
                        <aside class="booking">
                            <h3>Book a session</h3>
                            <p>Seniors · couples · dances. Usually in the late afternoon.</p>
                            <label>
                                Pick a date
                                <input type="date" bind:value={planDate} />
                            </label>
                            {#if plan}
                                <p class="plan">Golden hour in Santaquin: <b>{fmtMinutes(plan.goldenEveningStart)}</b> → sunset <b>{fmtMinutes(plan.sunset)}</b></p>
                            {/if}
                            <a class="btn" href="mailto:jason.wride@utah.edu?subject=Photo%20session">Inquire</a>
                            <p class="small">Move your cursor — the softbox follows.</p>
                        </aside>
                    </div>
                {:else if FLOORS[shown].key === '3'}
                    <!-- WORKSHOP -->
                    <div class="workshop">
                        <div class="pegboard">
                            <p class="stencil">WORKSHOP</p>
                            <ul class="tools" aria-label="Tools">
                                {#each ['TypeScript', 'Svelte', 'Astro', 'Swift/SwiftUI', 'Python', 'WebGL', 'Canvas', 'Lightroom'] as tool, k}
                                    <li style:--r="{(k % 3) - 1}">{tool}</li>
                                {/each}
                            </ul>
                        </div>
                        <div class="bench">
                            {#each PROJECTS as p}
                                <button class="crate" class:open={openCrate === p.key} onclick={() => (openCrate = openCrate === p.key ? null : p.key)} aria-expanded={openCrate === p.key}>
                                    <span class="flap l" aria-hidden="true"></span>
                                    <span class="flap r" aria-hidden="true"></span>
                                    <span class="crate-label">{p.label}</span>
                                    <span class="crate-icon" aria-hidden="true">{p.icon}</span>
                                </button>
                            {/each}
                        </div>
                        {#if openCrate}
                            {@const p = PROJECTS.find((x) => x.key === openCrate)}
                            <div class="unboxed">
                                <h3>{p.icon} {p.label.toLowerCase()}</h3>
                                <p>{p.text}</p>
                                <p class="small">{p.stack}</p>
                                {#if p.href}<a class="btn" href={p.href}>Open →</a>{/if}
                            </div>
                        {:else}
                            <p class="small center">Click a crate to unpack it.</p>
                        {/if}
                    </div>
                {:else if FLOORS[shown].key === '4'}
                    <!-- OFFICE -->
                    <div class="office">
                        <button class="lamp" onclick={() => (lamp = !lamp)} aria-pressed={lamp} aria-label="Desk lamp">💡</button>
                        <div class="paper">
                            <p class="small">Office of</p>
                            <h3>Jason Wride</h3>
                            <p>Information Systems · University of Utah</p>
                            <hr />
                            <h4>What I do</h4>
                            <ul>
                                <li>Build interactive front-ends (Svelte, Astro, TypeScript, WebGL)</li>
                                <li>Native apps with SwiftUI; local-first AI with Ollama</li>
                                <li>Data → visuals: the Tree of Life, this site’s exposure stats</li>
                                <li>Portrait & landscape photography</li>
                            </ul>
                            <h4>Selected work</h4>
                            <ul>
                                <li><a href="/tree-of-life">Tree of Life</a> — convergent evolution, visualized</li>
                                <li>Local RAG assistant — private iMessage search, offline</li>
                                <li>jasonwride.studio — you’re in it</li>
                            </ul>
                            <a class="btn" href="mailto:jason.wride@utah.edu?subject=Hello%20from%20your%20office">Request a résumé</a>
                        </div>
                        <div class="mug" aria-hidden="true">☕<span class="steam"></span></div>
                    </div>
                {:else if FLOORS[shown].key === 'R'}
                    <!-- ROOF -->
                    <div class="roof" style:--top={SKY[sky.phase][0]} style:--bot={SKY[sky.phase][1]}>
                        <div class="stars" class:on={sky.phase === 'night' || sky.phase === 'blue'} aria-hidden="true"></div>
                        <div class="roof-text">
                            <h3>The view from the roof</h3>
                            <p>It’s {sky.phase === 'golden' ? 'golden hour' : sky.phase === 'blue' ? 'blue hour' : sky.phase === 'night' ? 'night' : 'daytime'} in Santaquin right now — the sky up here is the real one. Sunset today: {fmtMinutes(sky.sunset)}.</p>
                        </div>
                        <figure class="telescope">
                            <img src={landscapes[roofPic].src} alt={landscapes[roofPic].alt} />
                            <figcaption>{landscapes[roofPic].caption}</figcaption>
                        </figure>
                        <button class="scope-btn" onclick={() => (roofPic = (roofPic + 1) % landscapes.length)}>🔭 Look somewhere else</button>
                        <svg class="ridge" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
                            <path d="M0 120 L0 70 L90 52 L160 64 L240 30 L300 44 L360 22 L430 48 L520 36 L600 58 L680 40 L760 60 L850 34 L930 50 L1010 28 L1090 54 L1200 46 L1200 120 Z" />
                        </svg>
                    </div>
                {:else}
                    <!-- DARKROOM / STORAGE -->
                    <div class="darkroom">
                        <button class="chain" onclick={() => (safelight = !safelight)} aria-pressed={!safelight}>
                            <span aria-hidden="true">⛓</span> pull for {safelight ? 'white light' : 'safelight'}
                        </button>
                        <h3>Storage: old designs</h3>
                        <p class="small">Every earlier concept for this site, boxed up down here.</p>
                        <div class="shelf">
                            {#each concepts as c}
                                <a class="box" href={`/concepts/${c.id}`}>
                                    <b>{c.label}</b>
                                    <span>{c.thesis}</span>
                                </a>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <div class="door left {doors}" aria-hidden="true"></div>
            <div class="door right {doors}" aria-hidden="true"></div>
        </div>
    </div>

    <!-- ================= PANEL ================= -->
    <div class="panel" aria-label="Elevator panel">
        <p class="plate-title">jasonwride.studio</p>
        <div class="buttons">
            {#each FLOORS as f, k}
                <button class="call" class:lit={calls.has(k) || (k === shown && doors === 'open')} onclick={() => ride(k)} aria-label="Go to {f.name}" aria-current={k === shown ? 'location' : undefined}>
                    <span class="key">{f.key}</span>
                    <span class="label">{f.name}<small>{f.note}</small></span>
                </button>
            {/each}
        </div>
        <div class="row">
            <button class="mini" onclick={alarm} aria-label="Alarm">🔔</button>
            <button class="mini" class:on={muzak} onclick={toggleMuzak} aria-pressed={muzak}>♫ {muzak ? 'muzak on' : 'muzak'}</button>
            <button class="mini" onclick={() => (soundOn = !soundOn)} aria-pressed={soundOn}>{soundOn ? '🔊' : '🔇'}</button>
        </div>
        <p class="cert">Inspection certificate on file with the building manager: <a href="mailto:jason.wride@utah.edu">jason.wride@utah.edu</a></p>
    </div>

    {#if toast}<p class="toast" role="status">{toast}</p>{/if}
</div>

<style>
    .building {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 250px;
        gap: 1.4rem;
        max-width: 1300px;
        margin: 0 auto;
        padding: 3.6rem 1.4rem 2rem;
        font-family: 'Josefin Sans', system-ui, sans-serif;
        color: #f1ece2;
    }

    /* ---------- car ---------- */
    .car {
        background: linear-gradient(#b8933f, #8a6a26);
        padding: 14px;
        border-radius: 8px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 30px 60px rgba(0, 0, 0, 0.5);
    }
    .header-plate {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.6rem 0 0.8rem;
        background: linear-gradient(#2a2620, #1a1713);
        border-radius: 6px 6px 0 0;
    }
    .dial { width: 220px; }
    .dial svg { width: 100%; display: block; overflow: visible; }
    .arc { fill: none; stroke: #d9b45e; stroke-width: 2; }
    .dial text { fill: #8c7a55; font: 700 15px 'Josefin Sans', sans-serif; transition: fill 0.3s; }
    .dial text.lit { fill: #ffd27a; filter: drop-shadow(0 0 4px #ffb547); }
    .needle { stroke: #ff6a3d; stroke-width: 3; stroke-linecap: round; transform-origin: 0 0; transition: transform 0.5s cubic-bezier(0.4, 1.6, 0.5, 1); }
    .hub { fill: #d9b45e; }
    .floor-name { font: 600 1rem 'Josefin Sans', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: #ffd27a; text-shadow: 0 0 8px rgba(255, 181, 71, 0.5); }
    .arrow { animation: blink 0.6s infinite alternate; margin-right: 0.3rem; }
    @keyframes blink { to { opacity: 0.3; } }

    .doorway { position: relative; height: min(70vh, 640px); min-height: 460px; overflow: hidden; background: #111; border: 6px solid #6e5420; }
    .door {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 50%;
        z-index: 10;
        background:
            repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 4px),
            linear-gradient(90deg, #8d939a, #c7ccd2 40%, #9aa0a7);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
        transition: transform 0.65s cubic-bezier(0.6, 0, 0.3, 1);
    }
    .door.left { left: 0; border-right: 1px solid #555; }
    .door.right { right: 0; border-left: 1px solid #555; }
    .door.open.left, .door.opening.left { transform: translateX(-100%); }
    .door.open.right, .door.opening.right { transform: translateX(100%); }
    .door.closing, .door.closed { transform: translateX(0); }

    .interior { position: absolute; inset: 0; overflow-y: auto; }

    /* ---------- lobby ---------- */
    .f-1 {
        background:
            radial-gradient(ellipse at 50% 120%, rgba(255, 220, 160, 0.25), transparent 60%),
            linear-gradient(115deg, #e9e4da, #d6cfc2 45%, #ebe6dc 55%, #cfc7b9);
        color: #2a241a;
    }
    .lobby { display: grid; grid-template-columns: 1.3fr 1fr; gap: 2rem; align-items: center; height: 100%; padding: 2rem; }
    .letterboard {
        background: repeating-linear-gradient(#141414 0 6px, #0b0b0b 6px 8px);
        border: 12px solid #5a3d22;
        border-radius: 4px;
        padding: 1.2rem 1.4rem;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.35);
        font: 600 clamp(0.85rem, 1.6vw, 1.15rem)/1.6 'Josefin Sans', sans-serif;
        letter-spacing: 0.08em;
        color: #f5f2ea;
    }
    .letterboard p { white-space: nowrap; min-height: 1.6em; }
    .letterboard span { display: inline-block; transform: rotate(calc((var(--d) - 5) * 0.5deg)); transition: transform 0.25s cubic-bezier(0.3, 1.8, 0.5, 1); }
    .letterboard span:hover { transform: translateY(-4px) rotate(calc((var(--d) - 5) * 3deg)); }
    .desk { text-align: center; }
    .host { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; object-position: 50% 22%; border: 5px solid #b8933f; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25); margin: 0 auto 0.8rem; }
    .welcome { font-size: 1.15rem; line-height: 1.5; margin-bottom: 1rem; }
    .bell { font-size: 3rem; background: none; border: 0; cursor: pointer; transition: transform 0.15s; }
    .bell:active { transform: scale(0.85) translateY(4px); }

    /* ---------- studio ---------- */
    .f-2 { background: #cfcfcd; color: #1d1d1d; }
    .studio { position: relative; display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.5rem; align-items: center; min-height: 100%; padding: 1.6rem; }
    .sweep { position: absolute; inset: 0; background: linear-gradient(#bdbdbb, #e6e6e4 70%, #d3d3d1); }
    .softbox { position: absolute; inset: 0; background: radial-gradient(circle at var(--lx) var(--ly), rgba(255, 252, 240, 0.85), transparent 40%); mix-blend-mode: soft-light; pointer-events: none; }
    .easel { position: relative; background: #fff; padding: 12px 12px 8px; box-shadow: 0 18px 36px rgba(0, 0, 0, 0.3); transform: rotate(-1deg); }
    .easel img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; }
    .easel figcaption { font-size: 0.8rem; margin-top: 0.4rem; opacity: 0.75; }
    .easel-nav { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 0.3rem; }
    .easel-nav button { border: 0; background: none; font-size: 1.6rem; cursor: pointer; color: #1d1d1d; }
    .booking { position: relative; background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(6px); padding: 1.2rem; border-radius: 6px; display: flex; flex-direction: column; gap: 0.6rem; }
    .booking h3 { font-size: 1.4rem; }
    .booking label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
    .booking input { font: inherit; padding: 0.4rem; border: 1px solid #999; border-radius: 4px; }
    .plan b { color: #b8431f; }

    /* ---------- workshop ---------- */
    .f-3 { background: #6b4b2e; }
    .workshop { padding: 1.4rem; display: flex; flex-direction: column; gap: 1.2rem; min-height: 100%; }
    .pegboard {
        background: radial-gradient(circle, #4a331f 2.5px, transparent 3px) 0 0 / 22px 22px, #c49a6c;
        border-radius: 4px;
        padding: 1rem;
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.25);
        color: #2a1c10;
    }
    .stencil { font: 700 1.6rem 'Josefin Sans', sans-serif; letter-spacing: 0.4em; opacity: 0.55; }
    .tools { list-style: none; display: flex; flex-wrap: wrap; gap: 1.1rem 0.7rem; margin-top: 1.4rem; }
    .tools li {
        background: #f3e6cf;
        border: 2px solid #2a1c10;
        border-radius: 4px;
        padding: 0.3rem 0.7rem;
        font-weight: 600;
        transform: rotate(calc(var(--r) * 2deg));
        transform-origin: 50% -10px;
        transition: transform 0.4s cubic-bezier(0.3, 2, 0.5, 1);
        position: relative;
    }
    .tools li::before { content: ''; position: absolute; top: -9px; left: 50%; width: 2px; height: 9px; background: #2a1c10; }
    .tools li:hover { transform: rotate(calc(var(--r) * -8deg)); }
    .bench { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1rem; background: linear-gradient(#8a6440, #5d4128); border-radius: 4px; }
    .crate {
        position: relative;
        height: 110px;
        border: 0;
        cursor: pointer;
        background:
            repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.06) 0 2px, transparent 2px 14px),
            #c9a46e;
        box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.15), 0 8px 14px rgba(0, 0, 0, 0.35);
        font: 700 0.85rem 'Josefin Sans', sans-serif;
        color: #3a2612;
        perspective: 400px;
    }
    .flap { position: absolute; top: 0; width: 50%; height: 26px; background: #b8915a; transition: transform 0.4s cubic-bezier(0.3, 1.6, 0.5, 1); }
    .flap.l { left: 0; transform-origin: 0 0; }
    .flap.r { right: 0; transform-origin: 100% 0; }
    .crate.open .flap.l { transform: rotateZ(-35deg); }
    .crate.open .flap.r { transform: rotateZ(35deg); }
    .crate-label { position: absolute; bottom: 14px; left: 0; right: 0; letter-spacing: 0.15em; }
    .crate-icon { position: absolute; top: 18px; left: 50%; transform: translateX(-50%) scale(0); font-size: 2rem; transition: transform 0.4s cubic-bezier(0.3, 1.8, 0.5, 1); }
    .crate.open .crate-icon { transform: translateX(-50%) translateY(-28px) scale(1); }
    .unboxed { background: #f3e6cf; color: #2a1c10; padding: 1rem 1.2rem; border-radius: 4px; animation: up 0.35s ease; }
    @keyframes up { from { opacity: 0; transform: translateY(10px); } }
    .unboxed h3 { text-transform: capitalize; margin-bottom: 0.3rem; }

    /* ---------- office ---------- */
    .f-4 { background: radial-gradient(ellipse at 30% 0%, #f7e8c8, #8b6a45 75%); transition: background 0.4s; color: #1e1a14; }
    .lampoff { background: radial-gradient(ellipse at 30% 0%, #5a4a35, #241c13 75%) !important; }
    .office { position: relative; display: flex; justify-content: center; padding: 1.6rem; min-height: 100%; }
    .lamp { position: absolute; top: 1rem; left: 1.2rem; font-size: 2.4rem; background: none; border: 0; cursor: pointer; filter: drop-shadow(0 0 16px #ffd27a); }
    .lampoff .lamp { filter: grayscale(1) brightness(0.6); }
    .paper {
        width: min(560px, 100%);
        background: #fdfbf6;
        padding: 1.8rem 2rem;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
        transform: rotate(0.8deg);
        font-family: 'Josefin Sans', sans-serif;
        line-height: 1.5;
    }
    .lampoff .paper { filter: brightness(0.55); }
    .paper h3 { font-size: 2rem; }
    .paper h4 { margin: 1rem 0 0.3rem; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.8rem; color: #8a5a20; }
    .paper ul { padding-left: 1.1rem; }
    .paper hr { border: 0; border-top: 1px solid #ddd; margin: 0.8rem 0; }
    .paper a { color: #8a5a20; }
    .mug { position: absolute; right: 1.6rem; bottom: 1.4rem; font-size: 2.6rem; }
    .steam { position: absolute; left: 50%; bottom: 100%; width: 8px; height: 30px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); filter: blur(4px); animation: steam 2.4s ease-in-out infinite; }
    @keyframes steam { 0% { transform: translateY(0) scaleY(0.6); opacity: 0; } 40% { opacity: 0.8; } 100% { transform: translateY(-30px) scaleY(1.4) translateX(6px); opacity: 0; } }

    /* ---------- roof ---------- */
    .roof { position: relative; min-height: 100%; display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.6rem 1.6rem 6rem; background: linear-gradient(var(--top), var(--bot)); color: #fff; }
    .stars { position: absolute; inset: 0 0 40% 0; opacity: 0; background-image: radial-gradient(1px 1px at 12% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 44% 26%, #fff, transparent), radial-gradient(1px 1px at 77% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 88% 16%, #fff, transparent); }
    .stars.on { opacity: 1; }
    .roof-text { position: relative; text-align: center; max-width: 52ch; text-shadow: 0 1px 10px rgba(0, 0, 0, 0.25); }
    .roof-text h3 { font-size: 1.8rem; }
    .telescope { position: relative; width: min(520px, 100%); border-radius: 50% / 14%; overflow: hidden; box-shadow: 0 0 0 8px #1d1d1d, 0 20px 40px rgba(0, 0, 0, 0.4); }
    .telescope img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
    .telescope figcaption { position: absolute; bottom: 0; left: 0; right: 0; padding: 0.6rem 1rem; font-size: 0.8rem; background: linear-gradient(transparent, rgba(0, 0, 0, 0.6)); text-align: center; }
    .scope-btn { position: relative; z-index: 1; font: 600 0.9rem 'Josefin Sans', sans-serif; border: 1.5px solid #fff; background: rgba(0, 0, 0, 0.2); color: #fff; border-radius: 999px; padding: 0.4rem 1rem; cursor: pointer; }
    .ridge { position: absolute; left: 0; right: 0; bottom: 0; height: 90px; width: 100%; }
    .ridge path { fill: rgba(10, 14, 24, 0.55); }

    /* ---------- darkroom ---------- */
    .f-B { background: #e8e4dc; color: #1a1a1a; transition: background 0.4s, color 0.4s; }
    .f-B.dark { background: radial-gradient(ellipse at 50% 0%, #6b0d0d, #1a0303 70%); color: #ffb3a8; }
    .darkroom { padding: 1.6rem; }
    .chain { float: right; font: 600 0.85rem 'Josefin Sans', sans-serif; border: 1px solid currentColor; background: none; color: inherit; border-radius: 999px; padding: 0.3rem 0.9rem; cursor: pointer; }
    .darkroom h3 { font-size: 1.6rem; }
    .shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.8rem; margin-top: 1rem; }
    .box { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.9rem; border: 1.5px solid currentColor; border-radius: 4px; color: inherit; text-decoration: none; transition: transform 0.2s; }
    .box:hover { transform: translateY(-3px); }
    .box span { font-size: 0.8rem; opacity: 0.8; }

    /* shared */
    .small { font-size: 0.8rem; opacity: 0.7; }
    .center { text-align: center; color: #f3e6cf; }
    .btn { align-self: flex-start; display: inline-block; font: 600 0.9rem 'Josefin Sans', sans-serif; padding: 0.5rem 1.1rem; border-radius: 999px; background: #1d1d1d; color: #fff; text-decoration: none; margin-top: 0.4rem; }

    /* ---------- panel ---------- */
    .panel {
        align-self: start;
        background: linear-gradient(160deg, #d9b45e, #a07a2e);
        border-radius: 10px;
        padding: 1.2rem 1rem;
        color: #2a1e08;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 20px 40px rgba(0, 0, 0, 0.45);
    }
    .plate-title { text-align: center; font: 700 0.75rem 'Josefin Sans', sans-serif; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.8rem; }
    .buttons { display: flex; flex-direction: column; gap: 0.5rem; }
    .call { display: grid; grid-template-columns: 46px 1fr; align-items: center; gap: 0.7rem; background: none; border: 0; cursor: pointer; text-align: left; color: inherit; font: inherit; padding: 0; }
    .key {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font: 700 1.1rem 'Josefin Sans', sans-serif;
        background: radial-gradient(circle at 40% 35%, #fbf5e6, #c9c2b1);
        box-shadow: 0 0 0 3px #7a5a1c, 0 3px 0 3px #5e4412;
        color: #3a2a0d;
        transition: box-shadow 0.2s, color 0.2s;
    }
    .call.lit .key { color: #ff9b3d; box-shadow: 0 0 0 3px #7a5a1c, 0 3px 0 3px #5e4412, 0 0 14px 4px rgba(255, 155, 61, 0.6); text-shadow: 0 0 6px #ff9b3d; }
    .call:active .key { transform: translateY(2px); }
    .label { display: flex; flex-direction: column; font-weight: 700; }
    .label small { font-weight: 400; opacity: 0.75; }
    .row { display: flex; gap: 0.4rem; margin-top: 1rem; flex-wrap: wrap; }
    .mini { font: 600 0.8rem 'Josefin Sans', sans-serif; border-radius: 999px; border: 1.5px solid #5e4412; background: rgba(255, 255, 255, 0.25); color: #2a1e08; padding: 0.3rem 0.7rem; cursor: pointer; }
    .mini.on { background: #2a1e08; color: #ffd27a; }
    .cert { font-size: 0.7rem; margin-top: 1rem; opacity: 0.75; }
    .cert a { color: inherit; }

    .toast {
        position: fixed;
        left: 50%;
        bottom: 1.5rem;
        transform: translateX(-50%);
        background: #1a1713;
        color: #ffd27a;
        border: 1px solid #d9b45e;
        padding: 0.7rem 1.1rem;
        border-radius: 8px;
        z-index: 50;
        animation: up 0.3s ease;
        max-width: 90vw;
    }

    @media (max-width: 900px) {
        .building { grid-template-columns: 1fr; padding-top: 3.2rem; }
        .panel { order: -1; }
        .buttons { flex-direction: row; flex-wrap: wrap; justify-content: space-between; }
        .call { grid-template-columns: 46px; justify-items: center; }
        .label { display: none; }
        .lobby, .studio { grid-template-columns: 1fr; height: auto; }
        .bench { grid-template-columns: 1fr; }
        .letterboard { font-size: 0.75rem; padding: 0.8rem; }
    }
</style>
