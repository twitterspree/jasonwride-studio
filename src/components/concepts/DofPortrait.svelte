<script>
    import { onMount } from 'svelte';

    /**
     * Cut-out portrait composited over a far background plane, rendered with a
     * depth-aware lens blur. `aperture` (f-number) sets blur strength; `focus`
     * (0–1, where 1 = nearest) sets which plane is sharp. Focus on the background
     * (≈0) and the face goes soft — rack focus, like a real lens.
     * @type {{ src: string, depthSrc: string, bgSrc: string, alt: string, aperture: number, focus: number }}
     */
    let { src, depthSrc, bgSrc, alt, aperture = 1.4, focus = 0.8 } = $props();

    let canvas;
    let box;
    let ready = $state(false);
    let draw = () => {};

    // Blur radius (in image pixels) at full defocus: wide open = big bokeh, f/16 ≈ none
    const blurFor = (f) => 30 * Math.pow(1.4 / f, 1.15);

    $effect(() => {
        aperture;
        focus;
        draw();
    });

    const VERT = `
        attribute vec2 p;
        uniform vec2 corrF;
        uniform vec2 corrB;
        varying vec2 uvF;
        varying vec2 uvB;
        void main() {
            uvF = (p * 0.5) * corrF + 0.5;
            uvF.y = 1.0 - uvF.y;
            uvB = (p * 0.5) * corrB + 0.5;
            uvB.y = 1.0 - uvB.y;
            gl_Position = vec4(p, 0.0, 1.0);
        }`;

    const FRAG = `
        precision mediump float;
        uniform sampler2D img;   // portrait, premultiplied alpha
        uniform sampler2D dep;   // depth: white = near
        uniform sampler2D bg;    // background plate (infinitely far)
        uniform float blur;
        uniform float focus;
        uniform vec2 texF;
        uniform vec2 texB;
        varying vec2 uvF;
        varying vec2 uvB;

        bool outside(vec2 u) { return u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0; }
        vec4 fg(vec2 u) { return outside(u) ? vec4(0.0) : texture2D(img, u); }

        void main() {
            float d = outside(uvF) ? 0.0 : texture2D(dep, uvF).r;
            // a small in-focus zone around the focus plane, then blur ramps up
            float rF = blur * smoothstep(0.04, 0.4, abs(focus - d));
            float rB = blur * 1.3 * smoothstep(0.04, 0.4, focus);
            vec4 accF = vec4(0.0);
            vec3 accB = vec3(0.0);
            for (int i = 0; i < 40; i++) {
                float fi = float(i);
                float a = fi * 2.39996;
                vec2 dir = vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 40.0);
                accF += fg(uvF + dir * rF * texF);
                accB += texture2D(bg, uvB + dir * rB * texB).rgb;
            }
            vec4 f = accF / 40.0;
            vec3 b = accB / 40.0;
            gl_FragColor = vec4(f.rgb + b * (1.0 - f.a), 1.0);
        }`;

    function load(url) {
        return new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
        });
    }

    onMount(() => {
        const gl = canvas.getContext('webgl');
        if (!gl) return;
        const sh = (type, s) => {
            const x = gl.createShader(type);
            gl.shaderSource(x, s);
            gl.compileShader(x);
            if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(x));
            return x;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const U = (n) => gl.getUniformLocation(prog, n);
        gl.uniform1i(U('img'), 0);
        gl.uniform1i(U('dep'), 1);
        gl.uniform1i(U('bg'), 2);

        const tex = (im, unit, premultiply) => {
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
            const t = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        };

        let fa = 1, ba = 1.5;
        const size = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.round(box.clientWidth * dpr);
            canvas.height = Math.round(box.clientHeight * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
            const ca = canvas.width / canvas.height;
            // portrait: contain (whole head visible); background: cover
            gl.uniform2f(U('corrF'), ca > fa ? ca / fa : 1, ca > fa ? 1 : fa / ca);
            gl.uniform2f(U('corrB'), ca > ba ? 1 : ca / ba, ca > ba ? ba / ca : 1);
            draw();
        };

        draw = () => {
            if (!ready) return;
            gl.uniform1f(U('blur'), blurFor(aperture));
            gl.uniform1f(U('focus'), focus);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        let ro;
        Promise.all([load(src), load(depthSrc), load(bgSrc)]).then(([a, d, b]) => {
            fa = a.width / a.height;
            ba = b.width / b.height;
            tex(a, 0, true);
            tex(d, 1, false);
            tex(b, 2, false);
            gl.uniform2f(U('texF'), 1 / a.width, 1 / a.height);
            gl.uniform2f(U('texB'), 1 / b.width, 1 / b.height);
            ready = true;
            ro = new ResizeObserver(size);
            ro.observe(box);
            size();
        });
        return () => ro?.disconnect();
    });
</script>

<div class="dof" bind:this={box}>
    <img {src} {alt} class:hide={ready} />
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
    .dof { position: absolute; inset: 0; background: #111; }
    img, canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    img { object-fit: contain; transition: opacity 0.3s; }
    img.hide { opacity: 0; }
</style>
