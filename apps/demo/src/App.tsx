import React, { useState } from 'react';
import {
  WeatherCanvas,
  Rain,
  Snow,
  Fog,
  type Quality,
  type ReducedMotionProp,
} from 'react-weather-effects';

type SpriteChoice = 'watercolor' | 'watercolor2' | 'crystal' | 'none';
type BgTheme = 'night' | 'sunset' | 'dark' | 'mountains';

const SPRITE_URLS: Record<SpriteChoice, string | undefined> = {
  watercolor: '/snowflake-sprite.png',
  watercolor2: '/snowflake-sprite-2.png',
  crystal: '/crystal-snowflake.svg',
  none: undefined,
};

const BG: Record<BgTheme, string> = {
  night: 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)',
  sunset: 'linear-gradient(to bottom, #2b1055, #7597de)',
  mountains: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  dark: 'linear-gradient(180deg, #090d16 0%, #111827 100%)',
};

/*
 * Slider component — keeps the controls markup clean.
 * Every range input in this demo controls a single numeric prop.
 */
function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const display = props.format
    ? props.format(props.value)
    : String(props.value);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
        <span>{props.label}</span>
        <span>{display}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#38bdf8' }}
      />
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
      <span style={{ fontSize: 11, color: '#cbd5e1' }}>{props.label}</span>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
    </label>
  );
}

