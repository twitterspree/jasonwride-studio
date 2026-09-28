<script>
    /** @type {{ images: { id: string, thumb: string, srcset: string, width: number, height: number, full: string, alt: string }[] }} */
    let { images = [] } = $props();

    let selected = $state(null);
    let dialog;
    let opener = null;

    // A native <dialog> opened with showModal() renders in the browser's top layer,
    // so no z-index/stacking context can cover it, and the page behind goes inert.
    function open(img, e) {
        opener = e.currentTarget;
        selected = img;
        dialog.showModal();
    }

    function close() {
        dialog.close();
    }

    // Fires for the close button, backdrop clicks, and the native Escape key
    function onClose() {
        selected = null;
        opener?.focus();
        opener = null;
    }
</script>

<div class="marquee-container">
    <div class="marquee-track" class:paused={selected}>
        <!-- The track is rendered twice for a seamless loop; the duplicate is inert, so only the first copy is focusable or announced -->
        {#each [0, 1] as copy}
            <ul class="marquee-set" aria-hidden={copy === 1 ? 'true' : undefined} inert={copy === 1}>
                {#each images as img (img.id)}
                    <li>
                        <button
                            class="img-btn"
                            onclick={(e) => open(img, e)}
                            aria-label="View larger: {img.alt}"
                        >
                            <img
                                src={img.thumb}
                                srcset={img.srcset}
                                alt=""
                                width={img.width}
                                height={img.height}
                                class="marquee-item"
                                loading="lazy"
                                decoding="async"
                            />
                        </button>
                    </li>
                {/each}
            </ul>
        {/each}
    </div>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="lightbox" bind:this={dialog} aria-label={selected?.alt} onclick={close} onclose={onClose}>
    {#if selected}
        <img src={selected.full} alt={selected.alt} />
    {/if}
    <button class="lightbox-close" onclick={close} aria-label="Close" autofocus>✕</button>
</dialog>

<style>
    .marquee-container {
        width: 100%;
        overflow: hidden;
        position: relative;
        padding: 2rem 0;
        mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    }

    .marquee-track {
        display: flex;
        width: max-content;
        animation: scroll 40s linear infinite;
    }

    /* Pause while the visitor is looking at (or tabbing through) a photo */
    .marquee-track:hover,
    .marquee-track:focus-within,
    .marquee-track.paused {
        animation-play-state: paused;
    }

    .marquee-set {
        display: flex;
        gap: 1.5rem;
        padding-right: 1.5rem; /* matches gap so the loop seam is even */
        list-style: none;
    }

    .img-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: zoom-in;
        display: block;
        border-radius: 16px;
    }

    .marquee-item {
        height: 300px;
        width: auto;
        border-radius: 16px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        object-fit: cover;
        display: block;
        background: var(--surface-soft);
    }

    .img-btn:hover .marquee-item,
    .img-btn:focus-visible .marquee-item {
        transform: scale(1.05);
        box-shadow: 0 10px 30px var(--accent-glow);
    }

    @media (max-width: 600px) {
        .marquee-item {
            height: 220px;
        }
    }

    @keyframes scroll {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
    }

    /* Reduced motion: no auto-scroll, let people swipe/scroll the strip instead */
    @media (prefers-reduced-motion: reduce) {
        .marquee-container {
            overflow-x: auto;
            mask-image: none;
            -webkit-mask-image: none;
        }
        .marquee-track {
            animation: none;
        }
        .marquee-set[aria-hidden='true'] {
            display: none;
        }
    }

    /* Lock page scroll while the lightbox is open */
    :global(html:has(dialog.lightbox[open])) {
        overflow: hidden;
    }

    .lightbox {
        /* Reset UA dialog styles and fill the viewport */
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        cursor: zoom-out;
        overscroll-behavior: contain;
    }

    .lightbox[open] {
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.2s ease;
    }

    .lightbox::backdrop {
        background: rgba(20, 18, 18, 0.9);
        backdrop-filter: blur(5px);
    }

    .lightbox img {
        max-width: 90%;
        max-height: 90%;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    .lightbox-close {
        position: absolute;
        top: 1.25rem;
        right: 1.25rem;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        font-size: 1.1rem;
        cursor: pointer;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
</style>
