<script>
    import { onMount } from 'svelte';

    export let treeData;

    let canvas;
    let ctx;
    let width = 800;
    let height = 600;

    let activeTrait = null;
    let uniqueTraits = [];

    let nodes = [];
    let links = [];
    let maxDepth = 0;
    let leafCount = 0;

    // --- CONTEXTUAL DATA FOR THE SIDE PANEL ---
    // In a full production app, this would come from your Python/JSON pipeline.
    const traitDictionary = {
        "camera_eye": {
            title: "The Camera Eye",
            description: "A hollow eye with a lens that focuses light onto a retina. This highly complex structure evolved completely independently in vertebrates and cephalopods.",
            showdown: [
                { species: "Humans", detail: "Our retinal wiring sits in front of the light receptors, creating a blind spot where the optic nerve exits." },
                { species: "Octopuses", detail: "Their retinal wiring sits behind the receptors. Same camera design, but highly optimized with zero blind spot." }
            ]
        },
        "exoskeleton": {
            title: "The Exoskeleton",
            description: "A rigid external covering for the body, providing both support and protection.",
            showdown: [
                { species: "Arthropods", detail: "Constructed from chitin. Must be molted entirely for the animal to grow." }
            ]
        },
        "bioluminescence": {
            title: "Bioluminescence",
            description: "The biochemical emission of light by living organisms. This has evolved independently at least 40 different times in nature.",
            showdown: [
                { species: "Fireflies", detail: "Use luciferin and oxygen to create flashes for mating signals in the air." },
                { species: "Ghost Fungus", detail: "Emits a continuous green glow, likely to attract insects that help disperse its spores." }
            ]
        },
        "limbs": {
            title: "Jointed Limbs",
            description: "Appendages used for locomotion. The underlying genetic instructions are surprisingly similar, even if the evolutionary paths diverged hundreds of millions of years ago.",
            showdown: [
                { species: "Vertebrates", detail: "Internal bone structure driven by muscles attached to the outside of the skeleton." },
                { species: "Arthropods", detail: "External shell structure driven by muscles attached to the inside of the exoskeleton." }
            ]
        }
    };

    onMount(() => {
        ctx = canvas.getContext('2d');
        
        extractTraits(treeData);
        uniqueTraits = uniqueTraits.sort();
        
        // Pass empty array to start trait inheritance
        const root = buildTree(treeData, 0, null, []); 
        calculateY(root);

        const resize = () => {
            width = canvas.parentElement.clientWidth;
            height = canvas.parentElement.clientHeight || 600;
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            draw();
        };

        window.addEventListener('resize', resize);
        resize(); 
        
        return () => window.removeEventListener('resize', resize);
    });

    // --- DATA PARSING & MATH ---

    function extractTraits(node) {
        if (node.traits) {
            node.traits.forEach(t => {
                if (!uniqueTraits.includes(t)) uniqueTraits.push(t);
            });
        }
        if (node.children) node.children.forEach(extractTraits);
    }

    // Fixed to inherit parent traits down the tree
    function buildTree(node, depth, parent, parentTraits = []) {
        maxDepth = Math.max(maxDepth, depth);
        
        const combinedTraits = Array.from(new Set([...parentTraits, ...(node.traits || [])]));
        
        let rNode = { 
            name: node.name, 
            traits: combinedTraits, 
            depth: depth, 
            parent: parent, 
            children: [] 
        };
        
        nodes.push(rNode);
        if (parent) links.push({ source: parent, target: rNode });

        if (!node.children || node.children.length === 0) {
            rNode.isLeaf = true;
            rNode.yIndex = leafCount++;
        } else {
            rNode.isLeaf = false;
            node.children.forEach(child => {
                rNode.children.push(buildTree(child, depth + 1, rNode, combinedTraits));
            });
        }
        return rNode;
    }

    function calculateY(node) {
        if (node.isLeaf) return node.yIndex;
        let sum = 0;
        node.children.forEach(child => sum += calculateY(child));
        node.yIndex = sum / node.children.length;
        return node.yIndex;
    }

    function pathHasTrait(node, trait) {
        if (!trait) return true; 
        if (node.traits.includes(trait)) return true;
        if (node.children.length > 0) {
            return node.children.some(child => pathHasTrait(child, trait));
        }
        return false;
    }

    // --- RENDER LOOP ---

    function draw() {
        ctx.clearRect(0, 0, width, height);
        
        // Asymmetric padding: small padding on the left, more room on the right for leaf text
        const padLeft = 60; 
        const padRight = 140;
        const padY = 60;
        
        const dx = (width - padLeft - padRight) / maxDepth;
        const dy = (height - padY * 2) / Math.max(1, leafCount - 1);

        nodes.forEach(n => {
            n.x = padLeft + n.depth * dx;
            n.y = padY + n.yIndex * dy;
            n.isHighlighted = activeTrait ? pathHasTrait(n, activeTrait) : false;
        });

        // 1. Draw Links (Branches)
        links.forEach(link => {
            const isHighlighted = activeTrait ? (link.target.isHighlighted && pathHasTrait(link.target, activeTrait)) : true;
            
            ctx.beginPath();
            ctx.moveTo(link.source.x, link.source.y);
            const midX = (link.source.x + link.target.x) / 2;
            ctx.bezierCurveTo(midX, link.source.y, midX, link.target.y, link.target.x, link.target.y);

            ctx.shadowBlur = isHighlighted && activeTrait ? 12 : 0;
            ctx.shadowColor = isHighlighted ? '#FF9248' : 'transparent';
            
            ctx.lineWidth = isHighlighted ? 3 : 1;
            ctx.strokeStyle = isHighlighted ? '#FF9248' : 'rgba(255,255,255,0.12)';
            ctx.stroke();
            
            ctx.shadowBlur = 0;
        });

        // 2. Draw Nodes & Labels
        nodes.forEach(n => {
            const isHighlighted = activeTrait ? n.isHighlighted : true;
            
            // Draw Dot
            ctx.shadowBlur = isHighlighted && activeTrait ? 15 : 0;
            ctx.shadowColor = isHighlighted ? '#5FBFF9' : 'transparent';

            ctx.beginPath();
            ctx.arc(n.x, n.y, isHighlighted ? 6 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = isHighlighted ? '#5FBFF9' : '#334';
            ctx.fill();
            ctx.shadowBlur = 0;

            // Draw Label
            ctx.fillStyle = isHighlighted ? '#FFF' : 'rgba(255,255,255,0.35)';
            ctx.font = isHighlighted ? 'bold 12px Rubik, sans-serif' : '12px Rubik, sans-serif';

            if (n.isLeaf) {
                // End species (Humans, Octopuses, etc.): Align text to the right of the dot
                ctx.textAlign = 'left';
                ctx.fillText(n.name, n.x + 12, n.y + 4);
            } else {
                // Internal nodes (LUCA, Eukarya, Animals, etc.): Center text ABOVE the dot
                ctx.textAlign = 'center';
                // Shorten the root display name so it fits cleanly
                const displayName = n.depth === 0 ? "LUCA" : n.name;
                ctx.fillText(displayName, n.x, n.y - 12);
            }
        });
    }

    function toggleTrait(trait) {
        activeTrait = activeTrait === trait ? null : trait;
        draw();
    }
</script>

<div class="app-layout">
    <div class="controls">
        <div class="trait-buttons">
            {#each uniqueTraits as trait}
                <button 
                    class="trait-btn {activeTrait === trait ? 'active' : ''}" 
                    on:click={() => toggleTrait(trait)}>
                    {trait.replace('_', ' ')}
                </button>
            {/each}
        </div>
    </div>

    <div class="visualizer-grid">
        <div class="canvas-wrapper">
            <canvas bind:this={canvas}></canvas>
        </div>

        <div class="info-panel">
            {#if activeTrait && traitDictionary[activeTrait]}
                <div class="panel-content">
                    <h2>{traitDictionary[activeTrait].title}</h2>
                    <p class="panel-desc">{traitDictionary[activeTrait].description}</p>
                    
                    <div class="showdown-container">
                        <h3>Evolutionary Showdown</h3>
                        {#each traitDictionary[activeTrait].showdown as item}
                            <div class="showdown-card">
                                <h4>{item.species}</h4>
                                <p>{item.detail}</p>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else if activeTrait}
                <div class="panel-content empty-state">
                    <h3>{activeTrait.replace('_', ' ')}</h3>
                    <p>Details for this convergence are currently being researched.</p>
                </div>
            {:else}
                <div class="panel-content empty-state">
                    <i class="fas fa-dna" style="font-size: 2rem; opacity: 0.5; margin-bottom: 1rem;"></i>
                    <h3>Select a Trait</h3>
                    <p>Click a trait button above to illuminate the branches of life that independently evolved it.</p>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .app-layout {
        background: #0B0F19; /* Deep Space/Sea Dark Mode */
        border-radius: var(--cookie-radius, 30px);
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        padding: 2rem;
        margin: 2rem auto;
        max-width: 1400px;
        color: #FFF;
        overflow: hidden;
    }

    .controls {
        margin-bottom: 2rem;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        padding-bottom: 2rem;
    }

    .trait-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        justify-content: center;
    }

    .trait-btn {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 0.6rem 1.2rem;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 600;
        text-transform: capitalize;
        transition: all 0.3s ease;
        color: #AAA;
    }

    .trait-btn:hover {
        background: rgba(255,255,255,0.1);
        color: #FFF;
    }

    .trait-btn.active {
        background: rgba(255, 146, 72, 0.15); /* Orange tint */
        color: var(--accent-orange, #FF9248);
        border-color: var(--accent-orange, #FF9248);
        box-shadow: 0 0 15px rgba(255, 146, 72, 0.3);
    }

    .visualizer-grid {
        display: grid;
        grid-template-columns: 1fr 350px;
        gap: 2rem;
        min-height: 600px;
    }

    .canvas-wrapper {
        width: 100%;
        position: relative;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }

    /* --- SIDE PANEL STYLING --- */
    .info-panel {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 20px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
    }

    .panel-content h2 {
        color: var(--accent-orange, #FF9248);
        margin-bottom: 1rem;
        font-size: 1.8rem;
        line-height: 1.2;
    }

    .panel-desc {
        color: #CCC;
        line-height: 1.6;
        margin-bottom: 2rem;
        font-size: 0.95rem;
    }

    .showdown-container h3 {
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #888;
        margin-bottom: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        padding-bottom: 0.5rem;
    }

    .showdown-card {
        background: rgba(0,0,0,0.3);
        padding: 1rem;
        border-radius: 12px;
        margin-bottom: 1rem;
        border-left: 3px solid #5FBFF9; /* Blue accent */
    }

    .showdown-card h4 {
        color: #FFF;
        margin-bottom: 0.5rem;
        font-size: 1.1rem;
    }

    .showdown-card p {
        color: #AAA;
        font-size: 0.9rem;
        line-height: 1.5;
    }

    .empty-state {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        color: #666;
    }

    .empty-state h3 {
        color: #888;
        margin-bottom: 0.5rem;
    }

    @media (max-width: 900px) {
        .visualizer-grid {
            grid-template-columns: 1fr;
        }
        .canvas-wrapper {
            height: 400px;
        }
    }
</style>