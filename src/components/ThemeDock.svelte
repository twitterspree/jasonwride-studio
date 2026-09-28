<script>
  import { onMount } from 'svelte';

  // Token values live in global.css under [data-theme]; these are just for the picker UI.
  // Keep ids in sync with the boot script in Base.astro.
  const THEMES = [
    { id: 'cookie', name: 'Warm Studio', bg: '#FFF8F0', text: '#332D2D', accent: '#FF9248' },
    { id: 'lab', name: 'Deep Obsidian', bg: '#0A0D14', text: '#F0F3F8', accent: '#5FBFF9' },
    { id: 'editorial', name: 'Architectural Paper', bg: '#F5F5F0', text: '#1C1C1A', accent: '#E65C00' },
    { id: 'forest', name: 'Nordic Moss', bg: '#0E1614', text: '#E2EBE6', accent: '#48D597' }
  ];

  let currentThemeId = $state('cookie');
  let customAccent = $state(null);
  let isOpen = $state(false);
  let dock;

  const currentTheme = $derived(THEMES.find((t) => t.id === currentThemeId) ?? THEMES[0]);
  const accent = $derived(customAccent ?? currentTheme.accent);

  // Pick dark or light text for buttons sitting on the accent colour
  function onAccentFor(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1C1C1A' : '#FFFFFF';
  }

  function save() {
    try {
      localStorage.setItem('jw-palette', JSON.stringify({ id: currentThemeId, customAccent }));
    } catch {}
  }

  function applyTheme(id) {
    currentThemeId = id;
    customAccent = null;
    const root = document.documentElement;
    root.dataset.theme = id;
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--on-accent');
    save();
  }

  function handleAccentChange(e) {
    customAccent = e.currentTarget.value;
    const root = document.documentElement;
    root.style.setProperty('--accent-color', customAccent);
    root.style.setProperty('--on-accent', onAccentFor(customAccent));
    save();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && isOpen) isOpen = false;
  }

  function handlePointerDown(e) {
    if (isOpen && dock && !dock.contains(e.target)) isOpen = false;
  }

  onMount(() => {
    // The boot script in Base.astro has already applied the saved palette; just mirror it.
    const root = document.documentElement;
    currentThemeId = root.dataset.theme || 'cookie';
    try {
      const saved = JSON.parse(localStorage.getItem('jw-palette') || 'null');
      if (saved?.customAccent) customAccent = saved.customAccent;
    } catch {}
  });
</script>

<svelte:window onkeydown={handleKeydown} onpointerdown={handlePointerDown} />

<div class="liquid-dock" bind:this={dock}>
  {#if isOpen}
    <div class="liquid-drawer" id="theme-drawer" role="dialog" aria-label="Palette settings">
      <div class="drawer-header">
        <span class="drawer-title">Palette System</span>
        <label class="custom-color-field" title="Pick precise accent hex">
          <input type="color" value={accent} oninput={handleAccentChange} aria-label="Custom accent colour" />
          <span class="hex-readout">{accent.toUpperCase()}</span>
        </label>
      </div>

      <div class="theme-grid">
        {#each THEMES as t (t.id)}
          <button
            class="preset-card"
            class:active={currentThemeId === t.id}
            aria-pressed={currentThemeId === t.id}
            onclick={() => applyTheme(t.id)}
          >
            <span class="preset-preview" style:background={t.bg}>
              <span class="dot-accent" style:background={t.accent}></span>
              <span class="dot-text" style:background={t.text}></span>
            </span>
            <span class="preset-name">{t.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <button
    class="liquid-pill toggle-trigger"
    onclick={() => (isOpen = !isOpen)}
    aria-expanded={isOpen}
    aria-controls="theme-drawer"
  >
    <span class="swatch-ring" style:border-color={accent}>
      <span class="swatch-fill" style:background={accent}></span>
    </span>
    <span class="pill-label">Theme Lab</span>
  </button>
</div>

<style>
  .liquid-dock {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: 'Rubik', sans-serif;
  }

  /* --- LIQUID GLASS RECIPE --- */
  .liquid-pill,
  .liquid-drawer {
    background: var(--glass-surface, rgba(255, 255, 255, 0.45));
    backdrop-filter: blur(20px) saturate(190%);
    -webkit-backdrop-filter: blur(20px) saturate(190%);
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.3));
    
    /* Top specular highlight reflection */
    box-shadow: 
      inset 0 1px 1px 0 rgba(255, 255, 255, 0.35),
      inset 0 -1px 1px 0 rgba(0, 0, 0, 0.05),
      0 12px 36px rgba(0, 0, 0, 0.18);
  }

  .toggle-trigger {
    font: inherit;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    cursor: pointer;
    color: var(--text-base, #332D2D);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
  }

  .toggle-trigger:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      inset 0 1px 1px 0 rgba(255, 255, 255, 0.5),
      0 16px 40px rgba(0, 0, 0, 0.22);
  }

  .swatch-ring {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .swatch-fill {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .pill-label {
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: -0.2px;
  }

  .liquid-drawer {
    margin-bottom: 0.6rem;
    padding: 1.1rem;
    border-radius: 20px;
    width: 280px;
    color: var(--text-base, #332D2D);
    animation: drawerReveal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes drawerReveal {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.9rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(125, 125, 125, 0.15);
  }

  .drawer-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.8;
  }

  .custom-color-field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    background: rgba(125, 125, 125, 0.1);
    padding: 0.2rem 0.45rem;
    border-radius: 8px;
  }

  .custom-color-field input[type="color"] {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }

  .custom-color-field input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .custom-color-field input[type="color"]::-webkit-color-swatch {
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 50%;
  }

  .hex-readout {
    font-family: monospace;
    font-size: 0.72rem;
    font-weight: 600;
    opacity: 0.85;
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .preset-card {
    font: inherit;
    color: inherit;
    background: rgba(125, 125, 125, 0.08);
    border: 1px solid rgba(125, 125, 125, 0.12);
    border-radius: 12px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-card:hover {
    background: rgba(125, 125, 125, 0.15);
  }

  .preset-card.active {
    border-color: var(--accent-color);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }

  .preset-preview {
    width: 100%;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  .dot-accent, .dot-text {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .preset-name {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-base, #332D2D);
  }
</style>