<script>
    import { onMount } from 'svelte';
    import { SANTAQUIN, localMidnight, dayEvents, fmtMinutes } from '../../lib/sun';

    /**
     * @typedef {{ id: string, src: string, alt: string, place: string, light: string, date: string, exif: string, kind: 'land' | 'people' }} Pic
     * @type {{ pics: Pic[], stats: { photos: number, saturdayPct: number, lateAfternoonPct: number, medianAperture: number } }}
     */
    let { pics = [], stats } = $props();

    // ------------------------------------------------------------ edition date
    let offsetDays = $state(0); // 0 = today, -1 = yesterday …
    let today = $state(null); // Date at local midnight (Santaquin) as UTC ms
    const DAY = 86400000;

    const midnight = $derived(today == null ? null : today + offsetDays * DAY);
    const dateObj = $derived(midnight == null ? null : new Date(midnight + 12 * 3600000)); // noon local, safe for formatting

    const fmtDate = (d, opts) => d?.toLocaleDateString('en-US', { timeZone: SANTAQUIN.tz, ...opts }) ?? '';
    const dayOfYear = $derived.by(() => {
        if (!dateObj) return '';
        const y = Number(fmtDate(dateObj, { year: 'numeric' }));
        const start = localMidnight(new Date(Date.UTC(y, 0, 1, 12)));
        return Math.round((midnight - start) / DAY) + 1;
    });

    // ------------------------------------------------------------ sun + moon
    const sun = $derived(midnight == null ? null : dayEvents(midnight));
    const sunPrev = $derived(midnight == null ? null : dayEvents(midnight - DAY));
    const dayLen = (e) => (e?.sunrise != null && e?.sunset != null ? e.sunset - e.sunrise : null);
    const hm = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
    const lenDelta = $derived(dayLen(sun) != null && dayLen(sunPrev) != null ? dayLen(sun) - dayLen(sunPrev) : null);

    // Moon phase from a reference new moon (2000-01-06 18:14 UTC)
    const SYNODIC = 29.530588853;
    const moon = $derived.by(() => {
        if (!dateObj) return null;
        const days = (dateObj.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / DAY;
        const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
        const illum = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
        const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
        const name = names[Math.floor(((age / SYNODIC) * 8 + 0.5) % 8)];
        return { age, illum, name, waxing: age < SYNODIC / 2 };
    });
    // SVG path for the lit part of the moon
    const moonPath = $derived.by(() => {
        if (!moon) return '';
        const r = 30, k = Math.cos((2 * Math.PI * moon.age) / SYNODIC); // 1 new → -1 full
        const sweepOuter = moon.waxing ? 1 : 0;
        const rx = Math.abs(k) * r;
        const sweepInner = (k > 0) === moon.waxing ? 0 : 1;
        return `M 0 ${-r} A ${r} ${r} 0 0 ${sweepOuter} 0 ${r} A ${rx} ${r} 0 0 ${sweepInner} 0 ${-r} Z`;
    });

    // ------------------------------------------------------------ weather (Open-Meteo, no key)
    let wx = $state(null);
    let wxError = $state(false);
    const WMO = (c) =>
        c == null ? null
        : c === 0 ? { word: 'Clear', kind: 'clear' }
        : c <= 2 ? { word: 'Partly cloudy', kind: 'partly' }
        : c === 3 ? { word: 'Overcast', kind: 'overcast' }
        : c <= 48 ? { word: 'Fog', kind: 'fog' }
        : c <= 57 ? { word: 'Drizzle', kind: 'rain' }
        : c <= 67 ? { word: 'Rain', kind: 'rain' }
        : c <= 77 ? { word: 'Snow', kind: 'snow' }
        : c <= 82 ? { word: 'Showers', kind: 'rain' }
        : c <= 86 ? { word: 'Snow showers', kind: 'snow' }
        : { word: 'Thunderstorms', kind: 'storm' };

    const isoDay = $derived(dateObj ? dateObj.toLocaleDateString('en-CA', { timeZone: SANTAQUIN.tz }) : '');
    const daily = $derived.by(() => {
        if (!wx?.daily) return null;
        const i = wx.daily.time.indexOf(isoDay);
        if (i < 0) return null;
        return {
            code: wx.daily.weather_code[i],
            hi: Math.round(wx.daily.temperature_2m_max[i]),
            lo: Math.round(wx.daily.temperature_2m_min[i]),
            cloud: wx.daily.cloud_cover_mean?.[i],
            rain: wx.daily.precipitation_probability_max?.[i]
        };
    });
    const conditions = $derived(offsetDays === 0 && wx?.current ? WMO(wx.current.weather_code) : WMO(daily?.code));
    const cloud = $derived(offsetDays === 0 && wx?.current ? wx.current.cloud_cover : daily?.cloud);

    // Editor's rule of thumb for tonight's light
    const forecast = $derived.by(() => {
        const k = conditions?.kind;
        if (!k) return null;
        if (k === 'rain' || k === 'storm') return { stars: 1, note: 'Stay in. Write code.' };
        if (k === 'snow') return { stars: 3, note: 'Snow light is soft and bright — bring a lens cloth.' };
        if (k === 'fog') return { stars: 4, note: 'Fog! The editor’s favorite. Go find a ridgeline.' };
        if (cloud != null && cloud >= 25 && cloud <= 75) return { stars: 5, note: 'Broken clouds — best odds of a colorful sunset.' };
        if (cloud != null && cloud > 85) return { stars: 2, note: 'Flat and grey. Great for portraits, not for sunsets.' };
        return { stars: 3, note: 'Clean golden light, plain sky.' };
    });

    // ------------------------------------------------------------ the photograph of the day
    const seeded = (s) => {
        let h = 2166136261;
        for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
        return Math.abs(h);
    };
    const lead = $derived.by(() => {
        if (!isoDay) return null;
        const k = conditions?.kind;
        const lands = pics.filter((p) => p.kind === 'land');
        const want =
            k === 'fog' || k === 'overcast' ? lands.filter((p) => p.light === 'overcast' || p.light === 'blue')
            : k === 'snow' ? lands.filter((p) => /snow/i.test(p.alt))
            : k === 'rain' || k === 'storm' ? lands.filter((p) => p.light === 'overcast')
            : k === 'clear' || k === 'partly' ? pics.filter((p) => p.light === 'golden')
            : pics;
        const pool = want.length ? want : pics;
        return pool[seeded(isoDay) % pool.length];
    });
    const HEADLINES = {
        fog: 'FOG SETTLES OVER SANTAQUIN; LOCAL PHOTOGRAPHER THRILLED',
        overcast: 'GREY SKIES BLANKET VALLEY — “PERFECT,” SAYS EDITOR',
        snow: 'SNOW ON THE WASATCH',
        rain: 'RAIN DAY: EDITOR STAYS IN, WRITES CODE',
        storm: 'STORMS ROLL THROUGH; CAMERA STAYS DRY',
        clear: 'CLEAR SKIES PROMISE A GOLDEN EVENING',
        partly: 'A FEW CLOUDS, A GOOD SUNSET?'
    };
    const headline = $derived(HEADLINES[conditions?.kind] ?? 'TODAY’S LIGHT, AS SEEN FROM SANTAQUIN');

    // ------------------------------------------------------------ on this day (nearest calendar date)
    const onThisDay = $derived.by(() => {
        if (!dateObj) return [];
        const m = Number(fmtDate(dateObj, { month: 'numeric' })), d = Number(fmtDate(dateObj, { day: 'numeric' }));
        const doy = (mm, dd) => new Date(Date.UTC(2001, mm - 1, dd)).getTime() / DAY;
        const t = doy(m, d);
        return pics
            .filter((p) => p.date)
            .map((p) => {
                const [, pm, pd] = p.date.split('-').map(Number);
                const diff = Math.abs(doy(pm, pd) - t);
                return { ...p, away: Math.round(Math.min(diff, 365 - diff)) };
            })
            .sort((a, b) => a.away - b.away)
            .slice(0, 3);
    });
    const niceDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // ------------------------------------------------------------ halftone toggle
    let color = $state(false);

    onMount(async () => {
        today = localMidnight(new Date());
        try {
            const url =
                `https://api.open-meteo.com/v1/forecast?latitude=${SANTAQUIN.lat}&longitude=${SANTAQUIN.lon}` +
                '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m' +
                '&daily=weather_code,temperature_2m_max,temperature_2m_min,cloud_cover_mean,precipitation_probability_max' +
                '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FDenver&past_days=7&forecast_days=7';
            const res = await fetch(url);
            if (!res.ok) throw new Error(String(res.status));
            wx = await res.json();
        } catch {
            wxError = true;
        }
    });

</script>

{#if dateObj}
    <article class="paper" class:color>
        <header class="mast">
            <div class="ears">
                <p class="ear">
                    <b>Weather</b>
                    {#if conditions}{conditions.word}{#if offsetDays === 0 && wx?.current}, {Math.round(wx.current.temperature_2m)}°F{:else if daily}, {daily.hi}°/{daily.lo}°{/if}{:else if wxError}Unavailable{:else}…{/if}
                </p>
                <h1>The Santaquin Almanac</h1>
                <p class="ear right"><b>Sunset</b>{fmtMinutes(sun?.sunset)}</p>
            </div>
            <p class="tag">& Daily Light Report — Published by Jason Wride, Photographer & Developer</p>
            <div class="dateline">
                <button onclick={() => (offsetDays -= 1)} disabled={offsetDays <= -7} aria-label="Previous day’s edition">‹ Prev. edition</button>
                <span>
                    No. {dayOfYear} · {fmtDate(dateObj, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    {#if offsetDays !== 0}<em>({offsetDays < 0 ? `${-offsetDays}d ago` : `${offsetDays}d ahead`})</em>{/if}
                </span>
                <button onclick={() => (offsetDays += 1)} disabled={offsetDays >= 6} aria-label="Next day’s edition">Next edition ›</button>
            </div>
        </header>

        <div class="columns">
            <!-- LEAD -->
            <section class="lead">
                <h2 class="headline">{headline}</h2>
                {#if lead}
                    <figure class="halftone">
                        <img src={lead.src} alt={lead.alt} />
                        <figcaption><b>Photograph of the Day.</b> {lead.alt}. {lead.place ? `${lead.place}, ` : ''}{niceDate(lead.date)}. <span class="exif">{lead.exif}</span></figcaption>
                    </figure>
                {/if}
                <p class="dropcap">
                    Every morning this paper checks the sky over Santaquin, Utah, and pulls a photograph from the editor’s archive to match it.
                    {#if conditions}Today calls for <i>{conditions.word.toLowerCase()}</i>{#if cloud != null}{' '}with {Math.round(cloud)}% cloud cover{/if}, so you’re looking at {lead?.light === 'golden' ? 'something warm' : 'something moody'}.{/if}
                    The editor is an information systems student at the University of Utah who shoots portraits in the late afternoon and landscapes whenever the fog cooperates.
                </p>
                <button class="toggle" onclick={() => (color = !color)}>{color ? 'Print edition' : 'Color edition'}</button>
            </section>

            <!-- SIDEBAR -->
            <aside class="side">
                <section class="box">
                    <h3>Sun & Moon</h3>
                    <table>
                        <tbody>
                            <tr><th>Sunrise</th><td>{fmtMinutes(sun?.sunrise)}</td></tr>
                            <tr><th>Sunset</th><td>{fmtMinutes(sun?.sunset)}</td></tr>
                            <tr><th>Golden hour</th><td>{fmtMinutes(sun?.goldenEveningStart)} – {fmtMinutes(sun?.sunset)}</td></tr>
                            <tr><th>Blue hour ends</th><td>{fmtMinutes(sun?.blueEveningEnd)}</td></tr>
                            <tr><th>Length of day</th><td>{hm(dayLen(sun))}{#if lenDelta != null} <small>({lenDelta >= 0 ? '+' : '−'}{Math.abs(lenDelta)}m)</small>{/if}</td></tr>
                        </tbody>
                    </table>
                    {#if moon}
                        <div class="moon">
                            <svg viewBox="-34 -34 68 68" aria-hidden="true">
                                <circle r="30" class="dark" />
                                <path d={moonPath} class="lit" />
                            </svg>
                            <p><b>{moon.name}</b><br />{Math.round(moon.illum * 100)}% illuminated</p>
                        </div>
                    {/if}
                </section>

                <section class="box">
                    <h3>Shooting Forecast</h3>
                    {#if forecast}
                        <p class="stars" aria-label="{forecast.stars} out of 5">{'★'.repeat(forecast.stars)}{'☆'.repeat(5 - forecast.stars)}</p>
                        <p>{forecast.note}</p>
                        {#if offsetDays === 0 && wx?.current}<p class="small">Wind {Math.round(wx.current.wind_speed_10m)} mph · clouds {wx.current.cloud_cover}%</p>{/if}
                        {#if daily?.rain != null}<p class="small">Chance of precipitation {daily.rain}%</p>{/if}
                    {:else if wxError}
                        <p>The weather wire is down. Assume fog.</p>
                    {:else}
                        <p>Consulting the sky…</p>
                    {/if}
                    <p class="fine">Editor’s rule of thumb, not a meteorologist.</p>
                </section>

                <section class="box">
                    <h3>By the Numbers</h3>
                    <p>Of the editor’s last <b>{stats.photos}</b> portraits, <b>{stats.saturdayPct}%</b> were made on a Saturday and <b>{stats.lateAfternoonPct}%</b> between 4 and 7 p.m. Median aperture: <b>f/{stats.medianAperture}</b>.</p>
                </section>
            </aside>
        </div>

        <section class="archive">
            <h3>On This Day in the Archive</h3>
            <div class="arch-row">
                {#each onThisDay as p (p.id)}
                    <figure class="halftone small-fig">
                        <img src={p.src} alt={p.alt} loading="lazy" />
                        <figcaption>{niceDate(p.date)} — {p.away === 0 ? 'exactly this day' : `${p.away} days from today’s date`}</figcaption>
                    </figure>
                {/each}
            </div>
        </section>

        <section class="classifieds">
            <h3>Classifieds</h3>
            <div class="ads">
                <p><b>FOR VIEWING —</b> Tree of Life. Interactive map of convergent evolution; select a trait, watch unrelated lineages light up. <a href="/tree-of-life">Inquire within.</a></p>
                <p><b>PRIVATE SALE (not for sale) —</b> Local RAG assistant for macOS/iOS. Chats with your iMessage history. Never leaves your device.</p>
                <p><b>SERVICES —</b> Portraits: seniors, couples, dances. Shoots in the late afternoon. Ask about golden hour.</p>
                <p><b>WANTED —</b> Fog. Any amount. Will travel.</p>
                <p><b>FREE —</b> This website’s source code. <a href="https://github.com/twitterspree/jasonwride-studio">Pick up at GitHub.</a></p>
                <p><b>NOTICE —</b> This paper is computed in your browser. Sun & moon: math. Weather: Open-Meteo.</p>
            </div>
        </section>

        <footer class="letters">
            <h3>Letters to the Editor</h3>
            <p>Write in: <a href="mailto:jason.wride@utah.edu">jason.wride@utah.edu</a></p>
        </footer>
    </article>
{/if}

<style>
    .paper {
        --ink: #1b1a17;
        --paper: #f1ead9;
        --rule: #1b1a17;
        max-width: 1180px;
        margin: 3.6rem auto 4rem;
        padding: 2rem clamp(1rem, 3vw, 2.6rem) 3rem;
        background:
            radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.5), transparent 60%),
            radial-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px) 0 0 / 3px 3px,
            var(--paper);
        color: var(--ink);
        font-family: 'Old Standard TT', Georgia, serif;
        box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35);
    }

    .mast { border-bottom: 4px double var(--rule); padding-bottom: 0.5rem; }
    .ears { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1rem; }
    .ear { border: 1px solid var(--rule); padding: 0.4rem 0.6rem; font-size: 0.8rem; max-width: 170px; text-align: center; }
    .ear b { display: block; font-variant: small-caps; letter-spacing: 0.08em; }
    .ear.right { justify-self: end; }
    h1 {
        font-family: 'UnifrakturMaguntia', serif;
        font-weight: 400;
        font-size: clamp(2.4rem, 7.5vw, 5.6rem);
        line-height: 1;
        text-align: center;
        white-space: nowrap;
    }
    .tag { text-align: center; font-style: italic; margin: 0.3rem 0 0.6rem; }
    .dateline {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        border-top: 1px solid var(--rule);
        border-bottom: 1px solid var(--rule);
        padding: 0.3rem 0;
        font-variant: small-caps;
        letter-spacing: 0.05em;
        font-size: 0.95rem;
    }
    .dateline em { font-variant: normal; opacity: 0.7; }
    .dateline button { font: inherit; background: none; border: 0; cursor: pointer; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
    .dateline button:disabled { opacity: 0.3; cursor: default; }

    .columns { display: grid; grid-template-columns: 2fr 1fr; gap: 0; margin-top: 1rem; }
    .lead { padding-right: 1.6rem; border-right: 1px solid var(--rule); }
    .side { padding-left: 1.6rem; display: flex; flex-direction: column; gap: 1.2rem; }
    .headline {
        font-family: 'Old Standard TT', serif;
        font-weight: 700;
        font-size: clamp(1.7rem, 3.6vw, 2.9rem);
        line-height: 1.02;
        letter-spacing: -0.01em;
        margin-bottom: 0.8rem;
    }

    .halftone { position: relative; margin: 0 0 0.8rem; }
    .halftone img {
        width: 100%;
        aspect-ratio: 3 / 2;
        object-fit: cover;
        filter: grayscale(1) contrast(1.35) brightness(1.05);
        transition: filter 0.6s;
    }
    /* printed-dot texture over the photo */
    .halftone::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        aspect-ratio: 3 / 2;
        background: radial-gradient(circle, rgba(241, 234, 217, 0.6) 0.6px, transparent 1.2px) 0 0 / 3px 3px;
        mix-blend-mode: screen;
        pointer-events: none;
        transition: opacity 0.6s;
    }
    .color .halftone img { filter: none; }
    .color .halftone::after { opacity: 0; }
    figcaption { font-size: 0.85rem; line-height: 1.4; margin-top: 0.4rem; }
    .exif { font-family: ui-monospace, Menlo, monospace; font-size: 0.75rem; opacity: 0.75; }

    .dropcap { font-size: 1.05rem; line-height: 1.55; text-align: justify; hyphens: auto; columns: 2 220px; column-gap: 1.4rem; column-rule: 1px solid rgba(0, 0, 0, 0.2); }
    .dropcap::first-letter { font-family: 'UnifrakturMaguntia', serif; float: left; font-size: 3.6rem; line-height: 0.85; padding: 0.1rem 0.4rem 0 0; }
    .toggle { margin-top: 1rem; font: italic 0.95rem 'Old Standard TT', serif; background: none; border: 1px solid var(--ink); padding: 0.25rem 0.8rem; cursor: pointer; color: var(--ink); }
    .toggle:hover { background: var(--ink); color: var(--paper); }

    .box h3,
    .archive h3,
    .classifieds h3,
    .letters h3 {
        font-variant: small-caps;
        letter-spacing: 0.1em;
        font-size: 1.05rem;
        border-top: 3px solid var(--rule);
        border-bottom: 1px solid var(--rule);
        padding: 0.2rem 0;
        margin-bottom: 0.6rem;
        text-align: center;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th { text-align: left; font-weight: 400; font-style: italic; padding: 0.15rem 0; }
    td { text-align: right; font-variant-numeric: tabular-nums; }
    tr + tr { border-top: 1px dotted rgba(0, 0, 0, 0.35); }
    .moon { display: flex; gap: 0.8rem; align-items: center; margin-top: 0.8rem; font-size: 0.9rem; }
    .moon svg { width: 54px; height: 54px; flex: none; }
    .moon .dark { fill: #2a2925; }
    .moon .lit { fill: #f7f2e3; }
    .color .moon .lit { fill: #fff6cf; }
    .stars { font-size: 1.5rem; letter-spacing: 0.1em; }
    .small { font-size: 0.85rem; opacity: 0.8; }
    .fine { font-size: 0.75rem; font-style: italic; opacity: 0.6; margin-top: 0.3rem; }
    .box p { line-height: 1.45; }

    .archive { margin-top: 1.6rem; }
    .arch-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2rem; }
    .small-fig figcaption { font-style: italic; }

    .classifieds { margin-top: 1.6rem; }
    .ads { columns: 3 220px; column-gap: 1.4rem; column-rule: 1px solid rgba(0, 0, 0, 0.25); font-size: 0.92rem; line-height: 1.4; }
    .ads p { break-inside: avoid; margin-bottom: 0.7rem; border-bottom: 1px solid rgba(0, 0, 0, 0.15); padding-bottom: 0.6rem; }
    .ads a, .letters a { color: var(--ink); }

    .letters { margin-top: 1.4rem; text-align: center; }
    .letters p { font-size: 1.2rem; }

    @media (max-width: 820px) {
        .columns { grid-template-columns: 1fr; }
        .lead { padding-right: 0; border-right: 0; }
        .side { padding-left: 0; margin-top: 1.2rem; }
        .ears { grid-template-columns: 1fr; }
        .ear { display: none; }
        h1 { white-space: normal; }
        .arch-row { grid-template-columns: 1fr 1fr; }
        .dateline { font-size: 0.8rem; }
    }
</style>
