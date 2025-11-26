<script>
    import { onMount } from 'svelte';

    export let src = '';       
    export let depthSrc = '';  
    export let alt = '';

    let canvas;
    let container;

    onMount(() => {
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        // --- 1. Vertex Shader (Updated for Aspect Ratio Fix) ---
        const vertShaderSource = `
            attribute vec2 position;
            varying vec2 vUv;
            uniform vec2 u_corr; // Aspect ratio correction

            void main() {
                // Scale the UVs to crop instead of stretch ("Cover" mode)
                // Position is -1 to 1. We scale it by u_corr to zoom in if needed.
                vUv = (position * 0.5) * u_corr + 0.5;
                
                // Flip Y for WebGL texture coords
                vUv.y = 1.0 - vUv.y; 
                
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        // --- 2. Fragment Shader (Updated for Sensitivity) ---
        const fragShaderSource = `
            precision mediump float;
            uniform sampler2D u_image;
            uniform sampler2D u_depth;
            uniform vec2 u_mouse;
            varying vec2 vUv;

            void main() {
                // 1. Get Depth
                vec4 depthDist = texture2D(u_depth, vUv);
                float depth = depthDist.r;

                // 2. Calculate Offset (Movement)
                // Keep sensitivity low (0.01) to prevent tearing
                vec2 offset = u_mouse * depth * 0.015; 

                // 3. Fetch the "Moved" Color (The 3D Face)
                vec4 distortedColor = texture2D(u_image, vUv + offset);

                // 4. Fetch the "Static" Alpha (The Original Cutout)
                // We sample the original image WITHOUT offset to get the hard edge
                vec4 originalColor = texture2D(u_image, vUv);

                // 5. Combine them
                // We use the moved color, but we force the alpha to match the original silhouette.
                gl_FragColor = distortedColor;
                gl_FragColor.a = originalColor.a;

                // Optional: Discard fully transparent pixels to keep GPU happy
                if (gl_FragColor.a < 0.01) discard;
            }
        `;

        const createShader = (gl, type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        };

        const program = gl.createProgram();
        gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertShaderSource));
        gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragShaderSource));
        gl.linkProgram(program);
        gl.useProgram(program);

        // Geometry
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Textures
        let imageAspect = 1; // Track image shape
        
        const loadTexture = (url, unit) => {
            const tex = gl.createTexture();
            const image = new Image();
            image.src = url;
            image.onload = () => {
                if (unit === 0) imageAspect = image.width / image.height; // Capture aspect ratio
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                resize(); // Recalculate aspect ratio match
            };
        };

        loadTexture(src, 0);
        loadTexture(depthSrc, 1);

        const uImageLoc = gl.getUniformLocation(program, "u_image");
        const uDepthLoc = gl.getUniformLocation(program, "u_depth");
        const uMouseLoc = gl.getUniformLocation(program, "u_mouse");
        const uCorrLoc = gl.getUniformLocation(program, "u_corr");

        gl.uniform1i(uImageLoc, 0);
        gl.uniform1i(uDepthLoc, 1);

        // Mouse Logic
        let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;

        const updateMouse = (e) => {
            const rect = container.getBoundingClientRect();
            targetX = (e.clientX - rect.left) / rect.width * 2 - 1;
            targetY = -((e.clientY - rect.top) / rect.height * 2 - 1);
        };

        container.addEventListener('mousemove', updateMouse);
        container.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });

        // Animation Loop
        const render = () => {
            mouseX += (targetX - mouseX) * 0.05;
            mouseY += (targetY - mouseY) * 0.05;
            gl.uniform2f(uMouseLoc, mouseX, mouseY);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            requestAnimationFrame(render);
        };
        render();

        // --- RESIZE & ASPECT RATIO FIX ---
        const resize = () => {
            const displayWidth = container.clientWidth;
            const displayHeight = container.clientHeight;
            
            // 1. Resize Canvas
            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            }

            // 2. Calculate "Cover" Scale
            const canvasAspect = displayWidth / displayHeight;
            let scaleX = 1.0;
            let scaleY = 1.0;

            if (canvasAspect > imageAspect) {
                // Canvas is wider than image: Crop top/bottom
                scaleY = imageAspect / canvasAspect;
            } else {
                // Canvas is taller than image: Crop sides
                scaleX = canvasAspect / imageAspect;
            }

            gl.uniform2f(uCorrLoc, scaleX, scaleY);
        }
        window.addEventListener('resize', resize);
    });
</script>

<div class="depth-container" bind:this={container} role="img" aria-label={alt}>
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    .depth-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        border-radius: 30px; 
    }
    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>