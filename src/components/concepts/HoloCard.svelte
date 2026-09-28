<script>
    /**
     * @typedef {{ id: string, number: string, name: string, type: string, typeIcon: string, rarity: 'common'|'rare'|'holo'|'rookie',
     *   corner?: string, img?: string, stats: {label: string, value: string}[], ability: {name: string, text: string}, flavor?: string }} Card
     * @type {{ card: Card, revealed?: boolean, onreveal?: () => void, children?: import('svelte').Snippet }}
     */
    let { card, revealed = false, onreveal, children } = $props();

    let el;
    let tilt = $state({ rx: 0, ry: 0, mx: 50, my: 50, on: false });

    function move(e) {
        if (!revealed || e.pointerType === 'touch') return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        tilt = { rx: (0.5 - py) * 22, ry: (px - 0.5) * 26, mx: px * 100, my: py * 100, on: true };
    }

    function leave() {
        tilt = { rx: 0, ry: 0, mx: 50, my: 50, on: false };
    }
</script>

<button
    bind:this={el}
    class="card {card.rarity}"
    class:revealed
    class:active={tilt.on}
    style:--rx="{tilt.rx}deg"
    style:--ry="{tilt.ry}deg"
    style:--mx="{tilt.mx}%"
    style:--my="{tilt.my}%"
    onpointermove={move}
    onpointerleave={leave}
    onclick={() => !revealed && onreveal?.()}
    aria-label={revealed ? `${card.name} card` : 'Face-down card — click to flip'}
