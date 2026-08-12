<script>
    import { onMount } from 'svelte';

    let icons = [
        { id: 'html', class: 'fab fa-html5', colorClass: 'html', tooltip: 'HTML5 Structure', x: 0, y: 0, vx: 0, vy: 0, dragging: false },
        { id: 'css', class: 'fab fa-css3-alt', colorClass: 'css', tooltip: 'CSS3 Styling', x: 0, y: 0, vx: 0, vy: 0, dragging: false },
        { id: 'js', class: 'fab fa-js-square', colorClass: 'js', tooltip: 'JavaScript Logic', x: 0, y: 0, vx: 0, vy: 0, dragging: false },
        { id: 'photo', class: 'fas fa-camera-retro', colorClass: 'photo', tooltip: 'Photography & Visuals', x: 0, y: 0, vx: 0, vy: 0, dragging: false }
    ];

    let nodes = [];
    let dragTarget = null;
    let lastX = 0;
    let lastY = 0;

    // The Physics Loop
    onMount(() => {
        let frame;
        const loop = () => {
            let needsUpdate = false;

            icons.forEach((icon, i) => {
                const node = nodes[i];
                if (!node || icon.dragging) return;

                // Only apply physics if there is kinetic energy
                if (Math.abs(icon.vx) > 0.1 || Math.abs(icon.vy) > 0.1) {
                    icon.x += icon.vx;
                    icon.y += icon.vy;
                    
                    // Friction (slows them down over time)
                    icon.vx *= 0.95;
                    icon.vy *= 0.95;

                    // Boundary Bouncing
                    const rect = node.getBoundingClientRect();
                    
                    // Left & Right walls
                    if (rect.left < 0) { 
                        icon.x -= rect.left; 
                        icon.vx *= -0.8; // Reverse direction and lose 20% energy
                    } else if (rect.right > window.innerWidth) { 
                        icon.x -= (rect.right - window.innerWidth); 
                        icon.vx *= -0.8; 
                    }
                    
                    // Top & Bottom walls
                    if (rect.top < 0) { 
                        icon.y -= rect.top; 
                        icon.vy *= -0.8; 
                    } else if (rect.bottom > window.innerHeight) { 
                        icon.y -= (rect.bottom - window.innerHeight); 
                        icon.vy *= -0.8; 
                    }
                    needsUpdate = true;
                }
            });

            if (needsUpdate) icons = icons; // Trigger Svelte reactivity
            frame = requestAnimationFrame(loop);
        };
        
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    });

    // Pointer Events for Dragging
    function pointerDown(e, index) {
        dragTarget = index;
        icons[index].dragging = true;
        icons[index].vx = 0;
        icons[index].vy = 0;
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Boost z-index while dragging
        nodes[index].style.zIndex = '1000';
    }

    function pointerMove(e) {
        if (dragTarget === null) return;
        
        const icon = icons[dragTarget];
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        icon.x += dx;
        icon.y += dy;
        
        // Store velocity based on how fast the mouse is moving
        icon.vx = dx * 0.8;
        icon.vy = dy * 0.8;
        
        lastX = e.clientX;
        lastY = e.clientY;
        icons = icons;
    }

    function pointerUp() {
        if (dragTarget === null) return;
        
        icons[dragTarget].dragging = false;
        nodes[dragTarget].style.zIndex = '1';
        dragTarget = null;
        icons = icons;
    }
</script>

<svelte:window on:pointermove={pointerMove} on:pointerup={pointerUp} />

<div class="skills-bar">
    {#each icons as icon, i}
        <!-- 
          The outer wrapper handles the physics positioning.
          This prevents our movement transform from overriding your hover scale effect in CSS.
        -->
        <div 
            bind:this={nodes[i]}
            class="physics-wrapper"
            style="transform: translate3d({icon.x}px, {icon.y}px, 0);"
            on:pointerdown={(e) => pointerDown(e, i)}
        >
            <div 
                class="skill-icon-wrapper {icon.dragging ? 'is-dragging' : ''}" 
                data-tooltip={icon.tooltip}
            >
                <i class="{icon.class} skill-icon {icon.colorClass}"></i>
            </div>
        </div>
    {/each}
</div>

<style>
    .physics-wrapper {
        /* Prevents the browser from trying to scroll the page when dragging on mobile */
        touch-action: none; 
        cursor: grab;
        position: relative;
        z-index: 1;
    }

    .physics-wrapper:active {
        cursor: grabbing;
    }

    /* Hide the tooltip while the user is actively throwing the icon */
    .is-dragging::after {
        display: none !important;
    }
</style>