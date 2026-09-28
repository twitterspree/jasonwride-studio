<script>
    import { onMount } from 'svelte';

    let { src = '', depthSrc = '', alt = '', width, height } = $props();

    let canvas;
    let container;
    // The static <img> is always rendered (fast paint, no-WebGL fallback);
    // the canvas fades in over it once both textures are on the GPU.
    let glReady = $state(false);

    const VERT = `
        attribute vec2 position;
        varying vec2 vUv;
        uniform vec2 u_corr; // "cover" crop correction

        void main() {
            vUv = (position * 0.5) * u_corr + 0.5;
            vUv.y = 1.0 - vUv.y;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const FRAG = `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depth;
        uniform vec2 u_mouse;
        varying vec2 vUv;

        void main() {
            // Lighter depth = closer to camera = moves more
            float depth = texture2D(u_depth, vUv).r;
            vec2 offset = u_mouse * depth * 0.02;
            // Use the displaced alpha too so the silhouette moves with the pixels
            gl_FragColor = texture2D(u_image, vUv + offset);
            if (gl_FragColor.a < 0.01) discard;
        }
    `;

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
        }
        return shader;
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    onMount(() => {
        // Respect reduced motion: the static portrait is the whole experience
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const gl = canvas.getContext('webgl', { premultipliedAlpha: true });
        if (!gl) return;

        let program;
        try {
            program = gl.createProgram();
            gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
            gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
        } catch (err) {
            console.warn('DepthProfile: falling back to static image', err);
            return;
        }
        gl.useProgram(program);
        // Pre-multiply alpha to avoid a white halo around the cut-out
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const positionLoc = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        const uMouse = gl.getUniformLocation(program, 'u_mouse');
        const uCorr = gl.getUniformLocation(program, 'u_corr');
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
        gl.uniform1i(gl.getUniformLocation(program, 'u_depth'), 1);

        function upload(img, unit) {
            const tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        }

        let imageAspect = 1;
        let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
        let frame = 0;
        let visible = true;
        let disposed = false;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (!w || !h) return;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);

            const canvasAspect = w / h;
            let sx = 1, sy = 1;
            if (canvasAspect > imageAspect) sy = imageAspect / canvasAspect; // crop top/bottom
            else sx = canvasAspect / imageAspect; // crop sides
            gl.uniform2f(uCorr, sx, sy);
            draw();
        }

        function draw() {
            gl.uniform2f(uMouse, mouseX, mouseY);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        // Ease toward the pointer, and stop the loop once we've settled
        function tick() {
            mouseX += (targetX - mouseX) * 0.05;
            mouseY += (targetY - mouseY) * 0.05;
            draw();
            const settled = Math.abs(targetX - mouseX) < 0.001 && Math.abs(targetY - mouseY) < 0.001;
            frame = settled || !visible ? 0 : requestAnimationFrame(tick);
        }

        function wake() {
            if (!frame && visible && glReady) frame = requestAnimationFrame(tick);
        }

        function onPointerMove(e) {
            const rect = container.getBoundingClientRect();
            targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
            wake();
        }

        function onPointerLeave() {
            targetX = 0;
            targetY = 0;
            wake();
        }

        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            wake();
        });
        io.observe(container);

        const ro = new ResizeObserver(resize);

        Promise.all([loadImage(src), loadImage(depthSrc)])
            .then(([img, depth]) => {
                if (disposed) return;
                imageAspect = img.width / img.height;
                upload(img, 0);
                upload(depth, 1);
                ro.observe(container);
                resize();
                glReady = true;
            })
            .catch((err) => console.warn('DepthProfile: texture load failed', err));

        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerleave', onPointerLeave);

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            io.disconnect();
            ro.disconnect();
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerleave', onPointerLeave);
        };
    });
</script>

<div class="depth-container" bind:this={container}>
    <img class="depth-fallback" class:hidden={glReady} {src} {alt} {width} {height} fetchpriority="high" decoding="async" />
    <canvas bind:this={canvas} class:ready={glReady} aria-hidden="true"></canvas>
</div>

<style>
    .depth-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        border-radius: 30px;
    }

    .depth-fallback,
    canvas {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
    }

    .depth-fallback {
        object-fit: cover;
        transition: opacity 0.4s ease;
    }

    /* Hide once the canvas takes over, or the static silhouette ghosts behind the parallax */
    .depth-fallback.hidden {
        opacity: 0;
    }

    canvas {
        opacity: 0;
        transition: opacity 0.4s ease;
    }

    canvas.ready {
        opacity: 1;
    }
</style>
