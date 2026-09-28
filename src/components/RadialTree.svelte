<script>
  import { onMount } from 'svelte';

  let { treeData, traitInfo = {} } = $props();

  const NODE_COLOR = '#5FBFF9';
  const LABEL_FONT = '400 11px Rubik, sans-serif';
  const LABEL_FONT_ACTIVE = '600 12px Rubik, sans-serif';
  // Below this logical width the canvas renders at MIN_WIDTH and is CSS-scaled
  // down, so the layout never collapses (pinch-zoom works for detail).
  const MIN_WIDTH = 620;

  let canvas;
  let box;
  let ctx;

  let hoveredNode = $state(null);
  let pinnedNode = $state(null); // tap-to-inspect on touch screens
  let selectedTrait = $state(null);

  // --- Build the hierarchy once ------------------------------------------------
  const nodes = [];
  const links = [];
  let leafCount = 0;
  let maxDepth = 0;
  const traitSet = new Set();

  function parse(node, depth = 0, parent = null, inherited = []) {
    maxDepth = Math.max(maxDepth, depth);
    (node.traits ?? []).forEach((t) => traitSet.add(t));
    const treeNode = {
      name: node.name,
      depth,
      parent,
      traits: [...new Set([...inherited, ...(node.traits ?? [])])],
      children: [],
      isLeaf: !node.children?.length,
      angle: 0,
      radius: 0,
      x: 0,
      y: 0
    };
    nodes.push(treeNode);
    if (parent) links.push({ source: parent, target: treeNode });

    if (treeNode.isLeaf) treeNode.leafIndex = leafCount++;
    else node.children.forEach((c) => treeNode.children.push(parse(c, depth + 1, treeNode, treeNode.traits)));
    return treeNode;
  }

  function assignAngles(node) {
    if (node.isLeaf) {
      node.angle = (node.leafIndex / leafCount) * Math.PI * 2 - Math.PI / 2;
    } else {
      node.angle = node.children.reduce((sum, c) => sum + assignAngles(c), 0) / node.children.length;
    }
    return node.angle;
  }

  // Every trait found at or below a node, so selecting a trait lights the
  // whole root-to-species path, not just the nodes that carry it
  function collectLineageTraits(node) {
    node.lineageTraits = new Set(node.traits);
    for (const child of node.children) collectLineageTraits(child).forEach((t) => node.lineageTraits.add(t));
    return node.lineageTraits;
  }

  const root = parse(treeData);
  assignAngles(root);
  collectLineageTraits(root);
  const availableTraits = [...traitSet].sort();
  const leaves = nodes.filter((n) => n.isLeaf);

  const pretty = (t) => t.replaceAll('_', ' ');

  // --- Layout state (logical px) ----------------------------------------------
  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;
  let maxRadius = 0;
  let labelSpace = 0;
  let scale = 1; // logical px per CSS px

  const focusNode = $derived(pinnedNode ?? hoveredNode);
  const info = $derived(selectedTrait ? traitInfo[selectedTrait] : null);

  function isOnFocusPath(node) {
    for (let cur = focusNode; cur; cur = cur.parent) if (cur === node) return true;
    return false;
  }

  function isHighlighted(node) {
    if (selectedTrait) return node.lineageTraits.has(selectedTrait);
    if (focusNode) return isOnFocusPath(node);
    return false;
  }

  function accent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#FF9248';
  }

  function layout() {
    const cssWidth = box.clientWidth;
    W = Math.max(cssWidth, MIN_WIDTH);
    H = Math.min(W, 900);
    scale = W / cssWidth;
    cx = W / 2;
    cy = H / 2;

    ctx.font = LABEL_FONT_ACTIVE;
    labelSpace = Math.max(...leaves.map((n) => ctx.measureText(n.name).width)) + 18;
    maxRadius = Math.max(40, Math.min(cx, cy) - labelSpace - 8);
    const depthStep = (maxRadius * 0.82) / Math.max(1, maxDepth - 1);

    for (const n of nodes) {
      n.radius = n.depth === 0 ? 0 : n.isLeaf ? maxRadius : n.depth * depthStep;
      n.x = cx + n.radius * Math.cos(n.angle);
      n.y = cy + n.radius * Math.sin(n.angle);
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.aspectRatio = `${W} / ${H}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function render() {
    if (!ctx) return;
    const hot = accent();
    ctx.clearRect(0, 0, W, H);

    // Concentric orbit guides for each ancestral depth
    const depthStep = (maxRadius * 0.82) / Math.max(1, maxDepth - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 1; i < maxDepth; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, i * depthStep, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Dashed perimeter for living species
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Branches: arc along the parent's orbit, then a radial spoke out to the child
    for (const { source, target } of links) {
      const active = selectedTrait
        ? target.lineageTraits.has(selectedTrait)
        : focusNode && isOnFocusPath(target) && isOnFocusPath(source);

      ctx.beginPath();
      if (source.depth === 0) {
        ctx.moveTo(source.x, source.y);
      } else {
        ctx.arc(cx, cy, source.radius, source.angle, target.angle, target.angle < source.angle);
      }
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = active ? hot : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = active ? 2.5 : 1;
      ctx.shadowBlur = active ? 10 : 0;
      ctx.shadowColor = hot;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Nodes + radial labels
    for (const n of nodes) {
      if (n.depth === 0) continue;
      const active = isHighlighted(n);

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.isLeaf ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = active ? NODE_COLOR : n.isLeaf ? '#FFFFFF' : '#4E576D';
      ctx.shadowBlur = active ? 10 : 0;
      ctx.shadowColor = NODE_COLOR;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (n.isLeaf) {
        // Rotate labels along their spoke; flip on the left half so text stays upright
        const flip = Math.cos(n.angle) < 0;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(flip ? n.angle + Math.PI : n.angle);
        ctx.textAlign = flip ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.font = active ? LABEL_FONT_ACTIVE : LABEL_FONT;
        ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(n.name, flip ? -10 : 10, 0);
        ctx.restore();
      }
    }

    // Central LUCA hub
    const rootActive = isHighlighted(root);
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0E17';
    ctx.fill();
    ctx.strokeStyle = rootActive ? NODE_COLOR : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 9px Rubik, sans-serif';
    ctx.fillStyle = rootActive ? NODE_COLOR : '#8E9BB0';
    ctx.fillText('LUCA', cx, cy);
  }

  // Map a pointer event to the node under it (dots, or a leaf's label wedge)
  function nodeAt(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const tolerance = e.pointerType === 'touch' ? 24 : 14;

    let best = null;
    let bestDist = tolerance;
    for (const n of nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    if (best) return best;

    // Anywhere along a leaf's label counts as that leaf
    const r = Math.hypot(x - cx, y - cy);
    if (r > maxRadius - 10 && r < maxRadius + labelSpace) {
      const a = Math.atan2(y - cy, x - cx);
      const slice = (Math.PI * 2) / leafCount;
      for (const n of leaves) {
        const diff = Math.atan2(Math.sin(a - n.angle), Math.cos(a - n.angle));
        if (Math.abs(diff) < slice / 2) return n;
      }
    }
    return null;
  }

  function onPointerMove(e) {
    if (e.pointerType !== 'mouse') return;
    const found = nodeAt(e);
    if (found !== hoveredNode) hoveredNode = found;
  }

  function onPointerLeave() {
    hoveredNode = null;
  }

  function onClick(e) {
    const found = nodeAt(e);
    pinnedNode = found === pinnedNode ? null : found;
  }

  function selectTrait(trait) {
    selectedTrait = selectedTrait === trait ? null : trait;
    pinnedNode = null;
  }

  // Redraw whenever highlight state changes
  $effect(() => {
    focusNode;
    selectedTrait;
    render();
  });

  onMount(() => {
    ctx = canvas.getContext('2d');
    const ro = new ResizeObserver(() => layout());
    ro.observe(box);
    // Web font may land after first paint; re-measure labels when it does
    document.fonts?.ready.then(() => layout());
    // Follow ThemeDock accent changes
    const mo = new MutationObserver(() => render());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });
</script>

<div class="radial-tree-wrapper">
  <div class="trait-strip" role="group" aria-label="Filter by trait">
    {#each availableTraits as trait}
      <button class="trait-chip" class:active={selectedTrait === trait} aria-pressed={selectedTrait === trait} onclick={() => selectTrait(trait)}>
        {pretty(trait)}
      </button>
    {/each}
  </div>

  <div class="viz-grid">
    <div class="canvas-box" bind:this={box}>
      <canvas
        bind:this={canvas}
        role="img"
        aria-label="Radial tree of life from LUCA to {leafCount} living groups. Use the trait buttons to highlight lineages; the species list below describes the same data."
        onpointermove={onPointerMove}
        onpointerleave={onPointerLeave}
        onclick={onClick}
      ></canvas>

      <div class="status-hud" aria-live="polite">
        {#if focusNode}
          <span class="hud-name">{focusNode.depth === 0 ? 'LUCA — Last Universal Common Ancestor' : focusNode.name}</span>
          <span class="hud-meta">
            {focusNode.traits.length > 0 ? `Traits: ${focusNode.traits.map(pretty).join(', ')}` : 'No tracked traits'}
          </span>
        {:else}
          <span class="hud-idle">Hover or tap any species to trace its ancestry.</span>
        {/if}
      </div>
    </div>

    <aside class="info-panel" aria-live="polite">
      {#if selectedTrait && info}
        <h2>{info.title}</h2>
        <p class="panel-desc">{info.description}</p>
        {#if info.showdown?.length}
          <h3>Evolutionary Showdown</h3>
          {#each info.showdown as item}
            <div class="showdown-card">
              <h4>{item.species}</h4>
              <p>{item.detail}</p>
            </div>
          {/each}
        {/if}
      {:else if selectedTrait}
        <h2>{pretty(selectedTrait)}</h2>
        <p class="panel-desc">Details for this convergence are still being researched.</p>
      {:else}
        <div class="empty-state">
          <h2>Select a trait</h2>
          <p>Pick a trait above to light up every branch of life that evolved it — then read how each lineage pulled it off.</p>
        </div>
      {/if}
    </aside>
  </div>

  <details class="species-list">
    <summary>Species list ({leafCount})</summary>
    <ul>
      {#each leaves as leaf}
        <li><strong>{leaf.name}</strong>{leaf.traits.length ? ` — ${leaf.traits.map(pretty).join(', ')}` : ''}</li>
      {/each}
    </ul>
  </details>
</div>

<style>
  .radial-tree-wrapper {
    background: #0B0E17;
    color: #E6EAF2;
    border-radius: 24px;
    padding: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    margin: 2rem 0;
    --hot: var(--accent-color, #FF9248);
  }

  .trait-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .trait-chip {
    font: inherit;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #B4BCCB;
    padding: 0.45rem 0.95rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .trait-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #FFF;
  }

  .trait-chip.active {
    background: color-mix(in srgb, var(--hot) 18%, transparent);
    border-color: var(--hot);
    color: var(--hot);
    box-shadow: 0 0 14px color-mix(in srgb, var(--hot) 35%, transparent);
  }

  .viz-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 1.5rem;
    align-items: start;
  }

  .canvas-box {
    min-width: 0;
  }

  canvas {
    display: block;
    width: 100%;
    height: auto;
    cursor: crosshair;
    touch-action: manipulation;
  }

  .status-hud {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.3rem 1rem;
    align-items: center;
    min-height: 2.2rem;
    font-size: 0.85rem;
  }

  .hud-name {
    color: #5FBFF9;
    font-weight: 600;
  }

  .hud-meta {
    color: #B4BCCB;
  }

  .hud-idle {
    color: #8A93A6;
    margin: 0 auto;
    font-size: 0.8rem;
  }

  .info-panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 1.5rem;
    position: sticky;
    top: 1rem;
  }

  .info-panel h2 {
    color: var(--hot);
    margin-bottom: 0.75rem;
    font-size: 1.6rem;
    line-height: 1.2;
    text-transform: capitalize;
  }

  .panel-desc {
    color: #C9CFDA;
    line-height: 1.6;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .info-panel h3 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #8A93A6;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.5rem;
  }

  .showdown-card {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.9rem 1rem;
    border-radius: 12px;
    margin-bottom: 0.75rem;
    border-left: 3px solid #5FBFF9;
  }

  .showdown-card h4 {
    color: #FFF;
    margin-bottom: 0.35rem;
    font-size: 1rem;
  }

  .showdown-card p {
    color: #B4BCCB;
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .empty-state {
    text-align: center;
    color: #8A93A6;
    padding: 2rem 0.5rem;
  }


  .empty-state h2 {
    color: #C9CFDA;
    font-size: 1.2rem;
  }

  .empty-state p {
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .species-list {
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: #B4BCCB;
  }

  .species-list summary {
    cursor: pointer;
    color: #8A93A6;
  }

  .species-list ul {
    columns: 2 220px;
    margin-top: 0.75rem;
    padding-left: 1.2rem;
    line-height: 1.7;
  }

  .species-list li {
    text-transform: none;
  }

  @media (max-width: 960px) {
    .viz-grid {
      grid-template-columns: 1fr;
    }
    .info-panel {
      position: static;
    }
  }

  @media (max-width: 600px) {
    .radial-tree-wrapper {
      padding: 1rem;
      border-radius: 18px;
    }
  }
</style>
