import React from 'react';

export interface FrameScheduler {
  request: (callback: (timestamp: number) => void) => number;
  cancel: (id: number) => void;
}

export const defaultScheduler: FrameScheduler = {
  request: (cb) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(cb);
    }
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  },
  cancel: (id) => {
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  },
};

export const SchedulerCtx = React.createContext<FrameScheduler | null>(null);
