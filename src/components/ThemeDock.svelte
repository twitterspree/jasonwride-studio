<script>
  import { onMount } from 'svelte';

  const themes = [
    {
      id: 'cookie',
      name: 'Warm Studio',
      bg: '#FFF8F0',
      text: '#332D2D',
      card: '#FFFFFF',
      accent: '#FF9248',
      glass: 'rgba(255, 255, 255, 0.45)',
      border: 'rgba(255, 146, 72, 0.2)'
    },
    {
      id: 'lab',
      name: 'Deep Obsidian',
      bg: '#0A0D14',
      text: '#F0F3F8',
      card: '#121722',
      accent: '#5FBFF9',
      glass: 'rgba(18, 23, 34, 0.4)',  /* Lower opacity allows particle refraction */
      border: 'rgba(95, 191, 249, 0.2)'
    },
    {
      id: 'editorial',
      name: 'Architectural Paper',
      bg: '#F5F5F0',
      text: '#1C1C1A',
      card: '#FCFCF9',
      accent: '#E65C00',
      glass: 'rgba(245, 245, 240, 0.45)',
      border: 'rgba(28, 28, 26, 0.15)'
    },
    {
      id: 'forest',
      name: 'Nordic Moss',
      bg: '#0E1614',
      text: '#E2EBE6',
      card: '#162320',
      accent: '#48D597',
      glass: 'rgba(22, 35, 32, 0.4)',
      border: 'rgba(72, 213, 151, 0.2)'
    }
  ];

  let currentThemeId = 'cookie';
  let customAccent = '#FF9248';
  let isOpen = false;

  function applyTheme(theme, save = true) {
    currentThemeId = theme.id;
    customAccent = theme.accent;

    const root = document.documentElement;
    root.style.setProperty('--bg-base', theme.bg);
    root.style.setProperty('--text-base', theme.text);
    root.style.setProperty('--card-bg', theme.card);
    root.style.setProperty('--accent-color', theme.accent);
    root.style.setProperty('--glass-surface', theme.glass);
    root.style.setProperty('--glass-border', theme.border);
    
    // Explicitly sync <body> in case of layer detachment
    if (document.body) {
      document.body.style.backgroundColor = theme.bg;
      document.body.style.color = theme.text;
    }

    dispatchAccent(theme.accent);

    if (save) {
      localStorage.setItem('jw-palette', JSON.stringify({ id: theme.id, accent: theme.accent }));
    }
  }

  function dispatchAccent(color) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('accent-color-change', { detail: { color } }));
    }
  }

  function handleAccentChange(e) {
    customAccent = e.target.value;
    document.documentElement.style.setProperty('--accent-color', customAccent);
    dispatchAccent(customAccent);
    localStorage.setItem('jw-palette', JSON.stringify({ id: currentThemeId, accent: customAccent }));
  }

  onMount(() => {
    const saved = localStorage.getItem('jw-palette');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const match = themes.find(t => t.id === parsed.id) || themes[0];
        const loaded = { ...match, accent: parsed.accent || match.accent };
        applyTheme(loaded, false);
      } catch (err) {
        applyTheme(themes[0], false);
      }
    } else {
      applyTheme(themes[0], false);
    }
  });
</script>

<div class="liquid-dock {isOpen ? 'open' : ''}">
  <button 
    class="liquid-pill toggle-trigger" 
    on:click={() => (isOpen = !isOpen)}
    aria-label="Customize Palette"
  >
    <div class="swatch-ring" style="border-color: {customAccent};">
      <div class="swatch-fill" style="background: {customAccent};"></div>
    </div>
    <span class="pill-label">Theme Lab</span>
  </button>

  {#if isOpen}
    <div class="liquid-drawer">
      <div class="drawer-header">
        <span class="drawer-title">Palette System</span>
        <label class="custom-color-field" title="Pick precise accent hex">
          <input 
            type="color" 
            value={customAccent} 
            on:input={handleAccentChange} 
          />
          <span class="hex-readout">{customAccent.toUpperCase()}</span>
        </label>
      </div>

      <div class="theme-grid">
        {#each themes as t}
          <button 
            class="preset-card {currentThemeId === t.id ? 'active' : ''}" 
            on:click={() => applyTheme(t)}
          >
            <div class="preset-preview" style="background: {t.bg};">
              <span class="dot-accent" style="background: {t.accent};"></span>
              <span class="dot-text" style="background: {t.text};"></span>
            </div>
            <span class="preset-name">{t.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
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