>
    <span class="inner">
        <!-- back -->
        <span class="face back" aria-hidden="true">
            <span class="back-logo">jw<small>.studio</small></span>
            <span class="back-series">SERIES 1</span>
        </span>

        <!-- front -->
        <span class="face front">
            <span class="head">
                <span class="name">{card.name}</span>
                {#if card.corner}<span class="corner">{card.corner}</span>{/if}
                <span class="type-icon" title={card.type}>{card.typeIcon}</span>
            </span>
            <span class="art">
                {#if children}
                    {@render children()}
                {:else if card.img}
                    <img src={card.img} alt="" loading="lazy" decoding="async" draggable="false" />
                {/if}
            </span>
            <span class="type-bar">{card.type} · {card.rarity === 'rookie' ? 'Rookie Card' : card.rarity}</span>
            <span class="ability">
                <strong>{card.ability.name}</strong>
                {card.ability.text}
            </span>
            <span class="stats">
                {#each card.stats as s}
                    <span><b>{s.value}</b>{s.label}</span>
                {/each}
            </span>
            {#if card.flavor}<span class="flavor">{card.flavor}</span>{/if}
            <span class="foot"><span>{card.number}</span><span class="rarity-mark">{card.rarity === 'common' ? '●' : card.rarity === 'rare' ? '◆' : '★'}</span></span>
            <span class="shine" aria-hidden="true"></span>
            <span class="glare" aria-hidden="true"></span>
        </span>
    </span>
</button>

<style>
    .card {
        --w: 250px;
        width: var(--w);
        aspect-ratio: 63 / 88;
        border: 0;
        padding: 0;
        background: none;
        perspective: 900px;
        cursor: pointer;
        font: inherit;
        color: inherit;
        text-align: left;
    }

    .inner {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        transform: rotateY(180deg);
        transition: transform 0.7s cubic-bezier(0.2, 0.9, 0.2, 1.15);
    }
    .revealed .inner { transform: rotateY(0deg) rotateX(var(--rx)) rotateY(var(--ry)); }
    .revealed.active .inner { transition: transform 0.08s linear; }
    .revealed:not(.active):hover .inner { transform: translateY(-6px); }

    .face {
        position: absolute;
        inset: 0;
        border-radius: 14px;
        overflow: hidden;
        backface-visibility: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    }

    /* ---------- Back ---------- */
    .back {
        transform: rotateY(180deg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        background:
            repeating-conic-gradient(from 0deg, #ff5a3c 0 10deg, #ff7a3c 10deg 20deg),
            #ff5a3c;
        border: 8px solid #fff4e0;
    }
    .back-logo {
        font-family: 'Bungee', sans-serif;
        font-size: 3.2rem;
        color: #fff4e0;
        text-shadow: 3px 3px 0 #1d1447;
        background: #1d1447;
        border-radius: 50%;
        width: 150px;
        height: 150px;
        display: grid;
        place-items: center;
        line-height: 0.8;
        text-align: center;
    }
    .back-logo small { display: block; font-size: 0.9rem; }
    .back-series { font: 700 0.8rem 'Barlow Condensed', sans-serif; letter-spacing: 0.3em; color: #1d1447; background: #fff4e0; padding: 0.1rem 0.6rem; border-radius: 4px; }

    /* ---------- Front ---------- */
    .front {
        display: flex;
        flex-direction: column;
        padding: 10px;
        background: linear-gradient(160deg, #fff7e6, #ffe3b0);
        border: 8px solid #f2c14e;
        color: #1d1447;
    }
    .rare .front { border-color: #9fb4c7; background: linear-gradient(160deg, #eef4fb, #cad8ea); }
    .holo .front { border-color: #c9a9ff; background: linear-gradient(160deg, #f3ecff, #d8c8ff); }
    .rookie .front { border-color: #1d1447; background: linear-gradient(160deg, #ffe9e0, #ffc7b0); }

    .head { display: flex; align-items: baseline; gap: 0.3rem; }
    .name { font-family: 'Bungee', sans-serif; font-size: 1rem; line-height: 1.1; flex: 1; }
    .corner { font: 700 0.7rem 'Barlow Condensed', sans-serif; letter-spacing: 0.05em; }
    .type-icon { font-size: 1rem; }

    .art {
        position: relative;
        display: block;
        height: 42%;
        margin: 6px 0 4px;
        border: 3px solid #1d1447;
        background: #1d1447;
        overflow: hidden;
    }
    .art img { width: 100%; height: 100%; object-fit: cover; }
    .art :global(.depth-container) { border-radius: 0; }

    .type-bar {
        font: 700 0.62rem 'Barlow Condensed', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        text-align: center;
        background: #1d1447;
        color: #fff4e0;
        border-radius: 3px;
        padding: 1px 0;
    }
    .ability { display: block; font: 500 0.72rem/1.25 'Barlow Condensed', sans-serif; margin: 6px 0 4px; }
    .ability strong { font-family: 'Bungee', sans-serif; font-weight: 400; font-size: 0.72rem; margin-right: 0.25rem; }
    .stats { display: flex; justify-content: space-between; gap: 4px; margin-top: auto; }
    .stats span {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        font: 600 0.55rem 'Barlow Condensed', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: rgba(29, 20, 71, 0.08);
        border-radius: 4px;
        padding: 2px 0;
    }
    .stats b { font-size: 0.82rem; letter-spacing: 0; }
    .flavor { font: italic 500 0.62rem/1.2 'Barlow Condensed', sans-serif; opacity: 0.75; margin-top: 4px; }
    .foot { display: flex; justify-content: space-between; font: 700 0.6rem 'Barlow Condensed', sans-serif; margin-top: 4px; }

    /* ---------- Foil ---------- */
    .shine,
    .glare {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
    }
    .active .shine,
    .active .glare { opacity: 1; }

    .glare {
        background: radial-gradient(circle at var(--mx) var(--my), rgba(255, 255, 255, 0.55), transparent 45%);
        mix-blend-mode: overlay;
    }

    .shine { display: none; }
    .rare .shine,
    .holo .shine,
    .rookie .shine {
        display: block;
        background: repeating-linear-gradient(
            115deg,
            #ff7a7a 0%, #ffd36a 6%, #7affa2 12%, #6ad4ff 18%, #b07aff 24%, #ff7a7a 30%
        );
        background-size: 300% 300%;
        background-position: var(--mx) var(--my);
        mix-blend-mode: color-dodge;
        filter: brightness(0.7) contrast(1.4);
    }
    .active.rare .shine { opacity: 0.35; }
    .active.holo .shine { opacity: 0.7; }
    .active.rookie .shine { opacity: 0.5; }

    /* Holo rares get a sparkle layer on top */
    .holo .glare {
        background:
            radial-gradient(circle at var(--mx) var(--my), rgba(255, 255, 255, 0.6), transparent 40%),
            radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 2px),
            radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 2px),
            radial-gradient(circle at 45% 80%, #fff 0 1px, transparent 2px);
        background-size: 100% 100%, 40px 40px, 55px 55px, 35px 35px;
    }

    @media (max-width: 560px) {
        .card { --w: 158px; }
        .name { font-size: 0.7rem; }
        .ability, .flavor { display: none; }
        .stats b { font-size: 0.65rem; }
    }
</style>