/* Section card for grouping controls */
function Section(props: {
  title: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  const border = props.accent
    ? '1px solid rgba(56, 189, 248, 0.25)'
    : '1px solid rgba(255,255,255,0.06)';
  return (
    <fieldset style={{ padding: 12, background: 'rgba(30,41,59,0.55)', borderRadius: 10, border, margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: props.onToggle && props.enabled ? 10 : 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, color: props.accent ? '#38bdf8' : '#e2e8f0', padding: 0 }}>
          {props.title}
        </legend>
        {props.onToggle && (
          <input type="checkbox" checked={props.enabled} onChange={(e) => props.onToggle!(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
        )}
      </div>
      {(!props.onToggle || props.enabled) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {props.children}
        </div>
      )}
    </fieldset>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const x1 = (v: number) => `${v.toFixed(1)}×`;
const x2 = (v: number) => `${v.toFixed(2)}×`;
const deg = (v: number) => `${v}°`;
const fixed2 = (v: number) => v.toFixed(2);

export function App() {
  // --- Canvas ---
  const [mode, setMode] = useState<'fullscreen' | 'contained'>('fullscreen');
  const [quality, setQuality] = useState<Quality>('medium');
  const [reducedMotion, setReducedMotion] = useState<ReducedMotionProp>('auto');
  const [paused, setPaused] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState(800);
  const [windX, setWindX] = useState(0.2);
  const [windY, setWindY] = useState(0);
  const [bgTheme, setBgTheme] = useState<BgTheme>('night');

  // --- Rain ---
  const [enableRain, setEnableRain] = useState(false);
  const [rainIntensity, setRainIntensity] = useState(0.7);
  const [rainAngle, setRainAngle] = useState(12);
  const [rainSpeed, setRainSpeed] = useState(1);

  // --- Snow ---
  const [enableSnow, setEnableSnow] = useState(true);
  const [snowIntensity, setSnowIntensity] = useState(0.5);
  const [snowSpeed, setSnowSpeed] = useState(0.85);
  const [snowWobble, setSnowWobble] = useState(true);
  const [snowSprite, setSnowSprite] = useState<SpriteChoice>('watercolor');
  const [snowMinSize, setSnowMinSize] = useState(8);
  const [snowMaxSize, setSnowMaxSize] = useState(22);

  // --- Fog ---
  const [enableFog, setEnableFog] = useState(false);
  const [fogDensity, setFogDensity] = useState(0.4);
  const [fogSpeed, setFogSpeed] = useState(1);
  const [fogLayers, setFogLayers] = useState(3);

  // --- Sidebar open on mobile ---
  const [panelOpen, setPanelOpen] = useState(false);

  const spriteUrl = SPRITE_URLS[snowSprite];

  // When switching sprite, reset sizes to sensible defaults
  const handleSpriteChange = (next: SpriteChoice) => {
    setSnowSprite(next);
    if (next === 'none') {
      setSnowMinSize(1.5);
      setSnowMaxSize(4);
    } else {
      setSnowMinSize(8);
      setSnowMaxSize(22);
    }
  };

  const applyPreset = (id: string) => {
    switch (id) {
      case 'crystal':
        setEnableRain(false);
        setEnableSnow(true);
        handleSpriteChange('crystal');
        setSnowIntensity(0.55);
        setSnowSpeed(0.8);
        setSnowWobble(true);
        setEnableFog(false);
        setWindX(0.25);
        setBgTheme('night');
        break;
      case 'watercolor':
        setEnableRain(false);
        setEnableSnow(true);
        handleSpriteChange('watercolor');
        setSnowIntensity(0.45);
        setSnowSpeed(0.7);
        setSnowWobble(true);
        setEnableFog(false);
        setWindX(-0.15);
        setBgTheme('mountains');
        break;
      case 'dots':
        setEnableRain(false);
        setEnableSnow(true);
        handleSpriteChange('none');
        setSnowIntensity(0.6);
        setSnowSpeed(1);
        setSnowWobble(true);
        setEnableFog(false);
        setWindX(-0.2);
        setBgTheme('night');
        break;
      case 'rain':
        setEnableRain(true);
        setRainIntensity(0.85);
        setRainAngle(18);
        setRainSpeed(1.2);
        setEnableSnow(false);
        setEnableFog(true);
        setFogDensity(0.3);
        setWindX(0.6);
        setBgTheme('dark');
        break;
      case 'mist':
        setEnableRain(true);
        setRainIntensity(0.15);
        setRainAngle(0);
        setRainSpeed(1);
        setEnableSnow(false);
        setEnableFog(true);
        setFogDensity(0.7);
        setFogSpeed(0.6);
        setWindX(0.1);
        setBgTheme('sunset');
        break;
      case 'blizzard':
        setEnableRain(false);
        setEnableSnow(true);
        handleSpriteChange('none');
        setSnowIntensity(0.95);
        setSnowSpeed(1.8);
        setSnowWobble(true);
        setEnableFog(true);
        setFogDensity(0.5);
        setFogLayers(4);
        setWindX(1.4);
        setBgTheme('night');
        break;
    }
  };

  // Build the effect children once so both modes share identical markup
  const effects = (
    <>
      <Rain
        intensity={enableRain ? rainIntensity : 0}
        transitionDuration={transitionDuration}
        angle={rainAngle}
        speed={rainSpeed}
      />
      <Snow
        intensity={enableSnow ? snowIntensity : 0}
        transitionDuration={transitionDuration}
        speed={snowSpeed}
        wobble={snowWobble}
        sprite={spriteUrl}
        minSize={snowMinSize}
        maxSize={snowMaxSize}
      />
      <Fog
        density={enableFog ? fogDensity : 0}
        transitionDuration={transitionDuration}
        speed={fogSpeed}
        layers={fogLayers}
      />
    </>
  );

  const canvasProps = {
    wind: { x: windX, y: windY },
    quality,
    reducedMotion,
    paused,
    zIndex: 5,
  } as const;

  const presets = [
    { id: 'crystal', label: '✨ Crystal' },
    { id: 'watercolor', label: '🎨 Dendrite' },
    { id: 'dots', label: '⚪ Dots' },
    { id: 'rain', label: '🌧️ Rain' },
    { id: 'blizzard', label: '🌨️ Blizzard' },
    { id: 'mist', label: '🌫️ Mist' },
  ];

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: BG[bgTheme], position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* --- Canvas --- */}
      {mode === 'fullscreen' && (
        <WeatherCanvas mode="fullscreen" {...canvasProps}>
          {effects}
        </WeatherCanvas>
      )}

      {/* --- Header --- */}
      <header style={{
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        background: 'rgba(15,23,42,0.75)',
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>❄️</span>
          <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>react-weather-effects</h1>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
            playground
          </span>
        </div>

        {/* Presets — scroll horizontally on narrow screens */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#f1f5f9',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* External Links & Mobile Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a
            href="https://www.npmjs.com/package/react-weather-effects"
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtnStyle}
            title="npm package"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 0v24h24V0H0zm21.444 21.444h-5.333V7.889h-2.667v13.555H2.556V2.556h18.888v18.888z" />
            </svg>
            <span>npm</span>
          </a>
          <a
            href="https://github.com/allwin-antony/react-weather-effects"
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtnStyle}
            title="GitHub repository"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>
          <a
            href="https://github.com/sponsors/allwin-antony"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...linkBtnStyle,
              background: 'rgba(236, 72, 153, 0.15)',
              borderColor: 'rgba(236, 72, 153, 0.35)',
              color: '#f472b6',
            }}
            title="Sponsor this project"
          >
            <span>💖</span>
            <span>Sponsor</span>
          </a>

          {/* Mobile toggle for controls panel */}
          <button
            onClick={() => setPanelOpen((v) => !v)}
            aria-label="Toggle controls"
            style={{
              display: 'none',
              padding: '5px 10px',
              fontSize: 16,
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#f1f5f9',
              cursor: 'pointer',
            }}
            className="mobile-toggle"
          >
            ☰
          </button>
        </div>
      </header>

      {/* --- Main --- */}
      <main style={{
        flex: 1,
        display: 'flex',
        padding: '20px',
        gap: 20,
        zIndex: 20,
        pointerEvents: 'none',
      }}>

        {/* Left: hero / contained preview */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
          minWidth: 0,
        }}>
          {mode === 'contained' ? (
            <div style={{
              width: '100%',
              maxWidth: 560,
              aspectRatio: '16 / 10',
              borderRadius: 14,
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: BG[bgTheme],
            }}>
              <WeatherCanvas mode="contained" {...canvasProps} zIndex={2}>
                {effects}
              </WeatherCanvas>
              <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
                <h3 style={{ fontSize: 20, fontWeight: 600 }}>Contained mode</h3>
                <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2 }}>Effects stay inside this card.</p>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: 32,
              borderRadius: 14,
              background: 'rgba(15,23,42,0.45)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(6px)',
              maxWidth: 420,
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{enableRain ? '🌧️' : enableFog ? '🌫️' : '❄️'}</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Fullscreen mode</h2>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                Effects render across the entire viewport. Use the panel to tweak every prop from the public API.
              </p>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div
          className="controls-panel"
          style={{
            width: 340,
            flexShrink: 0,
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(14px)',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            pointerEvents: 'auto',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
        >
          {/* Close button — only visible on mobile via media query */}
          <button
            onClick={() => setPanelOpen(false)}
            className="mobile-toggle"
            aria-label="Close controls"
            style={{
              display: 'none',
              alignSelf: 'flex-end',
              padding: '4px 10px',
              fontSize: 16,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#f1f5f9',
              cursor: 'pointer',
              marginBottom: 4,
            }}
          >
            ✕
          </button>

          {/* ---- Canvas ---- */}
          <Section title="Canvas">
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'fullscreen' | 'contained')}
                  style={selectStyle}
                >
                  <option value="fullscreen">Fullscreen</option>
                  <option value="contained">Contained</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Quality</label>
                <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)} style={selectStyle}>
                  <option value="low">Low · 150 max</option>
                  <option value="medium">Medium · 300 max</option>
                  <option value="high">High · 600 max</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Motion</label>
                <select value={reducedMotion} onChange={(e) => setReducedMotion(e.target.value as ReducedMotionProp)} style={selectStyle}>
                  <option value="auto">Auto</option>
                  <option value="animated">Animated</option>
                  <option value="static">Static</option>
                  <option value="off">Off</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Background</label>
                <select value={bgTheme} onChange={(e) => setBgTheme(e.target.value as BgTheme)} style={selectStyle}>
                  <option value="night">Night sky</option>
                  <option value="dark">Dark</option>
                  <option value="mountains">Mountains</option>
                  <option value="sunset">Sunset</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setPaused((v) => !v)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  border: 'none',
                  background: paused ? '#ef4444' : '#10b981',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            </div>
          </Section>

          <Section title="Scene transitions">
            <Slider label="Fade duration" value={transitionDuration} min={0} max={2000} step={100} format={(v) => `${v} ms`} onChange={setTransitionDuration} />
          </Section>

          {/* ---- Wind ---- */}
          <Section title="Wind">
            <Slider label="Horizontal (x)" value={windX} min={-2} max={2} step={0.05} format={fixed2} onChange={setWindX} />
            <Slider label="Vertical (y)" value={windY} min={-1} max={1} step={0.05} format={fixed2} onChange={setWindY} />
          </Section>

          {/* ---- Snow ---- */}
          <Section title="❄️ Snow" accent enabled={enableSnow} onToggle={setEnableSnow}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Sprite</label>
              <select value={snowSprite} onChange={(e) => handleSpriteChange(e.target.value as SpriteChoice)} style={selectStyle}>
                <option value="watercolor">🎨 Watercolor dendrite (PNG)</option>
                <option value="watercolor2">❄️ Teal watercolor (PNG)</option>
                <option value="crystal">✨ Crystal vector (SVG)</option>
                <option value="none">⚪ Built-in dots</option>
              </select>
            </div>
            <Slider label="Intensity" value={snowIntensity} min={0} max={1} step={0.02} format={pct} onChange={setSnowIntensity} />
            <Slider label="Speed" value={snowSpeed} min={0} max={2.5} step={0.05} format={x2} onChange={setSnowSpeed} />
            <Slider label="Min size (px)" value={snowMinSize} min={0.5} max={30} step={0.5} format={x1} onChange={setSnowMinSize} />
            <Slider label="Max size (px)" value={snowMaxSize} min={1} max={40} step={0.5} format={x1} onChange={setSnowMaxSize} />
            <Toggle label="Wobble & rotation" checked={snowWobble} onChange={setSnowWobble} />
          </Section>

          {/* ---- Rain ---- */}
          <Section title="🌧️ Rain" enabled={enableRain} onToggle={setEnableRain}>
            <Slider label="Intensity" value={rainIntensity} min={0} max={1} step={0.02} format={pct} onChange={setRainIntensity} />
            <Slider label="Angle" value={rainAngle} min={-45} max={45} step={1} format={deg} onChange={setRainAngle} />
            <Slider label="Speed" value={rainSpeed} min={0} max={2.5} step={0.05} format={x2} onChange={setRainSpeed} />
          </Section>

          {/* ---- Fog ---- */}
          <Section title="🌫️ Fog" enabled={enableFog} onToggle={setEnableFog}>
            <Slider label="Density" value={fogDensity} min={0} max={1} step={0.02} format={pct} onChange={setFogDensity} />
            <Slider label="Speed" value={fogSpeed} min={0} max={2.5} step={0.05} format={x2} onChange={setFogSpeed} />
            <Slider label="Layers" value={fogLayers} min={1} max={6} step={1} onChange={setFogLayers} />
          </Section>
        </div>
      </main>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-toggle { display: block !important; }
          main { flex-direction: column !important; padding: 12px !important; }
          .controls-panel {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            z-index: 100 !important;
            transform: translateX(${panelOpen ? '0' : '100%'});
            transition: transform 0.25s ease;
          }
        }
      `}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 7px',
  borderRadius: 6,
  background: '#1e293b',
  color: '#f8fafc',
  border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 12,
};

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 9px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f1f5f9',
  textDecoration: 'none',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
};
