<script>
  import { onMount } from 'svelte';

  export let treeData;

  let canvas;
  let ctx;
  let hoveredNode = null;
  let selectedTrait = null;
  let availableTraits = [];

  let nodes = [];
  let links = [];
  let leafCount = 0;
  let maxDepth = 0;

  function inspectTraits(node) {
    if (node.traits) {
      node.traits.forEach(t => {
        if (!availableTraits.includes(t)) availableTraits.push(t);
      });
    }
    if (node.children) node.children.forEach(inspectTraits);
  }

  function parseHierarchy(node, depth = 0, parent = null, inheritedTraits = []) {
    maxDepth = Math.max(maxDepth, depth);
    const combinedTraits = Array.from(new Set([...inheritedTraits, ...(node.traits || [])]));

    const treeNode = {
      name: node.name,
      depth,
      parent,
      traits: combinedTraits,
      children: [],
      angle: 0,
      radius: 0,
      x: 0,
      y: 0
    };

    nodes.push(treeNode);
    if (parent) links.push({ source: parent, target: treeNode });

    if (!node.children || node.children.length === 0) {
      treeNode.isLeaf = true;
      treeNode.leafIndex = leafCount++;
    } else {
      treeNode.isLeaf = false;
      node.children.forEach(child => {
        treeNode.children.push(parseHierarchy(child, depth + 1, treeNode, combinedTraits));
      });
    }
    return treeNode;
  }

  function assignAngles(node) {
    if (node.isLeaf) {
      node.angle = (node.leafIndex / leafCount) * (Math.PI * 2) - Math.PI / 2;
      return node.angle;
    }
    let sum = 0;
    node.children.forEach(child => (sum += assignAngles(child)));
    node.angle = sum / node.children.length;
    return node.angle;
  }

  function isNodeHighlighted(node) {
    if (selectedTrait) return node.traits.includes(selectedTrait);
    if (hoveredNode) {
      let curr = hoveredNode;
      while (curr) {
        if (curr === node) return true;
        curr = curr.parent;
      }
      return false;
    }
    return false;
  }

  function render(width, height) {
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Generous horizontal padding prevents labels from clipping canvas boundaries
    const padX = 170;
    const padY = 50;
    const maxRadius = Math.min(centerX - padX, centerY - padY);
    const internalRadiusMax = maxRadius * 0.78;
    const depthStep = internalRadiusMax / Math.max(1, maxDepth);

    // Geometry normalization: All leaves snap to maxRadius
    nodes.forEach(n => {
      if (n.depth === 0) {
        n.radius = 0;
      } else if (n.isLeaf) {
        n.radius = maxRadius;
      } else {
        n.radius = n.depth * depthStep;
      }
      n.x = centerX + n.radius * Math.cos(n.angle);
      n.y = centerY + n.radius * Math.sin(n.angle);
    });

    // 1. Concentric Ancestral Orbit Guides
    for (let i = 1; i <= maxDepth; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, i * depthStep, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Outer perimeter guideline for extant species
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Cladogram Branch Routing
    links.forEach(({ source, target }) => {
      const active =
        (selectedTrait && target.traits.includes(selectedTrait)) ||
        (hoveredNode && isNodeHighlighted(target) && isNodeHighlighted(source));

      ctx.beginPath();

      if (source.depth === 0) {
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
      } else {
        const counterClockwise = target.angle < source.angle;
        ctx.arc(centerX, centerY, source.radius, source.angle, target.angle, counterClockwise);
        ctx.lineTo(target.x, target.y);
      }

      ctx.strokeStyle = active ? '#FF9248' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = active ? 2.5 : 1;
      if (active) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FF9248';
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // 3. Extant Species & Clade Nodes
    nodes.forEach(n => {
      const active = isNodeHighlighted(n);
      if (n.depth === 0) return;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.isLeaf ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#5FBFF9' : n.isLeaf ? '#FFFFFF' : '#4E576D';
      if (active) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#5FBFF9';
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clean horizontal label rendering on outer perimeter
      if (n.isLeaf) {
        const isRight = Math.cos(n.angle) >= 0;
        const offset = isRight ? 12 : -12;

        ctx.textAlign = isRight ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.font = active ? '600 12px Rubik, sans-serif' : '400 11px Rubik, sans-serif';
        ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(n.name, n.x + offset, n.y);
      }
    });

    // 4. Central Root Hub
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0E17';
    ctx.fill();
    ctx.strokeStyle = isNodeHighlighted(nodes[0]) ? '#5FBFF9' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 9px Rubik, sans-serif';
    ctx.fillStyle = isNodeHighlighted(nodes[0]) ? '#5FBFF9' : '#8E9BB0';
    ctx.fillText('LUCA', centerX, centerY);
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    inspectTraits(treeData);
    availableTraits.sort();

    const root = parseHierarchy(treeData);
    assignAngles(root);

    const handleResize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayHeight = Math.max(760, Math.min(rect.width * 0.85, 900));
      canvas.width = rect.width * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
      render(rect.width, displayHeight);
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = null;
      for (const node of nodes) {
        const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
        // Slightly larger target radius for leaf labels
        if (dist < 18 || (node.isLeaf && Math.abs(node.y - mouseY) < 10 && Math.abs(node.x - mouseX) < 80)) {
          found = node;
          break;
        }
      }

      if (found !== hoveredNode) {
        hoveredNode = found;
        const displayHeight = Math.max(760, Math.min(rect.width * 0.85, 900));
        render(rect.width, displayHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', () => {
      hoveredNode = null;
      const rect = canvas.parentElement.getBoundingClientRect();
      const displayHeight = Math.max(760, Math.min(rect.width * 0.85, 900));
      render(rect.width, displayHeight);
    });

    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  function selectTrait(trait) {
    selectedTrait = selectedTrait === trait ? null : trait;
    const rect = canvas.parentElement.getBoundingClientRect();
    const displayHeight = Math.max(760, Math.min(rect.width * 0.85, 900));
    render(rect.width, displayHeight);
  }
</script>

<div class="radial-tree-wrapper">
  <div class="trait-strip">
    {#each availableTraits as trait}
      <button 
        class="trait-chip {selectedTrait === trait ? 'active' : ''}" 
        on:click={() => selectTrait(trait)}
      >
        {trait.replace('_', ' ')}
      </button>
    {/each}
  </div>

  <div class="canvas-box">
    <canvas bind:this={canvas}></canvas>
  </div>

  <div class="status-hud">
    {#if hoveredNode}
      <span class="hud-name">{hoveredNode.name}</span>
      <span class="hud-meta">
        {hoveredNode.traits.length > 0 
          ? `Traits: ${hoveredNode.traits.map(t => t.replace('_', ' ')).join(', ')}` 
          : 'Ancestral Node'}
      </span>
    {:else if selectedTrait}
      <span class="hud-name">{selectedTrait.replace('_', ' ')}</span>
      <span class="hud-meta">Highlighting independently evolved lineages</span>
    {:else}
      <span class="hud-idle">Hover over any species or select a trait above to trace its convergence.</span>
    {/if}
  </div>
</div>

<style>
  .radial-tree-wrapper {
    background: #0B0E17;
    border-radius: 24px;
    padding: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    margin: 2rem 0;
  }

  .trait-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .trait-chip {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #99A1B3;
    padding: 0.4rem 0.9rem;
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
    background: rgba(255, 146, 72, 0.18);
    border-color: #FF9248;
    color: #FF9248;
    box-shadow: 0 0 14px rgba(255, 146, 72, 0.35);
  }

  .canvas-box {
    width: 100%;
    position: relative;
    display: flex;
    justify-content: center;
  }

  canvas {
    display: block;
    width: 100% !important;
    height: auto !important;
    cursor: crosshair;
  }

  .status-hud {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 2.2rem;
    font-size: 0.85rem;
  }

  .hud-name {
    color: #5FBFF9;
    font-weight: 600;
  }

  .hud-meta {
    color: #AAA;
    text-transform: capitalize;
  }

  .hud-idle {
    color: #667;
    margin: 0 auto;
    font-size: 0.8rem;
  }

  @media (max-width: 768px) {
    .status-hud {
      flex-direction: column;
      gap: 0.3rem;
      text-align: center;
    }
  }
</style>