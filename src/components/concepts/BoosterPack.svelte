<script>
    import HoloCard from './HoloCard.svelte';
    import DepthProfile from '../DepthProfile.svelte';

    /** @type {{ cards: any[], portrait: { src: string, depthSrc: string, width: number, height: number } }} */
    let { cards = [], portrait } = $props();

    let stage = $state('sealed'); // sealed → ripping → open
    let revealed = $state({});
    let tearX = $state(0); // how far the tear strip has been dragged (0–1)
    let dragging = false;
    let strip;
    let confetti = $state([]);

    const count = $derived(Object.values(revealed).filter(Boolean).length);
    const complete = $derived(stage === 'open' && count === cards.length);

    function rip() {
        if (stage !== 'sealed') return;
        stage = 'ripping';
        setTimeout(() => (stage = 'open'), 700);
    }

    // Drag along the tear strip to open the pack (or just click it)
    function down(e) {
        dragging = true;
        strip.setPointerCapture(e.pointerId);
    }
    function move(e) {
        if (!dragging) return;
        const r = strip.getBoundingClientRect();
        tearX = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (tearX > 0.85) {
            dragging = false;
            rip();
        }
    }
    function up() {
        if (!dragging) return;
        dragging = false;
        if (tearX < 0.1) rip(); // a plain click also opens it
        else if (stage === 'sealed') tearX = 0;
    }

    function reveal(id) {
        revealed[id] = true;
        if (Object.values(revealed).filter(Boolean).length === cards.length) burst();
    }

    function revealAll() {
        cards.forEach((c, i) => setTimeout(() => reveal(c.id), i * 120));
    }

    function burst() {
        const colors = ['#ff5a3c', '#f2c14e', '#6ad4ff', '#b07aff', '#7affa2', '#fff4e0'];
        confetti = Array.from({ length: 90 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 0.4,
            dur: 1.8 + Math.random() * 1.4,
            rot: Math.random() * 720 - 360,
            color: colors[i % colors.length],
            drift: (Math.random() - 0.5) * 30
        }));
        setTimeout(() => (confetti = []), 3800);
    }

    function reset() {
        revealed = {};
        tearX = 0;
        stage = 'sealed';
    }
</script>

