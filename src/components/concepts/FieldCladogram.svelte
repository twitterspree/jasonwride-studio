<script>
    import { onMount } from 'svelte';

    let { treeData, traitInfo = {} } = $props();

    const ROW = 22;
    const COL = 105;
    const PAD = 16;

    // --- Layout: classic left-to-right cladogram --------------------------------
    const nodes = [];
    const links = [];
    const traits = new Set();
    let leafCount = 0;

    function build(node, depth = 0, parent = null) {
        const n = { name: node.name, depth, parent, own: node.traits ?? [], children: [], lineage: new Set() };
        n.own.forEach((t) => traits.add(t));
        nodes.push(n);
        if (parent) links.push({ from: parent, to: n });
        if (!node.children?.length) {
            n.leaf = true;
            n.row = leafCount++;
        } else {
            node.children.forEach((c) => n.children.push(build(c, depth + 1, n)));
            n.row = (n.children[0].row + n.children[n.children.length - 1].row) / 2;
        }
        // A node "has" a trait for highlighting if it or any descendant (or ancestor) carries it
        return n;
    }
    const root = build(treeData);
    const maxDepth = Math.max(...nodes.map((n) => n.depth));

    function collect(n, inherited = []) {
        const mine = [...inherited, ...n.own];
        if (n.leaf) mine.forEach((t) => n.lineage.add(t));
        n.children.forEach((c) => collect(c, mine).forEach((t) => n.lineage.add(t)));
        return n.lineage;
    }
    collect(root);

    const x = (n) => PAD + (n.leaf ? maxDepth : n.depth) * COL;
    const y = (n) => PAD + n.row * ROW;
    const width = PAD * 2 + maxDepth * COL + 190;
    const height = PAD * 2 + (leafCount - 1) * ROW;

    // Deterministic wobble so the lines look hand-drawn but stable
    const wob = (i, k) => Math.sin(i * 12.99 + k * 78.2) * 1.6;
    function sketch(link, i) {
        const x1 = x(link.from), y1 = y(link.from), x2 = x(link.to), y2 = y(link.to);
        const my = (y1 + y2) / 2;
        return `M${x1} ${y1} Q${x1 + wob(i, 1)} ${my} ${x1 + wob(i, 2) * 0.3} ${y2} Q${(x1 + x2) / 2} ${y2 + wob(i, 3)} ${x2} ${y2}`;
    }

    const traitList = [...traits].sort();
    const pretty = (t) => t.replaceAll('_', ' ');

    let selected = $state(null);
    let drawn = $state(false);
    let svg;

    const lit = (n) => selected && n.lineage.has(selected);

    onMount(() => {
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                drawn = true;
                io.disconnect();
            }
        }, { threshold: 0.15 });
        io.observe(svg);
        return () => io.disconnect();
    });
</script>

<div class="sketchbook">
    <div class="tabs" role="group" aria-label="Highlight a trait">
        {#each traitList as t, i}
            <button
                class="tab"
                class:on={selected === t}
                style:--tilt="{((i % 3) - 1) * 1.5}deg"
                aria-pressed={selected === t}
                onclick={() => (selected = selected === t ? null : t)}>{pretty(t)}</button
            >
        {/each}
    </div>

    <div class="paper-scroll">
        <svg
            bind:this={svg}
            class:drawn
            viewBox="0 0 {width} {height}"
            width={width}
            height={height}
            role="img"
            aria-label="Hand-drawn cladogram from LUCA to {leafCount} living groups"
        >
            {#each links as link, i}
                <path
                    d={sketch(link, i)}
                    pathLength="1"
                    class="branch"
                    class:lit={lit(link.to)}
                    style:--d="{link.to.depth * 0.18 + (i % 5) * 0.03}s"
                />
            {/each}
            {#each nodes as n}
                {#if n.leaf}
                    <circle cx={x(n)} cy={y(n)} r={lit(n) ? 4.5 : 3} class="dot" class:lit={lit(n)} />
                    <text x={x(n) + 10} y={y(n) + 5} class="leaf" class:lit={lit(n)}>{n.name}</text>
                {:else if n.depth > 0}
                    <text x={x(n) - 4} y={y(n) - 6} class="clade" text-anchor="end">{n.name}</text>
                {:else}
                    <text x={x(n) + 2} y={y(n) - 8} class="clade">LUCA</text>
                {/if}
            {/each}
        </svg>
    </div>

    <p class="margin-note" aria-live="polite">
        {#if selected && traitInfo[selected]}
            <strong>{traitInfo[selected].title}.</strong> {traitInfo[selected].description}
        {:else}
            ← pick a trait tab — the lineages that evolved it get traced in green pencil.
        {/if}
    </p>
</div>

<style>
    .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 1rem;
    }
    .tab {
        font-family: 'Kalam', cursive;
        font-size: 0.95rem;
        text-transform: lowercase;
        padding: 0.15rem 0.75rem 0.1rem;
        background: #f6e7a8;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 4px 4px 0 0;
        color: #3d3423;
        transform: rotate(var(--tilt));
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.3, 1.7, 0.5, 1), background 0.2s;
    }
    .tab:nth-child(3n + 1) { background: #cfe6c2; }
    .tab:nth-child(3n + 2) { background: #f3cbb8; }
    .tab:hover { transform: rotate(0deg) translateY(-3px); }
    .tab.on { background: #2f6b3a; color: #fffdf7; transform: translateY(-4px); }

    .paper-scroll { overflow-x: auto; }
    svg { display: block; max-width: 100%; height: auto; overflow: visible; }

    .branch {
        fill: none;
        stroke: #4b4538;
        stroke-width: 1.3;
        stroke-linecap: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        opacity: 0.85;
        transition: stroke 0.3s, stroke-width 0.3s;
    }
    .drawn .branch {
        animation: draw 0.9s ease forwards;
        animation-delay: var(--d);
    }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    .branch.lit { stroke: #2f8a3e; stroke-width: 3; opacity: 1; }

    .dot { fill: #4b4538; transition: r 0.2s, fill 0.2s; }
    .dot.lit { fill: #2f8a3e; }

    .leaf { font-family: 'Kalam', cursive; font-size: 14px; fill: #3d3423; transition: fill 0.2s; }
    .leaf.lit { fill: #1f6a2c; font-weight: 700; }
    .clade { font-family: 'Courier Prime', monospace; font-size: 10px; fill: #8a7d63; letter-spacing: 0.04em; }

    .margin-note {
        margin-top: 1rem;
        font-family: 'Kalam', cursive;
        font-size: 1.05rem;
        line-height: 1.45;
        color: #2c5a8c;
        max-width: 60ch;
    }
    .margin-note strong { color: #1f2a1c; }
</style>
