import React, { useState } from 'react';
import {
  WeatherCanvas,
  Rain,
  Snow,
  Fog,
  Lightning,
  Heat,
  presets,
  type PresetName,
  type LightningFrequency,
  type Quality,
  type ReducedMotionProp,
} from 'react-weather-effects';

type SpriteChoice = 'watercolor' | 'watercolor2' | 'crystal' | 'none';
type BgTheme = 'night' | 'sunset' | 'dark' | 'mountains' | 'desert';
type EffectId = 'rain' | 'snow' | 'fog' | 'lightning' | 'heat';
type InspectorTab = 'effects' | 'scene';
type IconName = EffectId | 'cloud' | 'pause' | 'play' | 'controls';

const SPRITE_URLS: Record<SpriteChoice, string | undefined> = {
  watercolor: '/snowflake-sprite.png',
  watercolor2: '/snowflake-sprite-2.png',
  crystal: '/crystal-snowflake.svg',
  none: undefined,
};

// Pre-warm sprite image cache so switching between flake types is instantaneous
if (typeof window !== 'undefined') {
  Object.values(SPRITE_URLS).forEach((url) => {
    if (url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
    }
  });
}

const DESERT_BACKGROUND = '/desert-road.svg';

const BG: Record<BgTheme, string> = {
  night: 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)',
  sunset: 'linear-gradient(to bottom, #2b1055, #7597de)',
  mountains: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  dark: 'linear-gradient(180deg, #090d16 0%, #111827 100%)',
  desert: `#c6b79b url("${DESERT_BACKGROUND}") center / cover no-repeat`,
};

