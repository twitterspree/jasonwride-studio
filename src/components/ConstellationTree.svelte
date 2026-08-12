<script>
    import { onMount } from 'svelte';
    import * as THREE from 'three';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

    export let treeData;

    let container;

    onMount(() => {
        // 1. Scene & Camera Setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e1a);
        scene.fog = new THREE.FogExp2(0x0a0e1a, 0.003);

        const camera = new THREE.PerspectiveCamera(
            60, 
            container.clientWidth / container.clientHeight, 
            0.1, 
            1000
        );
        camera.position.set(0, 30, 110);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // 2. Lighting Setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x5fbff9, 2, 200);
        pointLight.position.set(0, 0, 0);
        scene.add(pointLight);

        // Helper function to create 3D Text Canvas Sprites
        function createTextSprite(text) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            ctx.font = 'Bold 24px Rubik, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 128, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(20, 5, 1);
            return sprite;
        }

        // 3. Geometry & Math
        const nodesData = [];
        const linePositions = [];

        function getDepth(node) {
            if (!node.children || node.children.length === 0) return 1;
            return 1 + Math.max(...node.children.map(getDepth));
        }

        const maxDepth = getDepth(treeData);

        function processNode(node, depth, maxDepth, thetaStart, thetaEnd, phiStart, phiEnd, parentPos = null) {
            const r = (depth / maxDepth) * 60; 
            const theta = (thetaStart + thetaEnd) / 2;
            const phi = (phiStart + phiEnd) / 2;

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.cos(phi);
            const z = r * Math.sin(phi) * Math.sin(theta);
            const currentPos = new THREE.Vector3(x, y, z);

            nodesData.push({ name: node.name, pos: currentPos, isLeaf: !node.children || node.children.length === 0 });

            if (parentPos) {
                linePositions.push(parentPos.x, parentPos.y, parentPos.z);
                linePositions.push(currentPos.x, currentPos.y, currentPos.z);
            }

            if (node.children && node.children.length > 0) {
                const childCount = node.children.length;
                const thetaStep = (thetaEnd - thetaStart) / childCount;

                node.children.forEach((child, i) => {
                    processNode(
                        child, 
                        depth + 1, 
                        maxDepth, 
                        thetaStart + i * thetaStep, 
                        thetaStart + (i + 1) * thetaStep, 
                        phiStart, 
                        phiEnd, 
                        currentPos
                    );
                });
            }
        }

        processNode(treeData, 0, maxDepth, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.8);

        // 4. Render 3D Sphere Meshes + Text Labels
        const sphereGeo = new THREE.SphereGeometry(1.8, 16, 16);
        const nodeMaterial = new THREE.MeshStandardMaterial({
            color: 0x5fbff9,
            emissive: 0x2288cc,
            roughness: 0.2,
            metalness: 0.8
        });

        nodesData.forEach(item => {
            // Draw Sphere
            const sphere = new THREE.Mesh(sphereGeo, nodeMaterial);
            sphere.position.copy(item.pos);
            scene.add(sphere);

            // Draw Sprite Label
            const label = createTextSprite(item.name === "LUCA (Last Universal Common Ancestor)" ? "LUCA" : item.name);
            label.position.set(item.pos.x, item.pos.y + 4, item.pos.z);
            scene.add(label);
        });

        // 5. Render Lines (Branches)
        const linesGeometry = new THREE.BufferGeometry();
        linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const linesMaterial = new THREE.LineBasicMaterial({
            color: 0xff9248,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
        scene.add(linesMesh);

        // 6. Render Loop
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            scene.rotation.y += 0.001; 
            renderer.render(scene, camera);
        };
        animate();

        // 7. Resize Handler
        const handleResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        };
    });
</script>

<div class="constellation-container" bind:this={container}></div>

<style>
    .constellation-container {
        width: 100%;
        height: 650px;
        border-radius: 30px;
        overflow: hidden;
        background: #0a0e1a;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
</style>