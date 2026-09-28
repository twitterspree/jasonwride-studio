<script>
    import { onMount } from 'svelte';

    /** @type {{ specimens: { id: string, src: string, srcset?: string, alt: string, latin: string, common: string, note?: string, portrait?: boolean }[] }} */
    let { specimens = [] } = $props();

    let els = $state([]);
    // One damped pendulum per specimen, hanging from its pin
    const swing = specimens.map(() => ({ a: 0, v: 0 }));
    let frame = 0;
    let last = null;

    function tick() {
        let moving = false;
        swing.forEach((s, i) => {
            s.v += -s.a * 0.045; // gravity pulls back to hanging straight
            s.v *= 0.965; // air resistance
            s.a += s.v;
            if (Math.abs(s.a) > 0.02 || Math.abs(s.v) > 0.02) moving = true;
            if (els[i]) els[i].style.transform = `rotate(${s.a.toFixed(2)}deg)`;
        });
        frame = moving ? requestAnimationFrame(tick) : 0;
    }

    function wake() {
        if (!frame) frame = requestAnimationFrame(tick);
    }

    // Brushing past a specimen nudges it in the direction the cursor travels
    function onMove(e) {
        if (last) {
            const dx = e.clientX - last.x;
            els.forEach((el, i) => {
                if (!el) return;
                const r = el.getBoundingClientRect();
                const inside =
                    e.clientX > r.left - 20 && e.clientX < r.right + 20 && e.clientY > r.top && e.clientY < r.bottom;
                if (inside) {
                    // Lower on the card = longer lever = bigger swing
                    const lever = (e.clientY - r.top) / r.height;
                    swing[i].v += Math.max(-3, Math.min(3, dx * 0.06 * lever));
                    wake();
                }
            });
        }
        last = { x: e.clientX, y: e.clientY };
    }

    function flick(i) {
        swing[i].v += (Math.random() > 0.5 ? 1 : -1) * 6;
        wake();
    }

    onMount(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        window.addEventListener('pointermove', onMove);
        return () => {
            window.removeEventListener('pointermove', onMove);
            cancelAnimationFrame(frame);
        };
    });
</script>

<div class="drawer">
    {#each specimens as sp, i (sp.id)}
        <figure class="specimen" class:tall={sp.portrait}>
            <span class="pin" aria-hidden="true"></span>
            <button class="hang" bind:this={els[i]} onclick={() => flick(i)} aria-label="{sp.alt} — give it a flick">
                <img src={sp.src} srcset={sp.srcset} alt="" loading="lazy" decoding="async" draggable="false" />
                <span class="tag">
                    <span class="no">No. {String(i + 1).padStart(3, '0')}</span>
                    <em>{sp.latin}</em>
                    <span class="common">{sp.common}</span>
                </span>
            </button>
            {#if sp.note}<figcaption class="note">{sp.note}</figcaption>{/if}
        </figure>
    {/each}
</div>

<style>
    .drawer {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 3.5rem 2rem;
        padding: 2.5rem 0 1rem;
    }

    .specimen {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .pin {
        position: relative;
        z-index: 2;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #ff8a7a, #b3261e 60%, #6e1510);
        box-shadow: 1px 2px 2px rgba(0, 0, 0, 0.35);
        margin-bottom: -7px;
    }

    .hang {
        display: block;
        width: 100%;
        border: 0;
        padding: 8px 8px 0;
        background: #fffdf7;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1), 3px 8px 14px rgba(60, 45, 20, 0.2);
        transform-origin: 50% 0;
        cursor: pointer;
        font: inherit;
        color: inherit;
        text-align: left;
    }

    .hang img {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        filter: sepia(0.15) saturate(0.95);
    }
    .tall .hang img { aspect-ratio: 3 / 4; }

    .tag {
        display: flex;
        flex-direction: column;
        padding: 0.5rem 0.2rem 0.6rem;
        font-family: 'Courier Prime', monospace;
        font-size: 0.72rem;
        line-height: 1.35;
        color: #4a4133;
    }
    .tag em {
        font-family: 'Libre Caslon Text', serif;
        font-size: 1rem;
        color: #1f2a1c;
    }
    .no { color: #9b3d1e; letter-spacing: 0.08em; }

    .note {
        margin-top: 0.6rem;
        font-family: 'Kalam', cursive;
        font-size: 0.95rem;
        color: #2c5a8c;
        transform: rotate(-2deg);
        text-align: center;
    }
</style>
