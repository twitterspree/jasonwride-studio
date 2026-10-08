<script>
    import { onMount, tick } from 'svelte';
    import { localMidnight, dayEvents, fmtMinutes } from '../../lib/sun';

    /**
     * @type {{
     *   avatar: string,
     *   portraits: { id: string, src: string, alt: string }[],
     *   landscapes: { id: string, src: string, alt: string }[],
     *   facts: { saturdayPct: number, lateAfternoonPct: number, medianAperture: number, photos: number, sessions: number }
     * }}
     */
    let { avatar, portraits = [], landscapes = [], facts } = $props();

    // ---------------------------------------------------------------- script
    // Each topic is a little burst of messages from Jason, then suggested replies.
    let sun = $state({ sunrise: null, sunset: null, goldenEveningStart: null });

    const LABELS = {
        pics: 'show me some pics 📷',
        landscapes: 'landscapes?',
        shoot: 'can you take my pics?',
        build: 'what do you build?',
        ai: 'wait is this AI??',
        who: 'who are you tho',
        weird: 'tell me something weird',
        work: 'are you looking for work?',
        contact: 'how do I reach you'
    };

    const SCRIPT = {
        start: () => ({
            msgs: [
                t('hey 👋'),
                t('I’m Jason'),
                t('IS student at the University of Utah. I take pictures and build stuff')
            ],
            next: ['pics', 'build', 'who']
        }),
        hi: () => ({ msgs: [t('heyy 👋'), t('what do you wanna see?')], next: ['pics', 'build', 'who'] }),
        pics: () => ({
            msgs: [t('ok here’s a few recent ones'), imgs(portraits.slice(0, 4)), t('56mm lens, usually around f/2. tap one to see it big')],
            next: ['landscapes', 'shoot', 'weird']
        }),
        landscapes: () => ({
            msgs: [t('when nobody’s around I shoot stuff like this'), imgs(landscapes.slice(0, 4)), t('santaquin + the oregon coast. fog is my favorite weather')],
            next: ['shoot', 'build', 'weird']
        }),
        shoot: () => ({
            msgs: [
                t('yeah!! seniors, couples, dances, whatever you need'),
                t(
                    sun.goldenEveningStart != null
                        ? `in santaquin today the light starts getting good around ${fmtMinutes(sun.goldenEveningStart)}. sunset’s ${fmtMinutes(sun.sunset)}`
                        : 'the light gets good about an hour before sunset'
                ),
                t('(this website actually calculates that. I’m a nerd)'),
                card()
            ],
            next: ['pics', 'build', 'weird']
        }),
        build: () => ({
            msgs: [
                t('a few things:'),
                link({
                    title: 'Tree of Life',
                    desc: 'Interactive map of convergent evolution',
                    domain: 'jasonwride.studio',
                    href: '/tree-of-life',
                    art: '🌳',
                    tint: '#1f6a3c'
                }),
                link({
                    title: 'Local RAG Assistant',
                    desc: 'Chat with your iMessages — fully offline',
                    domain: 'private repo',
                    art: '💬',
                    tint: '#2b5bd7'
                }),
                t('the second one is kinda funny bc it lets you chat with your own iMessages… which is basically what you’re doing rn 👀')
            ],
            next: ['ai', 'work', 'pics']
        }),
        ai: () => ({
            msgs: [t('lol no 😅'), t('this whole convo is scripted. I’m a static website'), t('I did build an app that lets you chat with your own iMessages using a local AI model tho. nothing ever leaves your mac')],
            next: ['who', 'work', 'contact']
        }),
        who: () => ({
            msgs: [
                t('information systems major at the U 🎓'),
                t('I shoot on a canon m50, almost always with one 56mm lens'),
                t('and I’ve redesigned this website like 13 times. you’re looking at one of them')
            ],
            next: ['weird', 'pics', 'contact']
        }),
        weird: () => ({
            msgs: [
                t(`ok so I ran the numbers on my last ${facts.photos} photos`),
                t(`${facts.saturdayPct}% were taken on a saturday`),
                t(`and ${facts.lateAfternoonPct}% between 4 and 7pm`),
                t('which is just… when dances happen 💃'),
            ],
            next: ['shoot', 'landscapes', 'contact']
        }),
        work: () => ({
            msgs: [t('always down to hear about it'), t('email’s the best way to reach me about that'), card()],
            next: ['build', 'who']
        }),
        contact: () => ({ msgs: [t('here 👇'), card(), t('text, email, whatever. I’ll get back to you')], next: ['pics', 'build'] }),
        fallback: () => ({
            msgs: [t('haha I’m a static website so I can only say so much'), t('try one of these 👇')],
            next: []
        }),
        laugh: () => ({ msgs: [t('😂')], next: [] })
    };

    const t = (text) => ({ kind: 'text', text });
    const imgs = (images) => ({ kind: 'images', images });
    const link = (l) => ({ kind: 'link', link: l });
    const card = () => ({ kind: 'contact' });

    // Free-typed messages get routed by keyword — no AI, just a tiny matcher
    const ROUTES = [
        [/\b(hi|hey|hello|yo|sup|hiya)\b/i, 'hi'],
        [/\b(lol|haha|lmao|😂)/i, 'laugh'],
        [/\b(ai|bot|gpt|llm|robot|chatbot|real person)\b/i, 'ai'],
        [/(landscape|mountain|ocean|beach|fog|oregon|santaquin|nature)/i, 'landscapes'],
        [/(book|session|price|cost|senior|prom|couple|take my|photoshoot)/i, 'shoot'],
        [/(pic|photo|image|shot|gallery|camera)/i, 'pics'],
        [/(hire|job|intern|work|resume|résumé|recruit|position)/i, 'work'],
        [/(build|code|project|program|app|software|dev|website)/i, 'build'],
        [/(who|about|school|major|study|utah|you)/i, 'who'],
        [/(email|contact|reach|number|call|text)/i, 'contact'],
        [/(weird|fun fact|random|surprise)/i, 'weird']
    ];

    // ---------------------------------------------------------------- state
    let thread = $state([]);
    let replies = $state([]);
    let draft = $state('');
    let busy = $state(false);
    let visited = new Set();
    let uid = 0;
    let scroller;
    let viewer = $state(null); // { images, index }
    let dialog;
    let picker = $state(null); // id of message showing the tapback picker
    let startedAt = $state('');

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    async function scrollDown() {
        await tick();
        scroller?.scrollTo({ top: scroller.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
    }

    function push(item) {
        const msg = { id: ++uid, reaction: null, ...item };
        thread.push(msg);
        scrollDown();
        return msg.id;
    }

    function typingTime(m) {
        if (reduced()) return 150;
        if (m.kind === 'text') return Math.min(1700, 450 + m.text.length * 22);
        return 900;
    }

    async function play(key) {
        busy = true;
        replies = [];
        const node = SCRIPT[key]();
        for (const m of node.msgs) {
            const typingId = push({ from: 'jason', kind: 'typing' });
            await wait(typingTime(m));
            const i = thread.findIndex((x) => x.id === typingId);
            thread[i] = { id: typingId, from: 'jason', reaction: null, ...m };
            scrollDown();
            await wait(reduced() ? 50 : 280);
        }
        if (LABELS[key]) visited.add(key);
        replies = suggest(node.next);
        busy = false;
        scrollDown();
    }

    function suggest(preferred) {
        const fresh = (k) => !visited.has(k);
        const out = preferred.filter(fresh);
        for (const k of Object.keys(LABELS)) if (out.length < 3 && fresh(k) && !out.includes(k)) out.push(k);
        if (!out.length) return [{ key: 'restart', label: 'start over ↺' }, { key: 'contact', label: LABELS.contact }];
        return out.slice(0, 3).map((k) => ({ key: k, label: LABELS[k] }));
    }

    async function send(text, key) {
        if (busy || !text.trim()) return;
        busy = true;
        replies = [];
        const id = push({ from: 'you', kind: 'text', text, status: 'Delivered' });
        // earlier "you" messages lose their receipt — only the latest shows one
        thread.forEach((m) => m.from === 'you' && m.id !== id && (m.status = null));
        await wait(reduced() ? 100 : 700);
        const mine = thread.find((m) => m.id === id);
        if (mine) {
            mine.status = `Read ${clock()}`;
            // Jason tapbacks some of your messages
            if (key === 'pics' || key === 'shoot') mine.reaction = '❤️';
            else if (key === 'ai') mine.reaction = '😂';
        }
        await wait(reduced() ? 50 : 300);
        await play(key ?? route(text));
    }

    function route(text) {
        for (const [re, key] of ROUTES) if (re.test(text)) return key;
        return 'fallback';
    }

    function choose(r) {
        if (r.key === 'restart') {
            thread = [];
            visited = new Set();
            play('start');
            return;
        }
        send(r.label, r.key);
    }

    function submit(e) {
        e.preventDefault();
        const text = draft;
        draft = '';
        send(text);
    }

    const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    // ---------------------------------------------------------------- tapbacks
    const REACTIONS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];
    let pressTimer;
    let lovedOnce = false;

    function openPicker(id) {
        picker = picker === id ? null : id;
    }
    function react(msg, emoji) {
        msg.reaction = msg.reaction === emoji ? null : emoji;
        picker = null;
        // First time you ❤️ one of Jason's photos, he says thanks
        if (emoji === '❤️' && msg.from === 'jason' && msg.kind === 'images' && !lovedOnce && !busy) {
            lovedOnce = true;
            setTimeout(async () => {
                busy = true;
                const saved = replies;
                replies = [];
                const tid = push({ from: 'jason', kind: 'typing' });
                await wait(900);
                const i = thread.findIndex((x) => x.id === tid);
                thread[i] = { id: tid, from: 'jason', kind: 'text', text: 'glad you like it 🫶', reaction: null };
                replies = saved;
                busy = false;
                scrollDown();
            }, 500);
        }
    }
    function pressStart(id) {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => openPicker(id), 480);
    }
    const pressEnd = () => clearTimeout(pressTimer);

    // ---------------------------------------------------------------- photos + contact
    async function openViewer(images, index) {
        viewer = { images, index };
        await tick();
        dialog?.showModal();
    }
    function step(d) {
        if (!viewer) return;
        viewer.index = (viewer.index + d + viewer.images.length) % viewer.images.length;
    }

    function saveContact() {
        const vcf = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'N:Wride;Jason;;;',
            'FN:Jason Wride',
            'TITLE:Photographer & Developer',
            'EMAIL;TYPE=INTERNET:jason.wride@utah.edu',
            'URL:https://jasonwride.studio',
            'END:VCARD'
        ].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([vcf], { type: 'text/vcard' }));
        a.download = 'Jason Wride.vcf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // group bubbles like Messages: only the last in a run gets a tail
    const isLastOfRun = (i) => !thread[i + 1] || thread[i + 1].from !== thread[i].from;

    onMount(() => {
        sun = dayEvents(localMidnight(new Date()));
        startedAt = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        play('start');
    });