const ICON_PATHS: Record<IconName, string> = {
  cloud: 'M6 17a4 4 0 0 1-.5-8A6 6 0 0 1 17 7a5 5 0 0 1 1 10H6Z',
  rain: 'M5 13a3.5 3.5 0 0 1 0-7A5 5 0 0 1 14.5 4a4.5 4.5 0 0 1 3 9M7 16l-1 4m7-4-1 4m7-4-1 4',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 5l3 3 3-3M9 19l3-3 3 3M5 11l4-1-1-4m11 7-4 1 1 4M8 18l1-4-4-1m11-7-1 4 4 1',
  fog: 'M5 6h14M3 10h12m3 0h3M5 14h16M3 18h12m3 0h1',
  lightning: 'M13 2 4 14h7l-1 8 10-13h-7l0-7Z',
  heat: 'M5 20c-4-5 4-7 0-12m7 12c-4-5 4-7 0-12m7 12c-4-5 4-7 0-12M4 3h16',
  pause: 'M9 5v14M15 5v14',
  play: 'm8 5 11 7-11 7V5Z',
  controls: 'M4 7h4m4 0h8M4 17h8m4 0h4M8 4v6m4-6v6m0 4v6m4-6v6',
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

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
    <label className="control slider-control">
      <span className="control-label">
        <span>{props.label}</span>
        <span className="control-value" aria-hidden="true">{display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-valuetext={display}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  return (
    <label className={`toggle${props.compact ? ' toggle--compact' : ''}`}>
      <span className={props.compact ? 'sr-only' : 'toggle-label'}>{props.label}</span>
      <input type="checkbox" role="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="control-group">
      <legend>{props.title}</legend>
      <div className="control-stack">{props.children}</div>
    </fieldset>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const x1 = (v: number) => `${v.toFixed(1)}×`;
const x2 = (v: number) => `${v.toFixed(2)}×`;
const deg = (v: number) => `${v}°`;
const fixed2 = (v: number) => v.toFixed(2);
const pixels = (v: number) => `${v} px`;

export function App() {
  // --- Canvas ---
  const [mode, setMode] = useState<'fullscreen' | 'contained'>('contained');
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
  const [rainDropLength, setRainDropLength] = useState(1);
  const [rainDropThickness, setRainDropThickness] = useState(1);
  const [rainSplashes, setRainSplashes] = useState(false);

  // --- Snow ---
  const [enableSnow, setEnableSnow] = useState(true);
  const [snowIntensity, setSnowIntensity] = useState(0.5);
  const [snowSpeed, setSnowSpeed] = useState(0.85);
  const [snowWobble, setSnowWobble] = useState(true);
  const [snowRotation, setSnowRotation] = useState(true);
  const [snowRotationSpeed, setSnowRotationSpeed] = useState(1);
  const [snowSprite, setSnowSprite] = useState<SpriteChoice>('watercolor');
  const [snowMinSize, setSnowMinSize] = useState(8);
  const [snowMaxSize, setSnowMaxSize] = useState(22);

  // --- Fog ---
  const [enableFog, setEnableFog] = useState(false);
  const [fogDensity, setFogDensity] = useState(0.4);
  const [fogSpeed, setFogSpeed] = useState(1);
  const [fogLayers, setFogLayers] = useState(3);

  // --- Lightning ---
  const [enableLightning, setEnableLightning] = useState(false);
  const [lightningFrequency, setLightningFrequency] = useState<LightningFrequency>('occasional');
  const [lightningFlash, setLightningFlash] = useState(false);
  const [lightningBrightness, setLightningBrightness] = useState(1);
  const [lightningColor, setLightningColor] = useState('rgba(230, 240, 255, 0.95)');

  // --- Heat ---
  const [enableHeat, setEnableHeat] = useState(false);
  const [heatIntensity, setHeatIntensity] = useState(0.8);
  const [heatSpeed, setHeatSpeed] = useState(1);
  const [heatMirage, setHeatMirage] = useState(true);
  const [heatShimmer, setHeatShimmer] = useState(true);
  const [heatWisps, setHeatWisps] = useState(true);
  const [heatHorizon, setHeatHorizon] = useState(0.52);

  const [selectedEffect, setSelectedEffect] = useState<EffectId>('snow');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('effects');
  const [activePreset, setActivePreset] = useState('');

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
    const key = id === 'rain' ? 'rainstorm' : id;
    setActivePreset(id);
    setInspectorTab('effects');
    if (key in presets) {
      const p = presets[key as PresetName];
      setSelectedEffect(p.heat ? 'heat' : p.lightning ? 'lightning' : p.snow ? 'snow' : key === 'mist' ? 'fog' : 'rain');
      setWindX(p.wind?.x ?? 0);
      setWindY(p.wind?.y ?? 0);

      setEnableRain(!!p.rain);
      if (p.rain) {
        setRainIntensity(p.rain.intensity ?? 0.7);
        setRainAngle(p.rain.angle ?? 12);
        setRainSpeed(p.rain.speed ?? 1);
        setRainDropLength(p.rain.dropLength ?? 1);
        setRainDropThickness(p.rain.dropThickness ?? 1);
        setRainSplashes(p.rain.splashes ?? false);
      }

      setEnableSnow(!!p.snow);
      if (p.snow) {
        setSnowIntensity(p.snow.intensity ?? 0.5);
        setSnowSpeed(p.snow.speed ?? 0.85);
        setSnowWobble(p.snow.wobble ?? true);
        handleSpriteChange('none');
      }

      setEnableFog(!!p.fog);
      if (p.fog) {
        setFogDensity(p.fog.density ?? 0.4);
        setFogSpeed(p.fog.speed ?? 1);
        setFogLayers(p.fog.layers ?? 3);
      }

      setEnableLightning(!!p.lightning);
      if (p.lightning) {
        setLightningFrequency(p.lightning.frequency ?? 'occasional');
        setLightningBrightness(p.lightning.brightness ?? 1);
        setLightningFlash(p.lightning.flash ?? false);
      }

      setEnableHeat(!!p.heat);
      if (p.heat) {
        setHeatIntensity(p.heat.intensity ?? 0.8);
        setHeatSpeed(p.heat.speed ?? 1);
        setHeatMirage(p.heat.mirage ?? true);
        setHeatShimmer(p.heat.shimmer ?? true);
        setHeatWisps(p.heat.wisps ?? true);
        setHeatHorizon(p.heat.horizon ?? 0.52);
      }

      if (key === 'heatwave') {
        setBgTheme('desert');
      } else if (key === 'drizzle' || key === 'rainstorm' || key === 'thunderstorm') {
        setBgTheme('dark');
      } else if (key === 'mist') {
        setBgTheme('sunset');
      } else {
        setBgTheme('night');
      }
      return;
    }

    setEnableHeat(false);
    setSelectedEffect('snow');

    switch (id) {
      case 'crystal':
        setEnableRain(false);
        setEnableSnow(true);
        handleSpriteChange('crystal');
        setSnowIntensity(0.55);
        setSnowSpeed(0.8);
        setSnowWobble(true);
        setEnableFog(false);
        setEnableLightning(false);
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
        setEnableLightning(false);
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
        setEnableLightning(false);
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
        setEnableLightning(false);
        setWindX(0.6);
        setBgTheme('dark');
        break;
      case 'thunderstorm':
        setEnableRain(true);
        setRainIntensity(0.9);
        setRainAngle(16);
        setRainSpeed(1.3);
        setRainSplashes(true);
        setEnableSnow(false);
        setEnableFog(true);
        setFogDensity(0.35);
        setEnableLightning(true);
        setLightningFrequency('frequent');
        setLightningFlash(false);
        setLightningBrightness(1);
        setWindX(0.7);
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
        setEnableLightning(false);
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
        setEnableLightning(false);
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
        dropLength={rainDropLength}
        dropThickness={rainDropThickness}
        splashes={rainSplashes}
      />
      <Snow
        intensity={enableSnow ? snowIntensity : 0}
        transitionDuration={transitionDuration}
        speed={snowSpeed}
        wobble={snowWobble}
        rotation={snowRotation}
        rotationSpeed={snowRotationSpeed}
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
      {enableLightning && (
        <Lightning
          frequency={lightningFrequency}
          flash={lightningFlash}
          brightness={lightningBrightness}
          color={lightningColor}
        />
      )}
      <Heat
        intensity={enableHeat ? heatIntensity : 0}
        speed={heatSpeed}
        backgroundImage={bgTheme === 'desert' ? DESERT_BACKGROUND : undefined}
        horizon={heatHorizon}
        layer={-1}
        mirage={heatMirage}
        shimmer={heatShimmer}
        wisps={heatWisps}
        transitionDuration={transitionDuration}
      />
    </>
  );

  const canvasProps = {
    wind: { x: windX, y: windY },
    quality,
    reducedMotion,
    paused,
    zIndex: mode === 'fullscreen' ? 5 : 1,
  } as const;

  const effectList = [
    { id: 'rain', label: 'Rain', description: 'Streaks, wind, and surface splashes.', enabled: enableRain, toggle: setEnableRain },
    { id: 'snow', label: 'Snow', description: 'Soft flakes, custom artwork, and drift.', enabled: enableSnow, toggle: setEnableSnow },
    { id: 'fog', label: 'Fog', description: 'Layered atmospheric haze.', enabled: enableFog, toggle: setEnableFog },
    { id: 'lightning', label: 'Lightning', description: 'Procedural bolts and optional flashes.', enabled: enableLightning, toggle: setEnableLightning },
    { id: 'heat', label: 'Heat', description: 'Hot-air refraction and a horizon mirage.', enabled: enableHeat, toggle: setEnableHeat },
  ] as const;
  const selected = effectList.find((effect) => effect.id === selectedEffect)!;
  const activeEffects = effectList.filter((effect) => effect.enabled);
  const presetList = [
    { id: 'drizzle', label: 'Drizzle' },
    { id: 'rainstorm', label: 'Rainstorm' },
    { id: 'snowfall', label: 'Snowfall' },
    { id: 'blizzard', label: 'Blizzard' },
    { id: 'mist', label: 'Mist' },
    { id: 'thunderstorm', label: 'Thunderstorm' },
    { id: 'heatwave', label: 'Desert heat' },
    { id: 'crystal', label: 'Crystal snow' },
    { id: 'watercolor', label: 'Dendrite snow' },
  ];
  const sceneTitle = presetList.find((preset) => preset.id === activePreset)?.label ??
    (activeEffects.length ? activeEffects.map((effect) => effect.label).join(' + ') : 'Empty scene');
  const motionLabel = paused ? 'Paused' : reducedMotion === 'off' ? 'Rendering off' :
    reducedMotion === 'static' ? 'Static' : reducedMotion === 'auto' ? 'Auto motion' : 'Animated';

  return (
    <div className={`studio${mode === 'fullscreen' ? ' studio--fullscreen' : ''}${bgTheme === 'desert' ? ' studio--desert' : ''}`}>
      {mode === 'fullscreen' && <div className="fullscreen-backdrop" style={{ background: BG[bgTheme] }} aria-hidden="true" />}

      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark"><Icon name="cloud" size={24} /></span>
            <div><p className="brand-name">react-weather-effects</p><p className="brand-detail">An open-source React library</p></div>
          </div>
          <nav className="site-links" aria-label="Project links">
            <a href="https://github.com/allwin-antony/react-weather-effects#readme" target="_blank" rel="noopener noreferrer">Docs</a>
            <a href="https://www.npmjs.com/package/react-weather-effects" target="_blank" rel="noopener noreferrer">npm</a>
            <a href="https://github.com/allwin-antony/react-weather-effects" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/sponsors/allwin-antony" target="_blank" rel="noopener noreferrer">Sponsor <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
      </header>

      <main className="workspace">
        <div className="workspace-heading">
          <div><h1>Weather playground</h1><p>Choose a preset or combine effects using the inspector.</p></div>
          <div className="workspace-actions">
            <div className="canvas-modes" role="group" aria-label="Canvas mode">
              <button type="button" aria-pressed={mode === 'contained'} onClick={() => setMode('contained')}>Contained</button>
              <button type="button" aria-pressed={mode === 'fullscreen'} onClick={() => setMode('fullscreen')}>Fullscreen</button>
            </div>
            <button type="button" className="playback-button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
              <Icon name={paused ? 'play' : 'pause'} size={16} />{paused ? 'Resume' : 'Pause'}
            </button>
            <a className="mobile-controls-link" href="#inspector"><Icon name="controls" size={16} />Controls</a>
          </div>
        </div>

        <div className="workspace-grid">
          <section className="preview-panel" aria-label="Scene preview">
            <div className="preview-toolbar">
              <label className="toolbar-field">
                <span>Preset</span>
                <select value={activePreset} onChange={(e) => e.target.value ? applyPreset(e.target.value) : setActivePreset('')}>
                  <option value="">Custom scene</option>
                  <optgroup label="Weather scenes">{presetList.filter((preset) => preset.id in presets).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</optgroup>
                  <optgroup label="Snow artwork">{presetList.filter((preset) => !(preset.id in presets)).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</optgroup>
                </select>
              </label>
              <label className="toolbar-field">
                <span>Backdrop</span>
                <select value={bgTheme} onChange={(e) => { setBgTheme(e.target.value as BgTheme); setActivePreset(''); }}>
                  <option value="night">Night sky</option>
                  <option value="dark">Dark</option>
                  <option value="mountains">Mountains</option>
                  <option value="sunset">Sunset</option>
                  <option value="desert">Desert road</option>
                </select>
              </label>
            </div>
            <div className="preview-stage" style={{ background: mode === 'contained' ? BG[bgTheme] : undefined }}>
              <WeatherCanvas mode={mode} {...canvasProps}>{effects}</WeatherCanvas>
              {(activeEffects.length === 0 || reducedMotion === 'off') && (
                <div className="preview-empty">
                  <Icon name="cloud" size={28} />
                  <p>{reducedMotion === 'off' ? 'Rendering is turned off' : 'Your scene is clear'}</p>
                  <span>{reducedMotion === 'off' ? 'Change Motion in Scene settings to show the effects.' : 'Enable an effect in the inspector to get started.'}</span>
                </div>
              )}
            </div>
            <div className="preview-footer">
              <div className="scene-summary"><strong>{sceneTitle}</strong><span>{activeEffects.length} active {activeEffects.length === 1 ? 'effect' : 'effects'}</span></div>
              <span className="motion-status" data-paused={paused || reducedMotion === 'static' || reducedMotion === 'off'}><span aria-hidden="true" />{motionLabel}</span>
              <span className="quality-label">{quality} quality</span>
            </div>
          </section>

          <aside className="inspector" id="inspector" aria-label="Scene inspector" onChangeCapture={() => setActivePreset('')}>
            <div className="inspector-heading"><h2>Inspector</h2><span>Parameters</span></div>
            <div className="inspector-tabs" role="tablist" aria-label="Inspector sections" onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const next = e.key === 'Home' ? 'effects' : e.key === 'End' ? 'scene' : inspectorTab === 'effects' ? 'scene' : 'effects';
              setInspectorTab(next);
              document.getElementById(`inspector-tab-${next}`)?.focus();
            }}>
              {(['effects', 'scene'] as const).map((tab) => (
                <button type="button" key={tab} role="tab" id={`inspector-tab-${tab}`} aria-controls={`inspector-panel-${tab}`} aria-selected={inspectorTab === tab} tabIndex={inspectorTab === tab ? 0 : -1} onClick={() => setInspectorTab(tab)}>
                  {tab === 'effects' ? 'Effects' : 'Scene'}{tab === 'effects' && <span className="tab-count">{effectList.length}</span>}
                </button>
              ))}
            </div>
            <div className="inspector-body" role="tabpanel" id={`inspector-panel-${inspectorTab}`} aria-labelledby={`inspector-tab-${inspectorTab}`} key={inspectorTab}>
              {inspectorTab === 'effects' ? (
                <>
                  <div className="effect-list" role="group" aria-label="Available effects">
                    {effectList.map((effect) => (
                      <div className={`effect-row${selectedEffect === effect.id ? ' is-selected' : ''}`} key={effect.id}>
                        <button type="button" className="effect-select" aria-pressed={selectedEffect === effect.id} onClick={() => setSelectedEffect(effect.id)}><Icon name={effect.id} /><span>{effect.label}</span></button>
                        <Toggle label={`Enable ${effect.label}`} checked={effect.enabled} onChange={effect.toggle} compact />
                      </div>
                    ))}
                  </div>
                  <section className="effect-controls" aria-labelledby="effect-controls-heading">
                    <div className="effect-heading"><h2 id="effect-controls-heading">{selected.label}</h2><p>{selected.description}</p></div>
                    {!selected.enabled && <p className="control-note">This effect is off. You can adjust its settings before enabling it.</p>}

                    {selectedEffect === 'snow' && (
                      <>
                        <Section title="Amount & motion">
                          <Slider label="Intensity" value={snowIntensity} min={0} max={1} step={0.02} format={pct} onChange={setSnowIntensity} />
                          <Slider label="Speed" value={snowSpeed} min={0} max={2.5} step={0.05} format={x2} onChange={setSnowSpeed} />
                        </Section>
                        <Section title="Appearance">
                          <label className="control"><span className="control-label">Sprite</span><select value={snowSprite} onChange={(e) => handleSpriteChange(e.target.value as SpriteChoice)}>
                            <option value="watercolor">Dendrite · PNG</option><option value="watercolor2">Teal dendrite · PNG</option><option value="crystal">Crystal · SVG</option><option value="none">Built-in dots</option>
                          </select></label>
                          <div className="control-grid">
                            <Slider label="Min size" value={snowMinSize} min={0.5} max={30} step={0.5} format={pixels} onChange={setSnowMinSize} />
                            <Slider label="Max size" value={snowMaxSize} min={1} max={40} step={0.5} format={pixels} onChange={setSnowMaxSize} />
                          </div>
                        </Section>
                        <Section title="Movement">
                          <Toggle label="Wobble" checked={snowWobble} onChange={setSnowWobble} />
                          <Toggle label="Rotation" checked={snowRotation} onChange={setSnowRotation} />
                          {snowRotation && <Slider label="Rotation speed" value={snowRotationSpeed} min={0} max={3} step={0.1} format={x2} onChange={setSnowRotationSpeed} />}
                        </Section>
                      </>
                    )}
                    {selectedEffect === 'rain' && (
                      <>
                        <Section title="Rainfall">
                          <Slider label="Intensity" value={rainIntensity} min={0} max={1} step={0.02} format={pct} onChange={setRainIntensity} />
                          <Slider label="Speed" value={rainSpeed} min={0} max={2.5} step={0.05} format={x2} onChange={setRainSpeed} />
                          <Slider label="Angle" value={rainAngle} min={-45} max={45} step={1} format={deg} onChange={setRainAngle} />
                        </Section>
                        <Section title="Drops">
                          <div className="control-grid">
                            <Slider label="Drop length" value={rainDropLength} min={0.2} max={3} step={0.1} format={x2} onChange={setRainDropLength} />
                            <Slider label="Drop thickness" value={rainDropThickness} min={0.4} max={3} step={0.1} format={x2} onChange={setRainDropThickness} />
                          </div>
                          <Toggle label="Ground splashes" checked={rainSplashes} onChange={setRainSplashes} />
                        </Section>
                      </>
                    )}
                    {selectedEffect === 'fog' && (
                      <Section title="Atmosphere">
                        <Slider label="Density" value={fogDensity} min={0} max={1} step={0.02} format={pct} onChange={setFogDensity} />
                        <Slider label="Speed" value={fogSpeed} min={0} max={2.5} step={0.05} format={x2} onChange={setFogSpeed} />
                        <Slider label="Layers" value={fogLayers} min={1} max={6} step={1} onChange={setFogLayers} />
                      </Section>
                    )}
                    {selectedEffect === 'lightning' && (
                      <>
                        <Section title="Timing">
                          <label className="control"><span className="control-label">Frequency</span><select value={typeof lightningFrequency === 'string' ? lightningFrequency : 'custom'} onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'rare' || value === 'occasional' || value === 'frequent') setLightningFrequency(value);
                          }}><option value="rare">Rare · ~12 seconds</option><option value="occasional">Occasional · ~6 seconds</option><option value="frequent">Frequent · ~3 seconds</option></select></label>
                        </Section>
                        <Section title="Appearance">
                          <Slider label="Brightness" value={lightningBrightness} min={0.2} max={2} step={0.1} format={x1} onChange={setLightningBrightness} />
                          <label className="control"><span className="control-label">Bolt color</span><select value={lightningColor} onChange={(e) => setLightningColor(e.target.value)}>
                            <option value="rgba(230, 240, 255, 0.95)">Electric blue</option><option value="rgba(255, 255, 255, 0.95)">Pure white</option><option value="rgba(255, 230, 140, 0.95)">Golden</option><option value="rgba(216, 180, 254, 0.95)">Purple</option>
                          </select></label>
                          <Toggle label="Screen-wide flash (opt-in)" checked={lightningFlash} onChange={setLightningFlash} />
                          <p className="control-note">Flashes respect your motion preference.</p>
                        </Section>
                      </>
                    )}
                    {selectedEffect === 'heat' && (
                      <>
                        <Section title="Thermal distortion">
                          <Slider label="Intensity" value={heatIntensity} min={0} max={1} step={0.02} format={pct} onChange={setHeatIntensity} />
                          <Slider label="Speed" value={heatSpeed} min={0} max={3} step={0.1} format={x1} onChange={setHeatSpeed} />
                          <Slider label="Ground horizon" value={heatHorizon} min={0.1} max={0.9} step={0.01} format={pct} onChange={setHeatHorizon} />
                        </Section>
                        <Section title="Features">
                          <Toggle label="Horizon mirage" checked={heatMirage} onChange={setHeatMirage} />
                          <Toggle label="Hot-air refraction" checked={heatShimmer} onChange={setHeatShimmer} />
                          <Toggle label="Fine air turbulence" checked={heatWisps} onChange={setHeatWisps} />
                        </Section>
                        <p className="control-note">{bgTheme === 'desert' ? 'The desert image is sampled for refraction. Match the horizon to the ground plane.' : 'Refraction needs an image. Choose Desert road in the backdrop menu; other backdrops show haze only.'}</p>
                      </>
                    )}
                  </section>
                </>
              ) : (
                <div className="scene-controls">
                  <p className="scene-controls-intro">Global settings for this canvas and every active effect.</p>
                  <Section title="Rendering">
                    <label className="control"><span className="control-label">Quality</span><select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
                      <option value="low">Low · 150 particles / effect</option><option value="medium">Medium · 300 particles / effect</option><option value="high">High · 600 particles / effect</option>
                    </select></label>
                    <label className="control"><span className="control-label">Motion</span><select value={reducedMotion} onChange={(e) => setReducedMotion(e.target.value as ReducedMotionProp)}>
                      <option value="auto">Auto · follow device preference</option><option value="animated">Animated</option><option value="static">Static</option><option value="off">Off</option>
                    </select></label>
                  </Section>
                  <Section title="Wind">
                    <Slider label="Horizontal (x)" value={windX} min={-2} max={2} step={0.05} format={fixed2} onChange={setWindX} />
                    <Slider label="Vertical (y)" value={windY} min={-1} max={1} step={0.05} format={fixed2} onChange={setWindY} />
                  </Section>
                  <Section title="Transitions"><Slider label="Fade duration" value={transitionDuration} min={0} max={2000} step={100} format={(value) => `${value} ms`} onChange={setTransitionDuration} /></Section>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
      <footer className="site-footer"><span>{effectList.length} effects available. One 2D canvas.</span><span>Open source · <a href="https://github.com/allwin-antony/react-weather-effects/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT license</a></span></footer>
    </div>
  );
}
