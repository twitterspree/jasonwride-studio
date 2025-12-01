<script>
    import { onMount } from 'svelte';
    
    export let images = [];
    let selectedImage = null;
    let imagesLoaded = false;

    function openLightbox(img) {
        selectedImage = img;
    }

    function closeLightbox() {
        selectedImage = null;
    }

    // New: Handle keyboard "Escape" to close
    function handleKeydown(e) {
        if (e.key === 'Escape') closeLightbox();
    }

    // Preload all images before starting animation
    onMount(() => {
        const imagePromises = images.map(img => {
            return new Promise((resolve, reject) => {
                const imageEl = new Image();
                imageEl.onload = resolve;
                imageEl.onerror = reject;
                imageEl.src = img.url;
            });
        });

        Promise.all(imagePromises).then(() => {
            imagesLoaded = true;
        }).catch(err => {
            console.error('Some images failed to load', err);
            imagesLoaded = true; // Start anyway after error
        });
    });
</script>

<style>
    /* ... Keep your existing container/track styles ... */
    .marquee-container {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        position: relative;
        padding: 2rem 0;
        mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    }

    .marquee-track {
        display: inline-flex;
        gap: 1.5rem;
        animation: scroll 40s linear infinite;
        animation-play-state: paused; /* Start paused */
    }

    .marquee-track.loaded {
        animation-play-state: running; /* Start animation when ready */
    }

    /* .marquee-track:hover {
        animation-play-state: paused;
    } */

    /* NEW: Invisible Button Style */
    .img-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        outline: none; /* We handle focus visual with the image */
        display: block; /* Ensures it behaves nicely in the flex row */
    }

    .marquee-item {
        height: 300px;
        width: auto;
        border-radius: 16px;
        transition: transform 0.3s ease, filter 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        object-fit: cover;
        display: block; /* Removes tiny bottom gap inside button */
    }

    /* Apply hover effect when the BUTTON is hovered */
    .img-btn:hover .marquee-item, 
    .img-btn:focus .marquee-item {
        transform: scale(1.05);
        box-shadow: 0 10px 30px rgba(255, 146, 72, 0.3);
    }

    @keyframes scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
    }

    .lightbox {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(51,45,45, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        cursor: zoom-out;
        backdrop-filter: blur(5px);
    }

    .lightbox img {
        max-width: 90%;
        max-height: 90%;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    .paused {
        animation-play-state: paused;
    }
</style>

<svelte:window on:keydown={handleKeydown} />

<div class="marquee-container">
    <div class="marquee-track {selectedImage ? 'paused' : ''} {imagesLoaded ? 'loaded' : ''}">
        
        {#each images as img}
            <button class="img-btn" on:click={() => openLightbox(img)} aria-label={img.alt}>
                <img src={img.url} alt={img.alt} class="marquee-item" loading="eager" />
            </button>
        {/each}

        {#each images as img}
            <button class="img-btn" on:click={() => openLightbox(img)} aria-label={img.alt}>
                <img src={img.url} alt={img.alt} class="marquee-item" loading="eager" />
            </button>
        {/each}
    </div>
</div>

{#if selectedImage}
    <button class="lightbox" on:click={closeLightbox} aria-label="Close lightbox">
        <img src={selectedImage.url} alt={selectedImage.alt} />
    </button>
{/if}