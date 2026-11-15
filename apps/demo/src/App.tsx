import React, { useState } from 'react';
import {
  WeatherCanvas,
  Rain,
  Snow,
  Fog,
  type Quality,
  type ReducedMotionProp,
} from 'react-weather-effects';

export function App() {
  // Scene settings
  const [mode, setMode] = useState<'fullscreen' | 'contained'>('fullscreen');
  const [quality, setQuality] = useState<Quality>('medium');
  const [reducedMotion, setReducedMotion] = useState<ReducedMotionProp>('auto');
  const [paused, setPaused] = useState(false);
  const [windX, setWindX] = useState(0.2);
  const [windY, setWindY] = useState(0);

  // Background style
  const [bgTheme, setBgTheme] = useState<'night' | 'sunset' | 'dark' | 'mountains'>('night');

  // Rain settings
  const [enableRain, setEnableRain] = useState(false);
  const [rainIntensity, setRainIntensity] = useState(0.7);
  const [rainAngle, setRainAngle] = useState(12);
  const [rainSpeed, setRainSpeed] = useState(1);

  // Snow settings
  const [enableSnow, setEnableSnow] = useState(true);
  const [snowIntensity, setSnowIntensity] = useState(0.5);
  const [snowSpeed, setSnowSpeed] = useState(0.85);
  const [snowWobble, setSnowWobble] = useState(true);
  const [snowSpriteType, setSnowSpriteType] = useState<'watercolor' | 'watercolor2' | 'crystal' | 'none'>('watercolor');
  const [snowRotation, setSnowRotation] = useState(true);
  const [snowScale, setSnowScale] = useState(1.4);

  // Fog settings
  const [enableFog, setEnableFog] = useState(false);
  const [fogDensity, setFogDensity] = useState(0.4);
  const [fogSpeed, setFogSpeed] = useState(1);

  const getSpriteUrl = () => {
    switch (snowSpriteType) {
      case 'watercolor':
        return '/snowflake-sprite.png';
      case 'watercolor2':
        return '/snowflake-sprite-2.png';
      case 'crystal':
        return '/crystal-snowflake.svg';
      case 'none':
      default:
        return undefined;
    }
  };

  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'watercolorSnow':
        setEnableRain(false);
        setEnableSnow(true);
        setSnowSpriteType('crystal');
        setSnowIntensity(0.55);
        setSnowSpeed(0.8);
        setSnowWobble(true);
        setSnowRotation(true);
        setSnowScale(1.4);
        setEnableFog(false);
        setWindX(0.25);
        setBgTheme('night');
        break;
      case 'dendriteSnow':
        setEnableRain(false);
        setEnableSnow(true);
        setSnowSpriteType('watercolor');
        setSnowIntensity(0.45);
        setSnowSpeed(0.7);
        setSnowWobble(true);
        setSnowRotation(true);
        setSnowScale(1.5);
        setEnableFog(false);
        setWindX(-0.15);
        setBgTheme('mountains');
        break;
      case 'rainstorm':
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
      case 'snowfall':
        setEnableRain(false);
        setEnableSnow(true);
        setSnowSpriteType('none');
        setSnowIntensity(0.6);
        setSnowSpeed(1);
        setSnowWobble(true);
        setEnableFog(false);
        setWindX(-0.2);
        setBgTheme('night');
        break;
      case 'blizzard':
        setEnableRain(false);
        setEnableSnow(true);
        setSnowSpriteType('none');
        setSnowIntensity(0.95);
        setSnowSpeed(1.8);
        setSnowWobble(true);
        setEnableFog(true);
        setFogDensity(0.5);
        setWindX(1.4);
        setBgTheme('night');
        break;
      case 'mist':
        setEnableRain(true);
        setRainIntensity(0.15);
        setRainAngle(0);
        setEnableSnow(false);
        setEnableFog(true);
        setFogDensity(0.7);
        setWindX(0.1);
        setBgTheme('sunset');
        break;
      case 'clear':
        setEnableRain(false);
        setEnableSnow(false);
        setEnableFog(false);
        setWindX(0);
        setBgTheme('mountains');
        break;
    }
  };

  const getBackgroundStyle = (): React.CSSProperties => {
    switch (bgTheme) {
      case 'night':
        return {
          background: 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)',
        };
      case 'sunset':
        return {
          background: 'linear-gradient(to bottom, #2b1055, #7597de)',
        };
      case 'mountains':
        return {
          background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
        };
      case 'dark':
      default:
        return {
          background: 'linear-gradient(180deg, #090d16 0%, #111827 100%)',
        };
    }
  };

  const currentSpriteUrl = getSpriteUrl();
  const snowMin = currentSpriteUrl ? 10 * snowScale : 1.5;
  const snowMax = currentSpriteUrl ? 26 * snowScale : 4;

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        ...getBackgroundStyle(),
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Weather Canvas Overlay */}
      {mode === 'fullscreen' ? (
        <WeatherCanvas
          mode="fullscreen"
          wind={{ x: windX, y: windY }}
          quality={quality}
          reducedMotion={reducedMotion}
          paused={paused}
          zIndex={5}
        >
          {enableRain && (
            <Rain
              intensity={rainIntensity}
              angle={rainAngle}
              speed={rainSpeed}
            />
          )}
          {enableSnow && (
            <Snow
              intensity={snowIntensity}
              speed={snowSpeed}
              wobble={snowWobble}
              sprite={currentSpriteUrl}
              rotation={snowRotation}
              minSize={snowMin}
              maxSize={snowMax}
            />
          )}
          {enableFog && (
            <Fog
              density={fogDensity}
              speed={fogSpeed}
            />
          )}
        </WeatherCanvas>
      ) : null}

      {/* Header */}
      <header
        style={{
          padding: '20px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          zIndex: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❄️</span>
            <span>react-weather-effects</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.4)',
              }}
            >
              Custom Sprite Demo
            </span>
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
            Testing custom artistic watercolor snowflake sprite rendering with rotation &amp; sway
          </p>
        </div>

        {/* Preset quick-select buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'watercolorSnow', label: '❄️ Crystal SVG Sprite' },
            { id: 'dendriteSnow', label: '🎨 Watercolor Sprite' },
            { id: 'snowfall', label: '⚪ Dot Snow' },
            { id: 'rainstorm', label: '🌧️ Rain' },
            { id: 'mist', label: '🌫️ Mist' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          padding: '24px 32px',
          gap: '24px',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* Left side preview / card area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          {mode === 'contained' ? (
            <div
              style={{
                width: '560px',
                height: '380px',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                ...getBackgroundStyle(),
              }}
            >
              <WeatherCanvas
                mode="contained"
                wind={{ x: windX, y: windY }}
                quality={quality}
                reducedMotion={reducedMotion}
                paused={paused}
                zIndex={2}
              >
                {enableRain && (
                  <Rain
                    intensity={rainIntensity}
                    angle={rainAngle}
                    speed={rainSpeed}
                  />
                )}
                {enableSnow && (
                  <Snow
                    intensity={snowIntensity}
                    speed={snowSpeed}
                    wobble={snowWobble}
                    sprite={currentSpriteUrl}
                    rotation={snowRotation}
                    minSize={snowMin}
                    maxSize={snowMax}
                  />
                )}
                {enableFog && (
                  <Fog
                    density={fogDensity}
                    speed={fogSpeed}
                  />
                )}
              </WeatherCanvas>
              <div
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  left: '24px',
                  zIndex: 10,
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                <h3 style={{ fontSize: '24px', fontWeight: 600 }}>Winter Wonderland</h3>
                <p style={{ fontSize: '14px', color: '#cbd5e1' }}>Custom Snowflake Sprite Demo</p>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '36px',
                borderRadius: '16px',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(8px)',
                maxWidth: '480px',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                {snowSpriteType === 'none' ? '⚪' : '❄️'}
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                {snowSpriteType === 'crystal'
                  ? 'Crystal Watercolor Vector Sprite'
                  : snowSpriteType === 'watercolor'
                  ? 'Artistic Watercolor Dendrite Sprite'
                  : 'Circular Particle Snow'}
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
                Snowflakes render with soft alpha, rotational spinning, wind drift, and zero-reallocation Float32Array pooling.
              </p>
            </div>
          )}
        </div>

        {/* Right side interactive control panel */}
        <div
          style={{
            width: '380px',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            pointerEvents: 'auto',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>Engine Controls</h2>
            <button
              onClick={() => setPaused(!paused)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                border: 'none',
                backgroundColor: paused ? '#ef4444' : '#10b981',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {paused ? '▶ Resumed' : '⏸ Pause'}
            </button>
          </div>

          {/* Mode & Quality */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Display Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'fullscreen' | 'contained')}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '12px',
                }}
              >
                <option value="fullscreen">Fullscreen</option>
                <option value="contained">Contained Card</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Quality Budget
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '12px',
                }}
              >
                <option value="low">Low (150 particles)</option>
                <option value="medium">Medium (300 particles)</option>
                <option value="high">High (600 particles)</option>
              </select>
            </div>
          </div>

          {/* Snow Sprite Customization Box */}
          <div style={{ padding: '12px', backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>❄️ Snowflake Sprite</span>
              <input
                type="checkbox"
                checked={enableSnow}
                onChange={(e) => setEnableSnow(e.target.checked)}
              />
            </div>

            {enableSnow && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Sprite Artwork
                  </label>
                  <select
                    value={snowSpriteType}
                    onChange={(e) => setSnowSpriteType(e.target.value as 'watercolor' | 'watercolor2' | 'crystal' | 'none')}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      fontSize: '12px',
                    }}
                  >
                    <option value="watercolor">🎨 Transparent Watercolor Dendrite (PNG - No BG)</option>
                    <option value="watercolor2">❄️ Transparent Teal Watercolor (PNG - No BG)</option>
                    <option value="crystal">✨ Transparent Crystal Vector (SVG - No BG)</option>
                    <option value="none">⚪ Default Circular Dots</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Spinning / Rotational Drift</span>
                  <input
                    type="checkbox"
                    checked={snowRotation}
                    onChange={(e) => setSnowRotation(e.target.checked)}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                    <span>Flake Size Multiplier</span>
                    <span>{snowScale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={snowScale}
                    onChange={(e) => setSnowScale(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                    <span>Precipitation Intensity</span>
                    <span>{Math.round(snowIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={snowIntensity}
                    onChange={(e) => setSnowIntensity(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                    <span>Fall Speed</span>
                    <span>{snowSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.5"
                    step="0.05"
                    value={snowSpeed}
                    onChange={(e) => setSnowSpeed(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Wind Sliders */}
          <div style={{ padding: '12px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Wind Vector X</span>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{windX.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={windX}
              onChange={(e) => setWindX(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Rain Controls */}
          <div style={{ padding: '12px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>🌧️ Rain Effect</span>
              <input
                type="checkbox"
                checked={enableRain}
                onChange={(e) => setEnableRain(e.target.checked)}
              />
            </div>
            {enableRain && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                  <span>Intensity</span>
                  <span>{Math.round(rainIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={rainIntensity}
                  onChange={(e) => setRainIntensity(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          {/* Fog Controls */}
          <div style={{ padding: '12px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>🌫️ Fog Effect</span>
              <input
                type="checkbox"
                checked={enableFog}
                onChange={(e) => setEnableFog(e.target.checked)}
              />
            </div>
            {enableFog && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                  <span>Density</span>
                  <span>{Math.round(fogDensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={fogDensity}
                  onChange={(e) => setFogDensity(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
