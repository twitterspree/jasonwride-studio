<script>
    import { onMount } from 'svelte';
    import { siTypescript, siSvelte, siSwift, siPython } from 'simple-icons';

    const CAMERA_PATH =
        'M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z';

    let icons = $state([
        { id: 'ts', path: siTypescript.path, color: `#${siTypescript.hex}`, label: 'TypeScript' },
        { id: 'svelte', path: siSvelte.path, color: `#${siSvelte.hex}`, label: 'Svelte' },
        { id: 'swift', path: siSwift.path, color: `#${siSwift.hex}`, label: 'Swift & SwiftUI' },
        { id: 'python', path: siPython.path, color: `#${siPython.hex}`, label: 'Python' },
        { id: 'photo', path: CAMERA_PATH, color: 'var(--accent-color)', label: 'Photography' }
    ].map((icon) => ({ ...icon, x: 0, y: 0, vx: 0, vy: 0, dragging: false })));

    let nodes = $state([]);
    let bar;
    let dragTarget = null;
    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;
    let frame = 0;

    // Icons bounce off the hero section's edges rather than the viewport,
    // so scrolling mid-throw doesn't make them jump.
    function bounds() {
        const hero = bar?.closest('[data-skill-bounds], .hero-container');
        const r = hero?.getBoundingClientRect();
        return r ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    }

    function step() {
        let moving = false;
        const b = bounds();

        icons.forEach((icon, i) => {
            const node = nodes[i];
            if (!node || icon.dragging) return;
            if (Math.abs(icon.vx) < 0.1 && Math.abs(icon.vy) < 0.1) return;

            icon.x += icon.vx;
            icon.y += icon.vy;
            icon.vx *= 0.95; // friction
            icon.vy *= 0.95;

            const rect = node.getBoundingClientRect();
            if (rect.left < b.left) { icon.x += b.left - rect.left; icon.vx *= -0.8; }
            else if (rect.right > b.right) { icon.x -= rect.right - b.right; icon.vx *= -0.8; }
            if (rect.top < b.top) { icon.y += b.top - rect.top; icon.vy *= -0.8; }
            else if (rect.bottom > b.bottom) { icon.y -= rect.bottom - b.bottom; icon.vy *= -0.8; }

            moving = true;
        });

        // Only keep the loop alive while something is actually coasting
        frame = moving ? requestAnimationFrame(step) : 0;
    }

    function kick() {
        if (!frame) frame = requestAnimationFrame(step);
    }

    onMount(() => () => cancelAnimationFrame(frame));

    function pointerDown(e, index) {
        dragTarget = index;
        dragMoved = false;
        const icon = icons[index];
        icon.dragging = true;
        icon.vx = 0;
        icon.vy = 0;
        lastX = e.clientX;
        lastY = e.clientY;
    }

    function pointerMove(e) {
        if (dragTarget === null) return;
        const icon = icons[dragTarget];
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 0) dragMoved = true;

        icon.x += dx;
        icon.y += dy;
        // Remember throw velocity from the last pointer movement
        icon.vx = dx * 0.8;
        icon.vy = dy * 0.8;
        lastX = e.clientX;
        lastY = e.clientY;
    }

    function pointerUp() {
        if (dragTarget === null) return;
        icons[dragTarget].dragging = false;
        dragTarget = null;
        kick();
    }

    // Keyboard fun: arrow keys give the focused icon a shove; Home resets it
    const NUDGE = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    function keyDown(e, index) {
        const icon = icons[index];
        if (e.key === 'Home') {
            icon.x = icon.y = icon.vx = icon.vy = 0;
            e.preventDefault();
            return;
        }
        const n = NUDGE[e.key];
        if (!n) return;
        e.preventDefault();
        icon.vx += n[0];
        icon.vy += n[1];
        kick();
    }
</script>

<svelte:window onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={pointerUp} />

<ul class="skills-bar" bind:this={bar} aria-label="Skills">
    {#each icons as icon, i (icon.id)}
        <li
            bind:this={nodes[i]}
            class="physics-wrapper"
            class:is-dragging={icon.dragging}
            style:transform="translate3d({icon.x}px, {icon.y}px, 0)"
        >
            <button
                class="skill-icon-wrapper"
                data-tooltip={icon.label}
                aria-label="{icon.label} (drag or use arrow keys to throw)"
                onpointerdown={(e) => pointerDown(e, i)}
                onkeydown={(e) => keyDown(e, i)}
                onclick={(e) => dragMoved && e.preventDefault()}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" style:fill={icon.color}>
                    <path d={icon.path} />
                </svg>
            </button>
        </li>
    {/each}
</ul>

<style>
    .skills-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        margin-bottom: 3rem;
        list-style: none;
    }

    .physics-wrapper {
        position: relative;
        z-index: 1;
        /* Stops the page scrolling when dragging on touch screens */
        touch-action: none;
    }

    .physics-wrapper.is-dragging {
        z-index: 1000;
    }

    .skill-icon-wrapper {
        position: relative;
        width: 60px;
        height: 60px;
        border: 1px solid var(--border-subtle);
        border-radius: 50%;
        background: var(--card-bg);
        box-shadow: var(--shadow-soft);
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: grab;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
    }

    .is-dragging .skill-icon-wrapper {
        cursor: grabbing;
    }

    .skill-icon-wrapper svg {
        width: 28px;
        height: 28px;
    }

    .skill-icon-wrapper:hover,
    .skill-icon-wrapper:focus-visible {
        transform: scale(1.15) rotate(5deg);
        box-shadow: 0 15px 35px var(--accent-glow);
    }

    /* Tooltip */
    .skill-icon-wrapper::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: -40px;
        left: 50%;
        transform: translateX(-50%) scale(0);
        background-color: var(--text-base);
        color: var(--bg-base);
        padding: 0.5rem 1rem;
        border-radius: 15px;
        font: 500 0.85rem 'Rubik', sans-serif;
        white-space: nowrap;
        opacity: 0;
        transition: all 0.3s ease;
        pointer-events: none;
    }

    .skill-icon-wrapper:hover::after,
    .skill-icon-wrapper:focus-visible::after {
        transform: translateX(-50%) scale(1);
        opacity: 1;
        bottom: -50px;
    }

    /* Hide the tooltip while the icon is being thrown around */
    .is-dragging .skill-icon-wrapper::after {
        display: none;
    }

    @media (max-width: 900px) {
        .skills-bar {
            justify-content: center;
        }
    }
</style>
