import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../apps/demo/src/App';

describe('Demo playground', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('starts with a contained preview and only the selected effect controls', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Contained' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Snow', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Enable Snow' })).toBeChecked();
    expect(screen.queryByRole('slider', { name: 'Drop length' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveValue('');
  });

  it('preserves effect parameters when changing inspectors or toggling an effect', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Rain' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Intensity' }), { target: { value: '0.42' } });
    expect(screen.getByRole('switch', { name: 'Enable Rain' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Rain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Snow' }));
    expect(screen.getByRole('slider', { name: 'Intensity' })).toHaveValue('0.5');
    fireEvent.click(screen.getByRole('button', { name: 'Rain' }));
    expect(screen.getByRole('slider', { name: 'Intensity' })).toHaveValue('0.42');
    expect(screen.getByRole('slider', { name: 'Intensity' })).toHaveAttribute('aria-valuetext', '42%');
    expect(screen.getByRole('switch', { name: 'Enable Rain' })).toBeChecked();
  });

  it('keeps the canvas and settings intact across contained/fullscreen changes', () => {
    const { container } = render(<App />);
    const canvas = container.querySelector('canvas')!;
    fireEvent.change(screen.getByRole('slider', { name: 'Speed' }), { target: { value: '0.9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas.parentElement).toHaveStyle({ position: 'fixed' });
    fireEvent.click(screen.getByRole('button', { name: 'Contained' }));
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas.parentElement).toHaveStyle({ position: 'absolute' });
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveValue('0.9');
  });

  it('applies a composed preset and clears its selection after a manual edit', () => {
    render(<App />);
    const preset = screen.getByRole('combobox', { name: 'Preset' });
    fireEvent.change(preset, { target: { value: 'thunderstorm' } });
    expect(preset).toHaveValue('thunderstorm');
    expect(screen.getByRole('heading', { name: 'Lightning', level: 2 })).toBeInTheDocument();
    for (const name of ['Rain', 'Fog', 'Lightning']) expect(screen.getByRole('switch', { name: `Enable ${name}` })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Enable Snow' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Fog' }));
    expect(preset).toHaveValue('');
  });

  it('retains every existing preset and snow artwork choice', () => {
    const { container } = render(<App />);
    const canvas = container.querySelector('canvas');
    const preset = screen.getByRole('combobox', { name: 'Preset' });
    for (const id of ['drizzle', 'rainstorm', 'snowfall', 'blizzard', 'mist', 'thunderstorm', 'heatwave', 'crystal', 'watercolor']) {
      fireEvent.change(preset, { target: { value: id } });
      expect(preset).toHaveValue(id);
      expect(container.querySelector('canvas')).toBe(canvas);
    }
    expect(screen.getByRole('combobox', { name: 'Sprite' })).toHaveValue('watercolor');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sprite' }), { target: { value: 'watercolor2' } });
    expect(screen.getByRole('combobox', { name: 'Sprite' })).toHaveValue('watercolor2');
  });

  it('keeps shared scene settings separate and persistent', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Scene' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Quality' }), { target: { value: 'low' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Motion' }), { target: { value: 'static' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Horizontal (x)' }), { target: { value: '-0.6' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Fade duration' }), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('tab', { name: /Effects/ }));
    expect(screen.getByRole('slider', { name: 'Intensity' })).toHaveValue('0.5');
    fireEvent.click(screen.getByRole('tab', { name: 'Scene' }));
    expect(screen.getByRole('combobox', { name: 'Quality' })).toHaveValue('low');
    expect(screen.getByRole('combobox', { name: 'Motion' })).toHaveValue('static');
    expect(screen.getByRole('slider', { name: 'Horizontal (x)' })).toHaveValue('-0.6');
    expect(screen.getByRole('slider', { name: 'Fade duration' })).toHaveAttribute('aria-valuetext', '1200 ms');
  });

  it('supports keyboard navigation between inspector tabs and labels every input', () => {
    render(<App />);
    const effects = screen.getByRole('tab', { name: /Effects/ });
    effects.focus();
    fireEvent.keyDown(effects, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Scene' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Scene' })).toHaveAttribute('aria-selected', 'true');
    for (const input of [...screen.getAllByRole('slider'), ...screen.getAllByRole('combobox')]) expect(input).toHaveAccessibleName();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Scene' }), { key: 'Home' });
    expect(effects).toHaveFocus();
    expect(effects).toHaveAttribute('aria-selected', 'true');
  });

  it('exposes the heat horizon and keeps its feature toggles independent', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Preset' }), { target: { value: 'heatwave' } });
    expect(screen.getByRole('combobox', { name: 'Backdrop' })).toHaveValue('desert');
    expect(screen.getByRole('slider', { name: 'Ground horizon' })).toHaveValue('0.52');
    fireEvent.change(screen.getByRole('slider', { name: 'Ground horizon' }), { target: { value: '0.63' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Horizon mirage' }));
    expect(screen.getByRole('slider', { name: 'Ground horizon' })).toHaveAttribute('aria-valuetext', '63%');
    expect(screen.getByRole('switch', { name: 'Horizon mirage' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Hot-air refraction' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Fine air turbulence' })).toBeChecked();
  });

  it('displays pause and empty-scene states without hiding the controls', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Paused')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Snow' }));
    expect(screen.getByText('Your scene is clear')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Intensity' })).toBeInTheDocument();
  });

  it('shows correct pixel units and restores sensible sizes when switching sprites', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sprite' }), { target: { value: 'none' } });
    expect(screen.getByRole('slider', { name: 'Min size' })).toHaveAttribute('aria-valuetext', '1.5 px');
    expect(screen.getByRole('slider', { name: 'Max size' })).toHaveAttribute('aria-valuetext', '4 px');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sprite' }), { target: { value: 'crystal' } });
    expect(screen.getByRole('slider', { name: 'Min size' })).toHaveAttribute('aria-valuetext', '8 px');
    expect(screen.getByRole('slider', { name: 'Max size' })).toHaveAttribute('aria-valuetext', '22 px');
  });
});
