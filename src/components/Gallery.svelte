<script>
    export let images = [];
    let selectedImage = null;

    function openLightbox(img) {
        selectedImage = img;
    }

    function closeLightbox() {
        selectedImage = null;
    }
</script>

<style>
    .gallery-grid {
        column-count: 1; 
        column-gap: 1rem;
    }

    @media (min-width: 600px) { .gallery-grid { column-count: 2; } }
    @media (min-width: 900px) { .gallery-grid { column-count: 3; } }
    /* Removed 4th column per your request */

    /* 1. THE WRAPPER (Static) */
    /* This element sits in the column and DOES NOT move */
    .gallery-item-wrapper {
        margin-bottom: 1rem;
        break-inside: avoid; /* Keeps image from splitting across columns */
        border-radius: 12px; /* Cookie vibe */
        overflow: hidden;    /* Optional: crops the zoom to the border */
        /* Fix for Safari/Chrome column glitching: */
        transform: translateZ(0); 
    }

    /* 2. THE IMAGE (Animated) */
    /* This element lives inside the wrapper and is free to move */
    .gallery-image {
        width: 100%;
        display: block;
        cursor: pointer;
        transition: transform 0.3s ease; /* Smooth zoom */
    }

    /* Hover effect applies to the IMAGE when you hover the WRAPPER */
    .gallery-item-wrapper:hover .gallery-image {
        transform: scale(1.05);
    }

    /* Lightbox Styles (Same as before) */
    .lightbox {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(51,45,45, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: zoom-out;
    }

    .lightbox img {
        max-width: 90%;
        max-height: 90%;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    }
</style>

<div class="gallery-grid">
    {#each images as img}
        <div class="gallery-item-wrapper" on:click={() => openLightbox(img)}>
            <img 
                src={img.url} 
                alt={img.alt} 
                class="gallery-image"
            />
        </div>
    {/each}
</div>

{#if selectedImage}
    <div class="lightbox" on:click={closeLightbox} role="button" tabindex="0">
        <img src={selectedImage.url} alt={selectedImage.alt} />
    </div>
{/if}