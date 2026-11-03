/**
 * dsh-background-studio — browser half.
 *
 * A multi-style background layer plus a native-looking Settings section.
 * The layer sits behind #root and the DSH surfaces are made to reveal it through
 * the theme's existing alias tokens, so the feature follows DSH's own light /
 * dark switch and never repaints the whole design system.
 *
 * The bundle is hand-written for the DSH ModuleLoader: no build step, no
 * dependency beyond the React the shell already provides.
 */

window.__ModuleLoader__.load({
  id: 'dsh-background-studio',
  factory: require => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require('react');
    const { createElement: h, useCallback, useEffect, useRef, useState, useSyncExternalStore } = React;

    const STORAGE_KEY = 'dsh-background-studio:v1';
    const API_BASE = '/dsh-background-studio/api';
    const DEFAULTS = Object.freeze({
      enabled: true, style: 'obsidian', intensity: 'standard',
      opacity: 100, glass: true, fit: 'cover', customEnabled: true,
      color: '#121a24', colorEnabled: false
    });
    /** DSH's own surface, revealed as the backdrop fades out. */
    const SURFACE_COLOR = { light: '#ffffff', dark: '#0f1115' };
    const FITS = [
      { id: 'cover', label: '铺满' },
      { id: 'contain', label: '适应' },
      { id: 'tile', label: '平铺' }
    ];
    const QUICK_COLORS = [
      '#0f1115', '#121a24', '#1b2333', '#1f2a24',
      '#2a1f2d', '#3a2c22', '#e9eff4', '#efe9dd'
    ];

    /** Accepts #rgb / #rrggbb (with or without #) and expands to #rrggbb. */
    function parseColor(value) {
      if (typeof value !== 'string') return null;
      const raw = value.trim();
      const long = /^#?([0-9a-f]{6})$/i.exec(raw);
      if (long) return `#${long[1].toLowerCase()}`;
      const short = /^#?([0-9a-f]{3})$/i.exec(raw);
      if (short) return `#${short[1].split('').map(char => char + char).join('').toLowerCase()}`;
      return null;
    }
    const INTENSITIES = [
      { id: 'soft', label: '轻', opacity: 0.55 },
      { id: 'standard', label: '标准', opacity: 0.80 },
      { id: 'strong', label: '浓', opacity: 1 }
    ];

    const THEMES = [
      {
        id: 'obsidian', name: '曜石', en: 'OBSIDIAN',
        desc: '克制的炭黑与青绿微光，安静、不抢内容的原生气质。',
        dark: {
          base: '#161b19', top: '#1c2320',
          glowA: 'rgba(104, 193, 167, .28)', glowB: 'rgba(85, 119, 160, .20)', glowC: 'rgba(54, 82, 70, .26)',
          grid: 'rgba(255, 255, 255, .045)', gridSize: '84px', gridOpacity: .45,
          vignette: 'rgba(0, 0, 0, .38)', accent: '#78e0c2', accentInk: '#042019',
          sidebar: 'rgba(18, 22, 20, .64)', panel: 'rgba(20, 25, 22, .62)', line: 'rgba(255, 255, 255, .20)',
          ink: '#eef1ec', sub: 'rgba(238, 241, 236, .68)', noise: .045,
          swatches: ['#121514', '#78e0c2', '#5a7890']
        },
        light: {
          base: '#e9ebe6', top: '#f2f3ee',
          glowA: 'rgba(110, 180, 155, .32)', glowB: 'rgba(130, 160, 190, .24)', glowC: 'rgba(210, 200, 170, .28)',
          grid: 'rgba(30, 45, 38, .06)', gridSize: '84px', gridOpacity: .60,
          vignette: 'rgba(70, 85, 76, .10)', accent: '#1f7a62', accentInk: '#ffffff',
          sidebar: 'rgba(252, 252, 249, .68)', panel: 'rgba(255, 255, 255, .62)', line: 'rgba(30, 45, 38, .16)',
          ink: '#1f2622', sub: 'rgba(31, 38, 34, .62)', noise: .025,
          swatches: ['#e9ebe6', '#1f7a62', '#7d9c92']
        }
      },
      {
        id: 'aurora', name: '极光', en: 'AURORA',
        desc: '青绿、湛蓝与淡紫在深空里缓慢流动。',
        dark: {
          base: '#0e1619', top: '#152427',
          glowA: 'rgba(45, 212, 191, .36)', glowB: 'rgba(59, 130, 246, .30)', glowC: 'rgba(139, 92, 246, .24)',
          grid: 'rgba(170, 255, 240, .05)', gridSize: '72px', gridOpacity: .50,
          vignette: 'rgba(0, 0, 0, .32)', accent: '#5eead4', accentInk: '#04201c',
          sidebar: 'rgba(11, 17, 19, .62)', panel: 'rgba(12, 20, 21, .60)', line: 'rgba(200, 255, 245, .22)',
          ink: '#eef1ec', sub: 'rgba(238, 241, 236, .68)', noise: .045,
          swatches: ['#0b1013', '#5eead4', '#3b82f6']
        },
        light: {
          base: '#e7f1ed', top: '#f2f8f5',
          glowA: 'rgba(45, 190, 170, .30)', glowB: 'rgba(80, 140, 235, .23)', glowC: 'rgba(150, 110, 235, .16)',
          grid: 'rgba(20, 80, 70, .07)', gridSize: '72px', gridOpacity: .60,
          vignette: 'rgba(60, 80, 70, .08)', accent: '#0f7c70', accentInk: '#ffffff',
          sidebar: 'rgba(250, 253, 251, .68)', panel: 'rgba(255, 255, 255, .60)', line: 'rgba(20, 80, 70, .16)',
          ink: '#1f2622', sub: 'rgba(31, 38, 34, .62)', noise: .025,
          swatches: ['#e7f1ed', '#0f7c70', '#4f8fe0']
        }
      },
      {
        id: 'nebula', name: '星云', en: 'NEBULA',
        desc: '紫罗兰雾霭与微光尘埃，适合夜间沉浸。',
        dark: {
          base: '#151021', top: '#1e1833',
          glowA: 'rgba(139, 92, 246, .38)', glowB: 'rgba(236, 72, 153, .24)', glowC: 'rgba(59, 130, 246, .24)',
          grid: 'rgba(220, 210, 255, .035)', gridSize: '90px', gridOpacity: .30,
          vignette: 'rgba(0, 0, 0, .40)', accent: '#c4a7ff', accentInk: '#1a0f33',
          sidebar: 'rgba(16, 13, 25, .62)', panel: 'rgba(20, 16, 32, .60)', line: 'rgba(235, 225, 255, .20)',
          ink: '#f1edf8', sub: 'rgba(241, 237, 248, .68)', noise: .045,
          swatches: ['#0f0c17', '#c4a7ff', '#ec4899']
        },
        light: {
          base: '#f0edf7', top: '#f7f4fb',
          glowA: 'rgba(139, 92, 246, .24)', glowB: 'rgba(236, 72, 153, .17)', glowC: 'rgba(59, 130, 246, .14)',
          grid: 'rgba(70, 50, 110, .05)', gridSize: '90px', gridOpacity: .40,
          vignette: 'rgba(70, 60, 90, .08)', accent: '#7050c6', accentInk: '#ffffff',
          sidebar: 'rgba(252, 250, 255, .68)', panel: 'rgba(255, 255, 255, .60)', line: 'rgba(70, 50, 110, .15)',
          ink: '#241d33', sub: 'rgba(36, 29, 51, .62)', noise: .025,
          swatches: ['#f0edf7', '#7050c6', '#d36c9d']
        }
      },
      {
        id: 'blueprint', name: '蓝图', en: 'BLUEPRINT',
        desc: '冷青网格与工程线条，像一张发光的图纸。',
        dark: {
          base: '#0b1721', top: '#102231',
          glowA: 'rgba(56, 189, 248, .30)', glowB: 'rgba(59, 130, 246, .24)', glowC: 'rgba(14, 165, 233, .20)',
          grid: 'rgba(94, 208, 255, .11)', gridSize: '44px', gridOpacity: 1,
          vignette: 'rgba(0, 10, 20, .44)', accent: '#67d9ff', accentInk: '#03202d',
          sidebar: 'rgba(8, 16, 23, .64)', panel: 'rgba(10, 25, 35, .62)', line: 'rgba(150, 230, 255, .22)',
          ink: '#e8f6ff', sub: 'rgba(232, 246, 255, .66)', noise: .04,
          swatches: ['#081017', '#67d9ff', '#2f6fb0']
        },
        light: {
          base: '#e9eff4', top: '#f4f8fb',
          glowA: 'rgba(56, 189, 248, .24)', glowB: 'rgba(59, 130, 246, .16)', glowC: 'rgba(14, 165, 233, .12)',
          grid: 'rgba(25, 83, 115, .12)', gridSize: '40px', gridOpacity: 1,
          vignette: 'rgba(20, 50, 70, .07)', accent: '#146f96', accentInk: '#ffffff',
          sidebar: 'rgba(249, 252, 254, .68)', panel: 'rgba(255, 255, 255, .60)', line: 'rgba(25, 83, 115, .18)',
          ink: '#182a35', sub: 'rgba(24, 42, 53, .62)', noise: .025,
          swatches: ['#e9eff4', '#146f96', '#4a8fb5']
        }
      },
      {
        id: 'paper', name: '燕麦', en: 'PAPER',
        desc: '暖白纸感与低饱和光晕，明亮但不刺眼。',
        dark: {
          base: '#1a1611', top: '#211c16',
          glowA: 'rgba(230, 189, 131, .22)', glowB: 'rgba(190, 120, 80, .16)', glowC: 'rgba(110, 130, 140, .14)',
          grid: 'rgba(255, 240, 220, .03)', gridSize: '80px', gridOpacity: .35,
          vignette: 'rgba(0, 0, 0, .36)', accent: '#e8c08b', accentInk: '#2a1c0c',
          sidebar: 'rgba(24, 20, 15, .66)', panel: 'rgba(27, 22, 16, .62)', line: 'rgba(255, 240, 220, .20)',
          ink: '#f4eee4', sub: 'rgba(244, 238, 228, .68)', noise: .045,
          swatches: ['#16130f', '#e8c08b', '#b06f4c']
        },
        light: {
          base: '#efe9dd', top: '#f7f2e8',
          glowA: 'rgba(214, 166, 108, .32)', glowB: 'rgba(190, 120, 90, .18)', glowC: 'rgba(120, 150, 160, .14)',
          grid: 'rgba(90, 70, 45, .06)', gridSize: '80px', gridOpacity: .50,
          vignette: 'rgba(90, 70, 50, .10)', accent: '#95572c', accentInk: '#ffffff',
          sidebar: 'rgba(253, 250, 244, .68)', panel: 'rgba(255, 255, 255, .58)', line: 'rgba(90, 70, 45, .16)',
          ink: '#2a241c', sub: 'rgba(42, 36, 28, .62)', noise: .025,
          swatches: ['#efe9dd', '#95572c', '#c39a6a']
        }
      },
      {
        id: 'blossom', name: '樱雾', en: 'BLOSSOM',
        desc: '樱粉与薰衣草薄雾，柔和的日间氛围。',
        dark: {
          base: '#1b1319', top: '#241a20',
          glowA: 'rgba(244, 114, 182, .30)', glowB: 'rgba(167, 139, 250, .23)', glowC: 'rgba(251, 191, 36, .12)',
          grid: 'rgba(255, 220, 235, .035)', gridSize: '96px', gridOpacity: .30,
          vignette: 'rgba(0, 0, 0, .36)', accent: '#f4a8c4', accentInk: '#2c0e1c',
          sidebar: 'rgba(24, 16, 21, .64)', panel: 'rgba(28, 18, 23, .60)', line: 'rgba(255, 225, 238, .20)',
          ink: '#f8edf2', sub: 'rgba(248, 237, 242, .68)', noise: .045,
          swatches: ['#160f13', '#f4a8c4', '#a78bfa']
        },
        light: {
          base: '#f6ebef', top: '#fbf4f7',
          glowA: 'rgba(244, 114, 182, .28)', glowB: 'rgba(167, 139, 250, .20)', glowC: 'rgba(251, 191, 36, .11)',
          grid: 'rgba(110, 60, 80, .05)', gridSize: '96px', gridOpacity: .35,
          vignette: 'rgba(100, 60, 80, .08)', accent: '#b24a73', accentInk: '#ffffff',
          sidebar: 'rgba(255, 250, 252, .68)', panel: 'rgba(255, 255, 255, .58)', line: 'rgba(110, 60, 80, .15)',
          ink: '#2e2027', sub: 'rgba(46, 32, 39, .62)', noise: .025,
          swatches: ['#f6ebef', '#b24a73', '#9b7cc7']
        }
      }
    ];

    const THEME_BY_ID = new Map(THEMES.map(theme => [theme.id, theme]));
    const INTENSITY_BY_ID = new Map(INTENSITIES.map(item => [item.id, item]));

    const CSS = `
      #dsh-qbg-layer {
        position: fixed;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        background: linear-gradient(180deg, var(--qbg-top, #171b18) 0%, var(--qbg-base, #121514) 55%, var(--qbg-base, #121514) 100%);
      }
      #dsh-qbg-layer .qbg-wash {
        position: absolute;
        inset: -18%;
        background:
          radial-gradient(ellipse 55% 45% at 14% 2%, var(--qbg-glow-a, transparent), transparent 66%),
          radial-gradient(ellipse 46% 42% at 88% 6%, var(--qbg-glow-b, transparent), transparent 68%),
          radial-gradient(ellipse 60% 52% at 70% 100%, var(--qbg-glow-c, transparent), transparent 70%);
        filter: blur(26px) saturate(1.06);
        opacity: var(--qbg-wash-opacity, .8);
        animation: qbg-drift 30s ease-in-out infinite alternate;
        will-change: transform;
      }
      #dsh-qbg-layer .qbg-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(to right, var(--qbg-grid, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, var(--qbg-grid, transparent) 1px, transparent 1px);
        background-size: var(--qbg-grid-size, 84px) var(--qbg-grid-size, 84px);
        opacity: var(--qbg-grid-opacity, .45);
        -webkit-mask-image: radial-gradient(ellipse 90% 82% at 50% 28%, #000 6%, transparent 78%);
        mask-image: radial-gradient(ellipse 90% 82% at 50% 28%, #000 6%, transparent 78%);
      }
      #dsh-qbg-layer .qbg-noise {
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
        opacity: var(--qbg-noise-opacity, .035);
        mix-blend-mode: overlay;
      }
      #dsh-qbg-layer .qbg-vignette {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse 108% 92% at 50% 16%, transparent 40%, var(--qbg-vignette, rgba(0, 0, 0, .35)) 100%),
          linear-gradient(180deg, transparent 72%, var(--qbg-vignette, rgba(0, 0, 0, .35)));
      }
      #dsh-qbg-layer .qbg-custom {
        position: absolute;
        inset: 0;
        background-position: center center;
        background-repeat: no-repeat;
        background-size: cover;
        opacity: 0;
        transition: opacity .2s ease;
      }
      #dsh-qbg-layer .qbg-scrim {
        position: absolute;
        inset: 0;
        background: var(--qbg-scrim, transparent);
      }
      #dsh-qbg-layer .qbg-color {
        position: absolute;
        inset: 0;
        background: var(--qbg-color, #121a24);
        opacity: 0;
        transition: opacity .2s ease;
      }
      html[data-dsh-qbg-color="on"] #dsh-qbg-layer .qbg-color { opacity: 1; }
      html[data-dsh-qbg-color="on"] #dsh-qbg-layer .qbg-wash,
      html[data-dsh-qbg-color="on"] #dsh-qbg-layer .qbg-grid,
      html[data-dsh-qbg-color="on"] #dsh-qbg-layer .qbg-scrim { display: none; }
      html[data-dsh-qbg-color="on"] #dsh-qbg-layer .qbg-vignette { opacity: .35; }
      html[data-dsh-qbg="off"] #dsh-qbg-layer { display: none; }
      html[data-dsh-qbg="on"] { background-color: var(--qbg-surface, #ffffff); }
      html[data-dsh-qbg="on"] #root { position: relative; z-index: 1; }
      html[data-dsh-qbg="on"] body { background-color: transparent !important; }
      html[data-dsh-qbg="on"] #dsh-qbg-layer {
        opacity: var(--qbg-layer-opacity, 1);
        filter: saturate(var(--qbg-layer-saturate, 1));
        transition: opacity .16s linear, filter .16s linear;
      }
      html[data-dsh-qbg-image="on"] #dsh-qbg-layer .qbg-custom { opacity: 1; }
      html[data-dsh-qbg-image="on"][data-dsh-qbg-fit="contain"] #dsh-qbg-layer .qbg-custom {
        background-size: contain;
        background-color: var(--qbg-base);
      }
      html[data-dsh-qbg-image="on"][data-dsh-qbg-fit="tile"] #dsh-qbg-layer .qbg-custom {
        background-size: auto;
        background-repeat: repeat;
      }
      html[data-dsh-qbg-image="on"] #dsh-qbg-layer .qbg-grid { display: none; }
      html[data-dsh-qbg-image="on"] #dsh-qbg-layer .qbg-wash {
        opacity: calc(var(--qbg-wash-opacity, .8) * .35);
      }
      html[data-dsh-qbg="on"][data-dsh-qbg-glass="on"] body {
        --dsw-alias-bg-base: transparent;
        --dsw-specific-sidebar-fill: transparent;
      }
      html[data-dsh-qbg="on"] body #root > div[style*="grid-template-columns"] {
        background-color: transparent !important;
      }
      html[data-dsh-qbg="on"][data-dsh-qbg-glass="on"] [class*="sidebarCol"] {
        background-color: transparent !important;
      }
      @keyframes qbg-drift {
        0% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(1.2%, -1.6%, 0) scale(1.035); }
        100% { transform: translate3d(-1.4%, 1.2%, 0) scale(1.02); }
      }
      html[data-dsh-qbg-glass="off"] #dsh-qbg-layer .qbg-wash { animation: none; }
      @media (prefers-reduced-motion: reduce) {
        #dsh-qbg-layer .qbg-wash { animation: none; }
      }

      .qbg-page {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 100%;
        padding: 2px 0 16px;
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        line-height: 1.55;
      }
      .qbg-page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
      }
      .qbg-page-head h2 {
        margin: 0;
        font-size: 16px;
        line-height: 24px;
        font-weight: 600;
        letter-spacing: -.012em;
      }
      .qbg-page-head p {
        margin: 5px 0 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
        line-height: 20px;
      }
      .qbg-page-head .qbg-head-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: none;
        padding-top: 2px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
      }
      .qbg-stage {
        position: relative;
        min-height: 156px;
        margin-top: 1px;
        padding: 14px;
        overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 12px;
        color: var(--stage-ink, #eef1ec);
        background:
          var(--stage-image, none) center / cover no-repeat,
          radial-gradient(ellipse 70% 100% at 12% -8%, var(--stage-glow-a, transparent), transparent 68%),
          radial-gradient(ellipse 65% 90% at 94% 110%, var(--stage-glow-b, transparent), transparent 65%),
          linear-gradient(180deg, var(--stage-top, #171b18), var(--stage-base, #121514));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 10px 30px rgba(0, 0, 0, .10);
      }
      .qbg-stage::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(to right, var(--stage-grid, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, var(--stage-grid, transparent) 1px, transparent 1px);
        background-size: 22px 22px;
        -webkit-mask-image: linear-gradient(to bottom, #000, transparent 95%);
        mask-image: linear-gradient(to bottom, #000, transparent 95%);
        pointer-events: none;
      }
      .qbg-stage__top {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .qbg-stage__label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        font-size: 11px;
        font-weight: 500;
        color: var(--stage-ink, #eef1ec);
      }
      .qbg-stage__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--stage-accent, #78e0c2);
        box-shadow: 0 0 9px var(--stage-accent, #78e0c2);
        flex: none;
      }
      .qbg-stage__label em {
        color: var(--stage-sub, rgba(238, 241, 236, .68));
        font-style: normal;
        font-weight: 400;
      }
      .qbg-stage__mode {
        flex: none;
        padding: 2px 7px;
        border: 1px solid var(--stage-line, rgba(255, 255, 255, .2));
        border-radius: 99px;
        color: var(--stage-sub, rgba(238, 241, 236, .68));
        font-size: 10px;
        line-height: 16px;
      }
      .qbg-stage__mock {
        position: relative;
        z-index: 1;
        display: flex;
        height: 72px;
        margin-top: 13px;
        overflow: hidden;
        border: 1px solid var(--stage-line, rgba(255, 255, 255, .2));
        border-radius: 8px;
        background: var(--stage-panel, rgba(20, 25, 22, .62));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .qbg-stage__rail {
        width: 18%;
        border-right: 1px solid var(--stage-line, rgba(255, 255, 255, .2));
        background: rgba(0, 0, 0, .10);
      }
      .qbg-stage__content {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        padding: 10px 12px;
      }
      .qbg-stage__content i {
        display: block;
        height: 3px;
        border-radius: 2px;
        background: var(--stage-line, rgba(255, 255, 255, .2));
      }
      .qbg-stage__content i:nth-child(1) { width: 52%; }
      .qbg-stage__content i:nth-child(2) { width: 78%; }
      .qbg-stage__content i:nth-child(3) {
        width: 33%;
        background: var(--stage-accent, #78e0c2);
      }
      .qbg-stage__foot {
        position: relative;
        z-index: 1;
        margin-top: 9px;
        color: var(--stage-sub, rgba(238, 241, 236, .68));
        font-size: 10px;
      }
      .qbg-section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 9px;
      }
      .qbg-section-head h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
      }
      .qbg-section-head span {
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
      }
      .qbg-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 9px;
      }
      .qbg-card {
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 6px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        text-align: left;
        cursor: pointer;
        transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
      }
      .qbg-card:hover { background: var(--dsw-alias-bg-layer-2); }
      .qbg-card:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .qbg-card[aria-checked="true"] {
        border-color: var(--thumb-accent);
        box-shadow: 0 0 0 1px var(--thumb-accent);
      }
      .qbg-thumb {
        position: relative;
        display: block;
        height: 62px;
        overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 6px;
        background:
          radial-gradient(ellipse 76% 100% at 13% -12%, var(--thumb-glow-a), transparent 70%),
          radial-gradient(ellipse 66% 86% at 94% 112%, var(--thumb-glow-b), transparent 70%),
          var(--thumb-base);
      }
      .qbg-thumb::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(to right, var(--thumb-grid) 1px, transparent 1px),
          linear-gradient(to bottom, var(--thumb-grid) 1px, transparent 1px);
        background-size: 16px 16px;
        -webkit-mask-image: linear-gradient(to bottom, #000, transparent 92%);
        mask-image: linear-gradient(to bottom, #000, transparent 92%);
      }
      .qbg-thumb__rail {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 17%;
        border-right: 1px solid var(--thumb-line);
        background: rgba(0, 0, 0, .10);
      }
      .qbg-thumb__panel {
        position: absolute;
        left: 26%;
        top: 23%;
        width: 52%;
        height: 51%;
        border: 1px solid var(--thumb-line);
        border-radius: 4px;
        background: var(--thumb-panel);
      }
      .qbg-thumb__accent {
        position: absolute;
        left: 33%;
        top: 59%;
        width: 30%;
        height: 3px;
        border-radius: 2px;
        background: var(--thumb-accent);
      }
      .qbg-thumb__check {
        position: absolute;
        top: 5px;
        right: 5px;
        display: grid;
        place-items: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--thumb-accent);
        color: var(--thumb-accent-ink);
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
      }
      .qbg-card__title {
        display: flex;
        align-items: baseline;
        gap: 5px;
        min-width: 0;
        padding: 7px 2px 0;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .qbg-card__title em {
        overflow: hidden;
        color: var(--dsw-alias-label-tertiary);
        font-family: var(--ds-font-family-code);
        font-size: 8px;
        font-style: normal;
        font-weight: 400;
        letter-spacing: .06em;
        text-overflow: ellipsis;
      }
      .qbg-card__desc {
        display: block;
        min-height: 30px;
        padding: 1px 2px 2px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 10.5px;
        line-height: 1.42;
      }
      .qbg-controls {
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--dsw-alias-border-l1);
      }
      .qbg-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 13px 0;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      .qbg-row__text { min-width: 0; }
      .qbg-row__text strong {
        display: block;
        font-size: 13px;
        font-weight: 500;
      }
      .qbg-row__text span {
        display: block;
        margin-top: 2px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 1.5;
      }
      .qbg-seg {
        display: inline-flex;
        flex: none;
        gap: 2px;
        padding: 3px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 7px;
        background: var(--dsw-alias-bg-layer-2);
      }
      .qbg-seg button {
        height: 25px;
        padding: 0 9px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
      }
      .qbg-seg button:hover { color: var(--dsw-alias-label-primary); }
      .qbg-seg button[aria-checked="true"] {
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        box-shadow: 0 1px 3px rgba(0, 0, 0, .14), inset 0 0 0 1px var(--dsw-alias-border-l1);
      }
      .qbg-switch {
        position: relative;
        flex: none;
        width: 34px;
        height: 20px;
        padding: 0;
        border: 1px solid var(--dsw-alias-border-l3);
        border-radius: 99px;
        background: var(--dsw-alias-bg-layer-3);
        cursor: pointer;
        transition: background-color .18s ease, border-color .18s ease;
      }
      .qbg-switch::after {
        content: "";
        position: absolute;
        left: 3px;
        top: 3px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--dsw-alias-switch-thumb, #fff);
        box-shadow: 0 1px 2px rgba(0, 0, 0, .24);
        transition: transform .18s ease, background-color .18s ease;
      }
      .qbg-switch[aria-checked="true"] {
        border-color: transparent;
        background: var(--qbg-accent, #78e0c2);
      }
      .qbg-switch[aria-checked="true"]::after {
        background: var(--qbg-accent-ink, #042019);
        transform: translateX(14px);
      }
      .qbg-switch:focus-visible,
      .qbg-seg button:focus-visible,
      .qbg-reset:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .qbg-slider {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: none;
        width: 220px;
        max-width: 46%;
      }
      .qbg-slider input[type="range"] {
        flex: 1;
        min-width: 0;
        height: 20px;
        margin: 0;
        accent-color: var(--qbg-accent, #78e0c2);
        cursor: pointer;
      }
      .qbg-slider output {
        flex: none;
        min-width: 38px;
        text-align: right;
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .qbg-slider input[type="range"]:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .qbg-stage__veil {
        position: absolute;
        inset: 0;
        z-index: 2;
        border-radius: inherit;
        pointer-events: none;
      }
      .qbg-image {
        display: flex;
        align-items: stretch;
        gap: 12px;
      }
      .qbg-image__preview {
        position: relative;
        flex: none;
        width: 154px;
        height: 87px;
        overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 8px;
        background-color: var(--dsw-alias-bg-layer-2);
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
      }
      .qbg-image__preview.is-empty {
        display: grid;
        place-items: center;
        border-style: dashed;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
      }
      .qbg-image__body {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        gap: 7px;
        min-width: 0;
      }
      .qbg-image__name {
        overflow: hidden;
        color: var(--dsw-alias-label-primary);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .qbg-image__meta {
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
        line-height: 1.5;
      }
      .qbg-image__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .qbg-btn {
        height: 26px;
        padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 6px;
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
      }
      .qbg-btn:hover { background: var(--dsw-alias-bg-layer-2); }
      .qbg-btn.is-primary {
        border-color: transparent;
        background: var(--qbg-accent, #78e0c2);
        color: var(--qbg-accent-ink, #042019);
      }
      .qbg-btn:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .qbg-file {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .qbg-image.is-dragging .qbg-image__preview {
        border-color: var(--qbg-accent, #78e0c2);
        box-shadow: 0 0 0 1px var(--qbg-accent, #78e0c2);
      }
      .qbg-color-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .qbg-swatch {
        position: relative;
        flex: none;
        width: 46px;
        height: 46px;
        overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 10px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);
        cursor: pointer;
      }
      .qbg-swatch input[type="color"] {
        position: absolute;
        inset: -10px;
        width: calc(100% + 20px);
        height: calc(100% + 20px);
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
        opacity: 0;
      }
      .qbg-swatch:focus-within {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .qbg-color-fields {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .qbg-hex {
        width: 106px;
        height: 28px;
        padding: 0 8px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 6px;
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        font-family: var(--ds-font-family-code);
        font-size: 12px;
        text-transform: uppercase;
      }
      .qbg-hex:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 1px;
      }
      .qbg-color-hint {
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
      }
      .qbg-color-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .qbg-color-quick button {
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid rgba(128, 128, 128, .35);
        border-radius: 50%;
        cursor: pointer;
      }
      .qbg-color-quick button[aria-checked="true"] {
        box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1), 0 0 0 3px var(--dsw-alias-label-secondary);
      }
      .qbg-color-quick button:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .qbg-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding-top: 2px;
      }
      .qbg-notice {
        min-height: 16px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
      }
      .qbg-reset {
        flex: none;
        padding: 3px 0;
        border: 0;
        border-bottom: 1px dashed var(--dsw-alias-border-l3);
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
      }
      .qbg-reset:hover { color: var(--dsw-alias-label-primary); }
      .qbg-offline .qbg-card,
      .qbg-offline .qbg-controls { opacity: .62; }
      @media (max-width: 620px) {
        .qbg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .qbg-page-head { flex-direction: column; gap: 10px; }
      }
      @media (max-width: 420px) {
        .qbg-grid { grid-template-columns: 1fr; }
        .qbg-row { flex-direction: column; align-items: flex-start; gap: 8px; }
        .qbg-row .qbg-seg { width: 100%; }
        .qbg-row .qbg-seg button { flex: 1; }
        .qbg-slider { width: 100%; max-width: none; }
      }
    `;

    function readMode() {
      return document.body && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
    }

    function normalizeSettings(saved) {
      if (!saved || typeof saved !== 'object') return { ...DEFAULTS };
      return {
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULTS.enabled,
        style: THEME_BY_ID.has(saved.style) ? saved.style : DEFAULTS.style,
        intensity: INTENSITY_BY_ID.has(saved.intensity) ? saved.intensity : DEFAULTS.intensity,
        // The old "transparency" scale pointed the other way and its top end
        // erased the backdrop, which read as "the slider does nothing". Migrate
        // once to a fully visible backdrop instead of preserving a dead setting.
        opacity: Number.isFinite(saved.opacity)
          ? Math.min(100, Math.max(0, Math.round(saved.opacity)))
          : DEFAULTS.opacity,
        glass: typeof saved.glass === 'boolean' ? saved.glass : DEFAULTS.glass,
        fit: FITS.some(item => item.id === saved.fit) ? saved.fit : DEFAULTS.fit,
        customEnabled: typeof saved.customEnabled === 'boolean' ? saved.customEnabled : DEFAULTS.customEnabled,
        color: parseColor(saved.color) || DEFAULTS.color,
        colorEnabled: typeof saved.colorEnabled === 'boolean' ? saved.colorEnabled : DEFAULTS.colorEnabled
      };
    }

    function loadState() {
      try {
        return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
      } catch (error) {
        return { ...DEFAULTS };
      }
    }

    function normalizeImage(value) {
      if (!value || typeof value.url !== 'string' || value.url.length === 0) return null;
      return {
        url: value.url,
        name: typeof value.name === 'string' ? value.name : '背景图',
        width: Number.isFinite(value.width) ? value.width : 0,
        height: Number.isFinite(value.height) ? value.height : 0,
        size: Number.isFinite(value.size) ? value.size : 0
      };
    }

    /** Downscales large photos before they cross the Host boundary; keeps originals small. */
    function prepareImage(file) {
      if (!file) return Promise.reject(new Error('没有选择文件'));
      if (file.type && !file.type.startsWith('image/')) return Promise.reject(new Error('请选择图片文件'));
      if (file.size > 24 * 1024 * 1024) return Promise.reject(new Error('图片超过 24 MB'));
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const probe = new Image();
        probe.onload = () => {
          const max = 2560;
          const sourceWidth = probe.naturalWidth || 1;
          const sourceHeight = probe.naturalHeight || 1;
          const scale = Math.min(1, max / Math.max(sourceWidth, sourceHeight));
          const width = Math.max(1, Math.round(sourceWidth * scale));
          const height = Math.max(1, Math.round(sourceHeight * scale));
          const done = blob => {
            URL.revokeObjectURL(objectUrl);
            resolve({ blob, width, height });
          };
          if (scale >= 1 && file.size <= 1.2 * 1024 * 1024) {
            done(file);
            return;
          }
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) {
              done(file);
              return;
            }
            context.drawImage(probe, 0, 0, width, height);
            canvas.toBlob(blob => {
              if (blob && blob.size > 0 && blob.size <= file.size) {
                done(blob);
                return;
              }
              canvas.toBlob(fallback => done(fallback || file), 'image/jpeg', 0.88);
            }, 'image/webp', 0.86);
          } catch (error) {
            done(file);
          }
        };
        probe.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('无法读取这张图片'));
        };
        probe.src = objectUrl;
      });
    }

    function saveState(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) { /* private windows may refuse storage; the session still works */ }
    }

    function createStudio() {
      let state = loadState();
      let mode = readMode();
      let image = null;
      let snapshot = Object.freeze({ ...state, mode, image });
      let styleElement;
      let layerElement;
      let customElement;
      let observer;
      let persistTimer = 0;
      const listeners = new Set();
      const cssVars = [
        '--qbg-base', '--qbg-top', '--qbg-glow-a', '--qbg-glow-b', '--qbg-glow-c',
        '--qbg-grid', '--qbg-grid-size', '--qbg-grid-opacity', '--qbg-vignette',
        '--qbg-accent', '--qbg-accent-ink', '--qbg-sidebar', '--qbg-wash-opacity',
        '--qbg-noise-opacity', '--qbg-layer-opacity', '--qbg-layer-saturate',
        '--qbg-surface', '--qbg-scrim', '--qbg-color'
      ];

      const emit = () => {
        snapshot = Object.freeze({ ...state, mode, image });
        for (const listener of listeners) listener();
      };

      const apply = () => {
        const theme = THEME_BY_ID.get(state.style) || THEMES[0];
        const palette = theme[mode];
        const intensity = INTENSITY_BY_ID.get(state.intensity) || INTENSITY_BY_ID.get('standard');
        const opacity = Math.min(100, Math.max(0, Number(state.opacity) || 0)) / 100;
        const useColor = Boolean(state.colorEnabled);
        const hasImage = Boolean(image && state.customEnabled && !useColor);
        const color = parseColor(state.color) || DEFAULTS.color;
        const root = document.documentElement;

        root.dataset.dshQbg = state.enabled ? 'on' : 'off';
        root.dataset.dshQbgGlass = state.glass ? 'on' : 'off';
        root.dataset.dshQbgStyle = theme.id;
        root.dataset.dshQbgFit = state.fit;
        root.dataset.dshQbgImage = hasImage ? 'on' : 'off';
        root.dataset.dshQbgColor = useColor ? 'on' : 'off';

        const values = {
          '--qbg-base': palette.base,
          '--qbg-top': palette.top,
          '--qbg-glow-a': palette.glowA,
          '--qbg-glow-b': palette.glowB,
          '--qbg-glow-c': palette.glowC,
          '--qbg-grid': palette.grid,
          '--qbg-grid-size': palette.gridSize,
          '--qbg-grid-opacity': String(palette.gridOpacity),
          '--qbg-vignette': palette.vignette,
          '--qbg-accent': palette.accent,
          '--qbg-accent-ink': palette.accentInk,
          '--qbg-sidebar': palette.sidebar,
          '--qbg-wash-opacity': String(intensity.opacity),
          '--qbg-noise-opacity': String(palette.noise),
          '--qbg-layer-opacity': opacity.toFixed(3),
          '--qbg-layer-saturate': (0.5 + opacity * 0.5).toFixed(3),
          '--qbg-surface': SURFACE_COLOR[mode] || SURFACE_COLOR.light,
          '--qbg-color': color,
          '--qbg-scrim': hasImage
            ? (mode === 'dark' ? 'rgba(6, 8, 10, .34)' : 'rgba(255, 255, 255, .20)')
            : 'transparent'
        };
        for (const [key, value] of Object.entries(values)) root.style.setProperty(key, value);
        if (customElement) {
          customElement.style.backgroundImage = hasImage ? `url("${image.url}")` : 'none';
        }
        emit();
      };

      const persist = () => {
        window.clearTimeout(persistTimer);
        persistTimer = window.setTimeout(() => {
          const payload = {
            enabled: state.enabled,
            style: state.style,
            intensity: state.intensity,
            opacity: state.opacity,
            glass: state.glass,
            fit: state.fit,
            customEnabled: state.customEnabled,
            color: state.color,
            colorEnabled: state.colorEnabled
          };
          fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => { /* no Host route (or offline): the local mirror still works */ });
        }, 140);
      };

      const set = patch => {
        state = { ...state, ...patch };
        saveState(state);
        persist();
        apply();
      };

      const hydrate = async () => {
        try {
          const response = await fetch(`${API_BASE}/state`, { cache: 'no-store' });
          if (!response.ok) return;
          const remote = await response.json();
          const settings = remote?.settings;
          if (settings && typeof settings === 'object' && Object.keys(settings).length > 0) {
            state = normalizeSettings(settings);
            saveState(state);
          }
          image = normalizeImage(remote?.image);
          apply();
        } catch { /* Host route unavailable: keep the local mirror */ }
      };

      const uploadImage = async file => {
        const prepared = await prepareImage(file);
        const response = await fetch(
          `${API_BASE}/image?name=${encodeURIComponent(file.name || 'background')}&w=${prepared.width}&h=${prepared.height}`,
          { method: 'POST', headers: { 'content-type': prepared.blob.type || 'application/octet-stream' }, body: prepared.blob }
        );
        if (!response.ok) throw new Error(`上传失败（HTTP ${response.status}）`);
        const payload = await response.json();
        image = normalizeImage(payload?.image);
        state = { ...state, customEnabled: true };
        saveState(state);
        persist();
        apply();
      };

      const removeImage = async () => {
        try {
          await fetch(`${API_BASE}/image`, { method: 'DELETE' });
        } catch { /* the file may already be gone */ }
        image = null;
        apply();
      };

      const mount = () => {
        if (typeof document === 'undefined' || !document.body) return () => {};
        document.getElementById('dsh-qbg-style')?.remove();
        document.getElementById('dsh-qbg-layer')?.remove();

        styleElement = document.createElement('style');
        styleElement.id = 'dsh-qbg-style';
        styleElement.textContent = CSS;
        document.head.appendChild(styleElement);

        layerElement = document.createElement('div');
        layerElement.id = 'dsh-qbg-layer';
        layerElement.setAttribute('aria-hidden', 'true');
        layerElement.innerHTML = '<div class="qbg-color"></div><div class="qbg-custom"></div><div class="qbg-scrim"></div><div class="qbg-wash"></div><div class="qbg-grid"></div><div class="qbg-noise"></div><div class="qbg-vignette"></div>';
        document.body.insertBefore(layerElement, document.body.firstChild);
        customElement = layerElement.querySelector('.qbg-custom');

        mode = readMode();
        apply();
        void hydrate();

        observer = new MutationObserver(() => {
          const next = readMode();
          if (next === mode) return;
          mode = next;
          apply();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });

        return () => {
          observer?.disconnect();
          observer = undefined;
          window.clearTimeout(persistTimer);
          layerElement?.remove();
          styleElement?.remove();
          layerElement = undefined;
          styleElement = undefined;
          customElement = undefined;
          const root = document.documentElement;
          delete root.dataset.dshQbg;
          delete root.dataset.dshQbgGlass;
          delete root.dataset.dshQbgStyle;
          delete root.dataset.dshQbgFit;
          delete root.dataset.dshQbgImage;
          delete root.dataset.dshQbgColor;
          for (const property of cssVars) root.style.removeProperty(property);
        };
      };

      const subscribe = listener => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      };

      return {
        mount,
        set,
        uploadImage,
        removeImage,
        refresh: hydrate,
        subscribe,
        getSnapshot: () => snapshot,
        getMode: () => mode
      };
    }

    function themeVars(theme, mode) {
      const palette = theme[mode];
      return {
        '--thumb-base': palette.base,
        '--thumb-glow-a': palette.glowA,
        '--thumb-glow-b': palette.glowB,
        '--thumb-grid': palette.grid,
        '--thumb-panel': palette.panel,
        '--thumb-line': palette.line,
        '--thumb-accent': palette.accent,
        '--thumb-accent-ink': palette.accentInk
      };
    }

    function stageVars(theme, mode) {
      const palette = theme[mode];
      return {
        '--stage-base': palette.base,
        '--stage-top': palette.top,
        '--stage-glow-a': palette.glowA,
        '--stage-glow-b': palette.glowB,
        '--stage-grid': palette.grid,
        '--stage-panel': palette.panel,
        '--stage-line': palette.line,
        '--stage-accent': palette.accent,
        '--stage-ink': palette.ink,
        '--stage-sub': palette.sub
      };
    }

    function BackgroundPage({ studio }) {
      const snapshot = useSyncExternalStore(studio.subscribe, studio.getSnapshot);
      const theme = THEME_BY_ID.get(snapshot.style) || THEMES[0];
      const [notice, setNotice] = useState('');
      const noticeTimer = useRef(0);
      const cardRefs = useRef([]);
      const fileRef = useRef(null);
      const [busy, setBusy] = useState(false);
      const [dragging, setDragging] = useState(false);
      const [colorDraft, setColorDraft] = useState(snapshot.color);

      useEffect(() => {
        setColorDraft(prev => (parseColor(prev) === snapshot.color ? prev : snapshot.color));
      }, [snapshot.color]);

      useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

      const announce = useCallback(message => {
        setNotice(message);
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(''), 1800);
      }, []);

      const choose = useCallback((id, index) => {
        const next = THEME_BY_ID.get(id);
        if (!next) return;
        studio.set({ style: id, colorEnabled: false });
        announce(`已切换至「${next.name}」`);
        if (index !== undefined) cardRefs.current[index]?.focus();
      }, [announce, studio]);

      const onGridKeyDown = useCallback((event, index) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const next = (index + direction + THEMES.length) % THEMES.length;
        choose(THEMES[next].id, next);
      }, [choose]);

      const enable = () => {
        studio.set({ enabled: !snapshot.enabled });
        announce(snapshot.enabled ? '背景已关闭' : '背景已开启');
      };
      const setIntensity = value => {
        studio.set({ intensity: value });
        const label = INTENSITY_BY_ID.get(value)?.label;
        announce(`背景强度：${label}`);
      };
      const setOpacity = value => {
        studio.set({ opacity: Math.min(100, Math.max(0, Number(value) || 0)) });
      };
      const toggleGlass = () => {
        studio.set({ glass: !snapshot.glass });
        announce(snapshot.glass ? '已关闭面板透出' : '已开启面板透出');
      };
      const reset = () => {
        studio.set({ ...DEFAULTS });
        announce('已恢复默认背景');
      };

      const pickFile = () => fileRef.current?.click();

      const acceptFile = async file => {
        if (!file || busy) return;
        setBusy(true);
        try {
          await studio.uploadImage(file);
          announce(`已应用背景图：${file.name || '图片'}`);
        } catch (error) {
          announce(error?.message || '图片处理失败');
        } finally {
          setBusy(false);
          if (fileRef.current) fileRef.current.value = '';
        }
      };

      const onDrop = event => {
        event.preventDefault();
        setDragging(false);
        void acceptFile(event.dataTransfer?.files?.[0]);
      };
      const removeImage = async () => {
        await studio.removeImage();
        announce('已移除自定义背景图');
      };
      const toggleCustom = () => {
        const next = !snapshot.customEnabled;
        studio.set(next ? { customEnabled: true, colorEnabled: false } : { customEnabled: false });
        announce(next ? '已启用自定义背景图' : '已停用自定义背景图');
      };

      const applyColor = value => {
        const parsed = parseColor(value);
        if (!parsed) return false;
        studio.set({ color: parsed, colorEnabled: true });
        return true;
      };
      const onColorInput = value => {
        setColorDraft(value);
        applyColor(value);
      };
      const onColorText = value => {
        setColorDraft(value);
        if (parseColor(value)) applyColor(value);
      };
      const toggleColor = () => {
        studio.set({ colorEnabled: !snapshot.colorEnabled });
        announce(snapshot.colorEnabled ? '已停用纯色背景' : '已启用纯色背景');
      };

      const hasImage = Boolean(snapshot.image);
      const usingColor = Boolean(snapshot.colorEnabled);
      const usingImage = hasImage && snapshot.customEnabled && !usingColor;
      const imageUrl = hasImage ? snapshot.image.url : '';
      const imageMeta = hasImage
        ? [
            snapshot.image.width && snapshot.image.height ? `${snapshot.image.width}×${snapshot.image.height}` : '',
            snapshot.image.size ? `${Math.max(1, Math.round(snapshot.image.size / 1024))} KB` : ''
          ].filter(Boolean).join(' · ')
        : '';

      return h('div', { className: `qbg-page${snapshot.enabled ? '' : ' qbg-offline'}` },
        h('div', { className: 'qbg-page-head' },
          h('div', null,
            h('h2', null, '背景'),
            h('p', null, '多风格背景、自己的图片或任意纯色，背景跟随 DSH 的明暗主题，从侧栏与主画布后透出。')
          ),
          h('div', { className: 'qbg-head-toggle' },
            h('span', null, snapshot.enabled ? '已开启' : '已关闭'),
            h('button', {
              type: 'button',
              className: 'qbg-switch',
              role: 'switch',
              'aria-checked': snapshot.enabled,
              'aria-label': snapshot.enabled ? '关闭背景' : '开启背景',
              onClick: enable
            })
          )
        ),

        h('div', {
          className: 'qbg-stage',
          style: {
            ...stageVars(theme, snapshot.mode),
            ...(usingColor ? {
              '--stage-base': snapshot.color,
              '--stage-top': snapshot.color,
              '--stage-glow-a': 'transparent',
              '--stage-glow-b': 'transparent',
              '--stage-grid': 'transparent'
            } : {}),
            '--stage-image': usingImage ? `url("${imageUrl}")` : 'none'
          },
          'aria-label': `当前背景预览：${usingColor ? `纯色 ${snapshot.color}` : usingImage ? '自定义背景图' : theme.name}，${snapshot.mode === 'dark' ? '深色' : '浅色'}，不透明度 ${snapshot.opacity}%`
        },
          h('div', { className: 'qbg-stage__top' },
            h('span', { className: 'qbg-stage__label' },
              h('span', { className: 'qbg-stage__dot' }),
              snapshot.enabled ? '当前背景' : '背景预览',
              h('em', null, ` · ${usingColor ? snapshot.color : usingImage ? '自定义图' : theme.name}`)
            ),
            h('span', { className: 'qbg-stage__mode' }, `${snapshot.mode === 'dark' ? '深色' : '浅色'} · ${snapshot.opacity}%`)
          ),
          h('div', { className: 'qbg-stage__mock', 'aria-hidden': 'true' },
            h('span', { className: 'qbg-stage__rail' }),
            h('span', { className: 'qbg-stage__content' },
              h('i'), h('i'), h('i')
            )
          ),
          h('div', { className: 'qbg-stage__foot' },
            snapshot.enabled
              ? (usingColor ? '纯色背景铺在侧栏与主画布之后'
                : usingImage ? '自定义背景图铺在侧栏与主画布之后'
                : '侧栏、主画布与 Windows 标题栏会透出这层氛围')
              : '开启后才会作用于 DSH 界面'
          ),
          h('span', {
            className: 'qbg-stage__veil',
            'aria-hidden': 'true',
            style: { background: SURFACE_COLOR[snapshot.mode], opacity: 1 - snapshot.opacity / 100 }
          })
        ),

        h('section', null,
          h('div', { className: 'qbg-section-head' },
            h('h3', null, '背景风格'),
            h('span', null, usingColor ? '纯色已覆盖' : usingImage ? '自定义图已覆盖 · 光晕仍生效' : `${THEMES.length} 种 · 随明暗模式适配`)
          ),
          h('div', { className: 'qbg-grid', role: 'radiogroup', 'aria-label': '背景风格' },
            THEMES.map((item, index) => h('button', {
              key: item.id,
              ref: node => { cardRefs.current[index] = node; },
              type: 'button',
              className: 'qbg-card',
              role: 'radio',
              'aria-checked': snapshot.style === item.id,
              'aria-label': `${item.name}：${item.desc}`,
              style: themeVars(item, snapshot.mode),
              onClick: () => choose(item.id, index),
              onKeyDown: event => onGridKeyDown(event, index)
            },
              h('span', { className: 'qbg-thumb', 'aria-hidden': 'true' },
                h('span', { className: 'qbg-thumb__rail' }),
                h('span', { className: 'qbg-thumb__panel' }),
                h('span', { className: 'qbg-thumb__accent' }),
                snapshot.style === item.id
                  ? h('span', { className: 'qbg-thumb__check' }, '✓')
                  : null
              ),
              h('span', { className: 'qbg-card__title' }, item.name, h('em', null, item.en)),
              h('span', { className: 'qbg-card__desc' }, item.desc)
            ))
          )
        ),

        h('section', null,
          h('div', { className: 'qbg-section-head' },
            h('h3', null, '背景颜色'),
            h('span', null, usingColor ? '纯色已启用' : '纯色未启用')
          ),
          h('div', { className: 'qbg-color-row' },
            h('label', { className: 'qbg-swatch', style: { background: snapshot.color } },
              h('input', {
                type: 'color',
                value: snapshot.color,
                'aria-label': '选择背景颜色',
                onChange: event => onColorInput(event.target.value)
              })
            ),
            h('div', { className: 'qbg-color-fields' },
              h('input', {
                className: 'qbg-hex',
                type: 'text',
                value: colorDraft,
                spellCheck: false,
                'aria-label': '背景颜色 HEX',
                onChange: event => onColorText(event.target.value),
                onBlur: () => {
                  if (!parseColor(colorDraft)) setColorDraft(snapshot.color);
                },
                onKeyDown: event => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }
              }),
              h('span', { className: 'qbg-color-hint' }, 'HEX / RGB')
            ),
            h('button', {
              type: 'button',
              className: 'qbg-switch',
              role: 'switch',
              'aria-checked': snapshot.colorEnabled,
              'aria-label': snapshot.colorEnabled ? '停用纯色背景' : '启用纯色背景',
              onClick: toggleColor
            })
          ),
          h('div', { className: 'qbg-color-quick', role: 'group', 'aria-label': '快速颜色' },
            QUICK_COLORS.map(value => h('button', {
              key: value,
              type: 'button',
              role: 'radio',
              'aria-checked': usingColor && snapshot.color.toLowerCase() === value,
              'aria-label': `使用颜色 ${value}`,
              title: value,
              style: { background: value },
              onClick: () => { applyColor(value); announce(`已应用纯色背景 ${value}`); }
            }))
          )
        ),

        h('section', null,
          h('div', { className: 'qbg-section-head' },
            h('h3', null, '自定义背景图'),
            h('span', null, hasImage ? (usingImage ? '已启用' : '已停用') : 'JPG / PNG / WebP')
          ),
          h('div', {
            className: `qbg-image${dragging ? ' is-dragging' : ''}`,
            onDragOver: event => {
              event.preventDefault();
              if (!dragging) setDragging(true);
            },
            onDragLeave: () => setDragging(false),
            onDrop: onDrop
          },
            h('div', {
              className: `qbg-image__preview${hasImage ? '' : ' is-empty'}`,
              style: hasImage ? { backgroundImage: `url("${imageUrl}")` } : undefined
            }, hasImage ? null : '拖入图片'),
            h('div', { className: 'qbg-image__body' },
              h('div', { className: 'qbg-image__name' }, hasImage ? (snapshot.image.name || '背景图') : '还没有背景图'),
              h('div', { className: 'qbg-image__meta' },
                hasImage
                  ? [imageMeta, usingColor ? '纯色优先，图片已隐藏' : usingImage ? '覆盖风格背景' : '当前未启用'].filter(Boolean).join(' · ')
                  : '建议横图 / 16:9；超过 2560px 会自动压缩，图片只保存在本机。'
              ),
              h('div', { className: 'qbg-image__actions' },
                h('input', {
                  ref: fileRef,
                  type: 'file',
                  accept: 'image/png,image/jpeg,image/webp,image/gif',
                  className: 'qbg-file',
                  onChange: event => { void acceptFile(event.target.files?.[0]); }
                }),
                h('button', {
                  type: 'button',
                  className: 'qbg-btn is-primary',
                  onClick: pickFile,
                  disabled: busy
                }, busy ? '处理中…' : (hasImage ? '更换图片' : '选择图片')),
                hasImage ? h('button', {
                  type: 'button',
                  className: 'qbg-btn',
                  'aria-pressed': snapshot.customEnabled,
                  onClick: toggleCustom
                }, snapshot.customEnabled ? '停用' : '启用') : null,
                hasImage ? h('button', {
                  type: 'button',
                  className: 'qbg-btn',
                  onClick: () => { void removeImage(); }
                }, '移除') : null
              )
            )
          ),
          hasImage && snapshot.customEnabled
            ? h('div', { className: 'qbg-row' },
                h('div', { className: 'qbg-row__text' },
                  h('strong', null, '图片填充'),
                  h('span', null, '铺满会裁切边缘，适应会完整显示，平铺适合纹理图。')
                ),
                h('div', { className: 'qbg-seg', role: 'radiogroup', 'aria-label': '图片填充' },
                  FITS.map(item => h('button', {
                    key: item.id,
                    type: 'button',
                    role: 'radio',
                    'aria-checked': snapshot.fit === item.id,
                    onClick: () => studio.set({ fit: item.id })
                  }, item.label))
                )
              )
            : null
        ),

        h('div', { className: 'qbg-controls' },
          h('div', { className: 'qbg-row' },
            h('div', { className: 'qbg-row__text' },
              h('strong', null, '光晕强度'),
              h('span', null, '控制背景里光晕与色彩的存在感。')
            ),
            h('div', { className: 'qbg-seg', role: 'radiogroup', 'aria-label': '光晕强度' },
              INTENSITIES.map(item => h('button', {
                key: item.id,
                type: 'button',
                role: 'radio',
                'aria-checked': snapshot.intensity === item.id,
                onClick: () => setIntensity(item.id)
              }, item.label))
            )
          ),
          h('div', { className: 'qbg-row' },
            h('div', { className: 'qbg-row__text' },
              h('strong', null, '背景不透明度'),
              h('span', null, '100% 时背景完全可见，调低会逐渐淡出；0% 回到 DSH 原生外观。')
            ),
            h('div', { className: 'qbg-slider' },
              h('input', {
                type: 'range',
                min: 0,
                max: 100,
                step: 5,
                value: snapshot.opacity,
                'aria-label': '背景不透明度',
                'aria-valuetext': `${snapshot.opacity}%`,
                onChange: event => setOpacity(event.target.value)
              }),
              h('output', null, `${snapshot.opacity}%`)
            )
          ),
          h('div', { className: 'qbg-row' },
            h('div', { className: 'qbg-row__text' },
              h('strong', null, '面板透出'),
              h('span', null, '让 DSH 的侧栏与主画布透出背景；关闭后使用实色面板。')
            ),
            h('button', {
              type: 'button',
              className: 'qbg-switch',
              role: 'switch',
              'aria-checked': snapshot.glass,
              'aria-label': '面板透出',
              onClick: toggleGlass
            })
          )
        ),

        h('div', { className: 'qbg-footer' },
          h('span', { className: 'qbg-notice', role: 'status', 'aria-live': 'polite' }, notice),
          h('button', { type: 'button', className: 'qbg-reset', onClick: reset }, '恢复默认')
        )
      );
    }

    function apply(ctx) {
      const studio = createStudio();

      ctx.effect(() => studio.mount(), 'background-studio: backdrop layer');
      ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'background-studio',
        order: 60,
        label: () => (navigator.language || '').toLowerCase().startsWith('en') ? 'Background' : '背景'
      }, props => h(BackgroundPage, { ...props, studio }))), 'background-studio: settings page');
    }

    exports.apply = apply;
    exports.inject = ['slots'];
    exports.name = 'dsh-background-studio';
    exports.__test = { THEMES, DEFAULTS, INTENSITIES, createStudio, BackgroundPage };

    return module.exports;
  }
});