</script>

<svelte:window onkeydown={(e) => viewer && (e.key === 'ArrowRight' ? step(1) : e.key === 'ArrowLeft' ? step(-1) : null)} />

<div class="phone">
    <header class="thread-head">
        <img class="avatar" src={avatar} alt="" />
        <p class="who">Jason Wride <span aria-hidden="true">›</span></p>
        <p class="sub">iMessage</p>
    </header>

    <div class="scroller" bind:this={scroller}>
        <p class="stamp"><b>Today</b> {startedAt}</p>
        <ol class="log" role="log" aria-live="polite" aria-label="Conversation with Jason">
            {#each thread as m, i (m.id)}
                <li class="row {m.from}" class:tail={isLastOfRun(i)} class:gap={i > 0 && thread[i - 1].from !== m.from}>
                    {#if m.kind === 'typing'}
                        <span class="bubble typing" aria-label="Jason is typing"><i></i><i></i><i></i></span>
                    {:else}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="bubble-wrap"
                            ondblclick={() => openPicker(m.id)}
                            onpointerdown={() => pressStart(m.id)}
                            onpointerup={pressEnd}
                            onpointerleave={pressEnd}
                            oncontextmenu={(e) => {
                                e.preventDefault();
                                openPicker(m.id);
                            }}
                        >
                            {#if m.kind === 'text'}
                                <p class="bubble">{m.text}</p>
                            {:else if m.kind === 'images'}
                                <div class="photos n{Math.min(m.images.length, 4)}">
                                    {#each m.images as img, j}
                                        <button class="ph" onclick={() => openViewer(m.images, j)} aria-label="Open photo: {img.alt}">
                                            <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
                                        </button>
                                    {/each}
                                </div>
                            {:else if m.kind === 'link'}
                                <svelte:element this={m.link.href ? 'a' : 'div'} class="linkcard" href={m.link.href}>
                                    <span class="art" style:background={m.link.tint}>{m.link.art}</span>
                                    <span class="meta">
                                        <b>{m.link.title}</b>
                                        <span>{m.link.desc}</span>
                                        <small>{m.link.domain}</small>
                                    </span>
                                </svelte:element>
                            {:else if m.kind === 'contact'}
                                <div class="vcard">
                                    <div class="vc-top">
                                        <img src={avatar} alt="" />
                                        <span><b>Jason Wride</b><small>Photographer & Developer</small></span>
                                    </div>
                                    <div class="vc-actions">
                                        <a href="mailto:jason.wride@utah.edu">Email</a>
                                        <button onclick={saveContact}>Add to Contacts</button>
                                    </div>
                                </div>
                            {/if}

                            {#if m.reaction}<span class="tapback" aria-label="Reaction {m.reaction}">{m.reaction}</span>{/if}

                            {#if picker === m.id}
                                <div class="picker" role="menu" aria-label="React">
                                    {#each REACTIONS as r}
                                        <button role="menuitem" class:on={m.reaction === r} onclick={() => react(m, r)}>{r}</button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        {#if m.status}<p class="receipt">{m.status}</p>{/if}
                    {/if}
                </li>
            {/each}
        </ol>

        {#if replies.length}
            <div class="replies" aria-label="Suggested replies">
                {#each replies as r (r.key)}
                    <button onclick={() => choose(r)}>{r.label}</button>
                {/each}
            </div>
        {/if}
    </div>

    <form class="composer" onsubmit={submit}>
        <span class="plus" aria-hidden="true">+</span>
        <input bind:value={draft} placeholder="iMessage" aria-label="Message Jason" autocomplete="off" enterkeyhint="send" />
        <button class="send" disabled={!draft.trim() || busy} aria-label="Send">↑</button>
    </form>
</div>

{#if viewer}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <dialog
        class="viewer"
        bind:this={dialog}
        onclose={() => (viewer = null)}
        onclick={(e) => e.target === dialog && dialog.close()}
        aria-label="Photo"
    >
        <img src={viewer.images[viewer.index].src} alt={viewer.images[viewer.index].alt} />
        <div class="v-bar">
            <button onclick={() => step(-1)} aria-label="Previous photo">‹</button>
            <span>{viewer.index + 1} of {viewer.images.length}</span>
            <button onclick={() => step(1)} aria-label="Next photo">›</button>
            <button onclick={() => dialog.close()}>Done</button>
        </div>
    </dialog>
{/if}

<style>
    .phone {
        --blue: #0a84ff;
        --grey: #e9e9eb;
        --ink: #000;
        --bg: #fff;
        --muted: #8a8a8e;
        position: relative;
        display: flex;
        flex-direction: column;
        width: min(430px, 100%);
        height: min(880px, calc(100dvh - 2.5rem));
        margin: 1.25rem auto;
        background: var(--bg);
        color: var(--ink);
        border-radius: 46px;
        border: 10px solid #111;
        box-shadow: 0 0 0 2px #333, 0 40px 80px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    @media (prefers-color-scheme: dark) {
        .phone { --grey: #262628; --ink: #fff; --bg: #000; --muted: #8d8d93; }
    }
    @media (max-width: 520px) {
        .phone { width: 100%; height: 100dvh; margin: 0; border: 0; border-radius: 0; box-shadow: none; }
    }

    .thread-head {
        display: grid;
        justify-items: center;
        padding: 3.1rem 1rem 0.6rem;
        background: color-mix(in srgb, var(--bg) 85%, transparent);
        backdrop-filter: blur(20px);
        border-bottom: 0.5px solid color-mix(in srgb, var(--muted) 40%, transparent);
        z-index: 2;
    }
    .avatar { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; object-position: 50% 25%; }
    .who { font-size: 0.78rem; margin-top: 0.3rem; }
    .who span { color: var(--muted); }
    .sub { font-size: 0.68rem; color: var(--muted); }

    .scroller { flex: 1; overflow-y: auto; padding: 0.6rem 0.9rem 1rem; overscroll-behavior: contain; }
    .stamp { text-align: center; font-size: 0.7rem; color: var(--muted); margin: 0.4rem 0 0.8rem; }
    .stamp b { font-weight: 600; }

    .log { list-style: none; display: flex; flex-direction: column; gap: 2px; }
    .row { display: flex; flex-direction: column; animation: pop 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
    .row.gap { margin-top: 10px; }
    .row.jason { align-items: flex-start; }
    .row.you { align-items: flex-end; }
    @keyframes pop { from { transform: scale(0.85) translateY(6px); opacity: 0; } }

    .bubble-wrap { position: relative; max-width: 76%; }
    .bubble {
        position: relative;
        padding: 0.45rem 0.8rem;
        border-radius: 18px;
        font-size: 0.97rem;
        line-height: 1.3;
        background: var(--grey);
        color: var(--ink);
        overflow-wrap: anywhere;
        user-select: text;
    }
    .you .bubble { background: var(--blue); color: #fff; }

    /* Messages-style tails on the last bubble of a run */
    .tail .bubble::before,
    .tail .bubble::after { content: ''; position: absolute; bottom: 0; height: 20px; }
    .jason.tail .bubble::before { left: -7px; width: 20px; background: var(--grey); border-bottom-right-radius: 16px 14px; }
    .jason.tail .bubble::after { left: -10px; width: 10px; background: var(--bg); border-bottom-right-radius: 10px; }
    .you.tail .bubble::before { right: -7px; width: 20px; background: var(--blue); border-bottom-left-radius: 16px 14px; }
    .you.tail .bubble::after { right: -10px; width: 10px; background: var(--bg); border-bottom-left-radius: 10px; }

    .typing { display: inline-flex; gap: 4px; padding: 0.7rem 0.85rem; border-radius: 18px; background: var(--grey); }
    .typing i { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); animation: blink 1.2s infinite; }
    .typing i:nth-child(2) { animation-delay: 0.15s; }
    .typing i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes blink { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

    .receipt { font-size: 0.68rem; color: var(--muted); margin: 2px 4px 0 0; }

    .photos { display: grid; gap: 3px; border-radius: 18px; overflow: hidden; width: 250px; }
    .photos.n2, .photos.n3, .photos.n4 { grid-template-columns: 1fr 1fr; }
    .photos.n3 .ph:first-child { grid-column: 1 / -1; }
    .ph { border: 0; padding: 0; background: var(--grey); cursor: zoom-in; display: block; }
    .ph img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .photos.n1 .ph img { aspect-ratio: 4 / 5; }

    .linkcard {
        display: block;
        width: 250px;
        border-radius: 18px;
        overflow: hidden;
        background: var(--grey);
        color: var(--ink);
        text-decoration: none;
    }
    .linkcard .art { display: grid; place-items: center; height: 110px; font-size: 3rem; }
    .linkcard .meta { display: flex; flex-direction: column; gap: 1px; padding: 0.55rem 0.8rem 0.65rem; font-size: 0.85rem; }
    .linkcard .meta b { font-weight: 600; }
    .linkcard .meta span { color: var(--ink); opacity: 0.75; }
    .linkcard small { color: var(--muted); font-size: 0.75rem; }

    .vcard { width: 250px; border-radius: 18px; background: var(--grey); overflow: hidden; }
    .vc-top { display: flex; gap: 0.7rem; align-items: center; padding: 0.8rem; }
    .vc-top img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; object-position: 50% 25%; }
    .vc-top span { display: flex; flex-direction: column; font-size: 0.9rem; }
    .vc-top small { color: var(--muted); font-size: 0.75rem; }
    .vc-actions { display: grid; grid-template-columns: 1fr 1fr; border-top: 0.5px solid color-mix(in srgb, var(--muted) 40%, transparent); }
    .vc-actions a,
    .vc-actions button {
        padding: 0.6rem;
        text-align: center;
        font: inherit;
        font-size: 0.85rem;
        color: var(--blue);
        background: none;
        border: 0;
        text-decoration: none;
        cursor: pointer;
    }
    .vc-actions button { border-left: 0.5px solid color-mix(in srgb, var(--muted) 40%, transparent); }

    .tapback {
        position: absolute;
        top: -14px;
        font-size: 0.85rem;
        background: var(--grey);
        border: 2px solid var(--bg);
        border-radius: 999px;
        padding: 1px 5px;
        animation: pop 0.3s cubic-bezier(0.2, 1.6, 0.4, 1);
    }
    .jason .tapback { right: -12px; }
    .you .tapback { left: -12px; background: var(--blue); }

    .picker {
        position: absolute;
        bottom: calc(100% + 6px);
        display: flex;
        gap: 2px;
        padding: 4px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--bg) 92%, var(--grey));
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
        z-index: 5;
        animation: pop 0.2s ease;
    }
    .jason .picker { left: 0; }
    .you .picker { right: 0; }
    .picker button { border: 0; background: none; font-size: 1.15rem; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; }
    .picker button:hover,
    .picker button.on { background: var(--grey); }

    .replies { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-top: 0.9rem; }
    .replies button {
        font: inherit;
        font-size: 0.88rem;
        padding: 0.4rem 0.85rem;
        border-radius: 999px;
        border: 1px solid var(--blue);
        background: transparent;
        color: var(--blue);
        cursor: pointer;
        animation: pop 0.3s ease both;
    }
    .replies button:nth-child(2) { animation-delay: 0.06s; }
    .replies button:nth-child(3) { animation-delay: 0.12s; }
    .replies button:hover { background: var(--blue); color: #fff; }

    .composer {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem 1.1rem;
        background: var(--bg);
    }
    .plus { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--grey); color: var(--muted); font-size: 1.3rem; }
    .composer input {
        flex: 1;
        min-width: 0;
        font: inherit;
        font-size: 1rem;
        padding: 0.45rem 0.9rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--muted) 50%, transparent);
        background: transparent;
        color: var(--ink);
        outline: none;
    }
    .composer input:focus { border-color: var(--blue); }
    .send {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 0;
        background: var(--blue);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
    }
    .send:disabled { opacity: 0.35; cursor: default; }

    .viewer { margin: auto; background: transparent; border: 0; max-width: 100vw; max-height: 100dvh; padding: 0; }
    .viewer::backdrop { background: rgba(0, 0, 0, 0.94); }
    .viewer img { max-width: 94vw; max-height: 82dvh; display: block; margin: 0 auto; border-radius: 6px; }
    .v-bar { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 0.8rem; color: #fff; font: 0.9rem -apple-system, system-ui, sans-serif; }
    .v-bar button { background: none; border: 0; color: #0a84ff; font: inherit; font-size: 1rem; cursor: pointer; padding: 0.3rem 0.6rem; }
</style>