<div class="table">
    {#if stage !== 'open'}
        <div class="pack" class:ripping={stage === 'ripping'}>
            <div class="pack-top" style:transform={stage === 'ripping' ? '' : `rotate(${-tearX * 8}deg)`}>
                <span class="crimp"></span>
            </div>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="tear-strip"
                bind:this={strip}
                onpointerdown={down}
                onpointermove={move}
                onpointerup={up}
                onpointercancel={up}
            >
                <span class="torn" style:width="{tearX * 100}%"></span>
                <span class="tear-label">✂ drag to tear ✂</span>
            </div>
            <div class="pack-body">
                <span class="pack-series">SERIES 1 · BOOSTER</span>
                <span class="pack-logo">jw<small>.studio</small></span>
                <span class="pack-count">{cards.length} cards inside</span>
                <span class="pack-odds">1 Rookie · 1 Holo per pack!</span>
                <span class="pack-crimp"></span>
            </div>
            <button class="rip-btn" onclick={rip}>or just rip it open</button>
        </div>
    {:else}
        <div class="binder-bar">
            <span class="counter">Collected <b>{count}</b> / {cards.length}</span>
            <div class="bar-btns">
                {#if !complete}<button onclick={revealAll}>Flip all</button>{/if}
                <button onclick={reset}>New pack</button>
            </div>
        </div>
        {#if complete}<p class="complete">★ Complete set! ★</p>{/if}
        <div class="spread">
            {#each cards as card, i (card.id)}
                <div class="deal" style:--i={i}>
                    <HoloCard {card} revealed={!!revealed[card.id]} onreveal={() => reveal(card.id)}>
                        {#snippet children()}
                            {#if card.id === 'rookie'}
                                <DepthProfile {...portrait} alt="Portrait of Jason Wride" />
                            {:else if card.img}
                                <img src={card.img} alt={card.alt ?? ''} loading="lazy" decoding="async" draggable="false" />
                            {/if}
                        {/snippet}
                    </HoloCard>
                </div>
            {/each}
        </div>
    {/if}

    {#each confetti as c (c.id)}
        <span
            class="confetti"
            style:left="{c.x}%"
            style:background={c.color}
            style:--rot="{c.rot}deg"
            style:--drift="{c.drift}vw"
            style:animation-duration="{c.dur}s"
            style:animation-delay="{c.delay}s"
        ></span>
    {/each}
</div>

<style>
    .table { position: relative; min-height: 560px; }

    /* ---------- Pack ---------- */
    .pack {
        position: relative;
        width: 280px;
        margin: 1rem auto;
        filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.5));
        transition: transform 0.3s;
    }
    .pack:hover { transform: rotate(-2deg) scale(1.02); }

    .pack-top,
    .pack-body {
        background:
            linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.45) 45%, transparent 60%),
            linear-gradient(160deg, #ff5a3c, #b8216b 55%, #1d1447);
        background-size: 250% 100%, 100% 100%;
        animation: foil 4s linear infinite;
    }
    @keyframes foil { from { background-position: 150% 0, 0 0; } to { background-position: -150% 0, 0 0; } }

    .pack-top {
        height: 46px;
        border-radius: 10px 10px 0 0;
        position: relative;
        transform-origin: 0 100%;
        transition: transform 0.15s;
    }
    .crimp,
    .pack-crimp {
        position: absolute;
        left: 0;
        right: 0;
        height: 10px;
        background: repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.25) 0 3px, transparent 3px 6px);
    }
    .crimp { top: 6px; }
    .pack-crimp { bottom: 8px; }

    .ripping .pack-top { animation: flyoff 0.7s cubic-bezier(0.3, 0, 0.6, 1) forwards; }
    @keyframes flyoff { to { transform: translate(180px, -220px) rotate(60deg); opacity: 0; } }
    .ripping .pack-body { animation: drop 0.7s ease-in forwards; }
    @keyframes drop { 60% { transform: translateY(-8px); } to { transform: translateY(40px); opacity: 0; } }

    .tear-strip {
        position: relative;
        height: 22px;
        background: repeating-linear-gradient(90deg, #fff4e0 0 10px, #f2c14e 10px 20px);
        cursor: ew-resize;
        touch-action: none;
        user-select: none;
    }
    .torn { position: absolute; left: 0; top: 0; bottom: 0; background: #1d1447; }
    .tear-label {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font: 700 0.72rem 'Barlow Condensed', sans-serif;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: #1d1447;
        text-shadow: 0 0 3px #fff4e0, 0 0 6px #fff4e0;
        pointer-events: none;
    }

    .pack-body {
        position: relative;
        height: 380px;
        border-radius: 0 0 10px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.8rem;
        color: #fff4e0;
        text-align: center;
    }
    .pack-series { font: 700 0.8rem 'Barlow Condensed', sans-serif; letter-spacing: 0.3em; }
    .pack-logo {
        font-family: 'Bungee', sans-serif;
        font-size: 4.2rem;
        line-height: 0.85;
        text-shadow: 4px 4px 0 #1d1447;
        transform: rotate(-6deg);
    }
    .pack-logo small { display: block; font-size: 1.2rem; }
    .pack-count { font: 700 1.1rem 'Barlow Condensed', sans-serif; background: #f2c14e; color: #1d1447; padding: 0.15rem 0.8rem; border-radius: 999px; transform: rotate(3deg); }
    .pack-odds { font: 600 0.8rem 'Barlow Condensed', sans-serif; opacity: 0.85; }

    .rip-btn {
        display: block;
        margin: 1.2rem auto 0;
        background: none;
        border: 0;
        color: #fff4e0;
        font: 600 0.9rem 'Barlow Condensed', sans-serif;
        text-decoration: underline;
        text-underline-offset: 4px;
        cursor: pointer;
        opacity: 0.8;
    }

    /* ---------- Spread ---------- */
    .binder-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .counter { font: 600 1.1rem 'Barlow Condensed', sans-serif; color: #fff4e0; }
    .counter b { font-family: 'Bungee', sans-serif; color: #f2c14e; font-size: 1.4rem; }
    .bar-btns { display: flex; gap: 0.5rem; }
    .bar-btns button {
        font: 700 0.85rem 'Barlow Condensed', sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 0.45rem 1rem;
        border-radius: 999px;
        border: 2px solid #f2c14e;
        background: transparent;
        color: #f2c14e;
        cursor: pointer;
    }
    .bar-btns button:hover { background: #f2c14e; color: #1d1447; }
    .complete {
        text-align: center;
        font-family: 'Bungee', sans-serif;
        font-size: 2rem;
        color: #f2c14e;
        text-shadow: 3px 3px 0 #b8216b;
        animation: pop 0.5s cubic-bezier(0.3, 1.8, 0.5, 1);
        margin-bottom: 1rem;
    }
    @keyframes pop { from { transform: scale(0.3); opacity: 0; } }

    .spread {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 1.4rem;
    }
    .deal {
        animation: deal 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
        animation-delay: calc(var(--i) * 70ms);
    }
    @keyframes deal { from { transform: translateY(-260px) rotate(-12deg) scale(0.6); opacity: 0; } }

    .confetti {
        position: fixed;
        top: -20px;
        z-index: 9500;
        width: 9px;
        height: 14px;
        border-radius: 2px;
        pointer-events: none;
        animation-name: fall;
        animation-timing-function: cubic-bezier(0.3, 0.4, 0.6, 1);
        animation-fill-mode: forwards;
    }
    @keyframes fall { to { transform: translate(var(--drift), 110vh) rotate(var(--rot)); } }

    @media (max-width: 560px) {
        .spread { gap: 0.8rem; }
    }
</style>
