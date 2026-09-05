import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SpeedTestResult } from '../types/speedtest';

const REWIND_MS = 420;
const SETTLE_MS = 260;

interface Transition {
  stage: 'rewind' | 'settle';
  result: SpeedTestResult;
}

/** Clear the run immediately, retaining only its presentation for the rewind. */
export function useInstrumentReset(resetTest: () => void) {
  const instrumentRef = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const heightAnimation = useRef<Animation | null>(null);
  const [transition, setTransition] = useState<Transition | null>(null);

  useEffect(() => () => {
    clearTimeout(timer.current);
    heightAnimation.current?.cancel();
  }, []);

  useLayoutEffect(() => {
    if (transition?.stage !== 'settle') return;
    const element = instrumentRef.current;
    if (!element) return;

    // The old box stays in the layout until the new contents have been
    // measured. Centre alignment and document scroll then change gradually.
    const before = element.getBoundingClientRect().height;
    const scroll = { left: window.scrollX, top: window.scrollY };
    element.style.height = 'auto';
    const after = element.getBoundingClientRect().height;
    element.style.height = `${before}px`;
    if (window.scrollY !== scroll.top) window.scrollTo({ ...scroll, behavior: 'instant' });

    let disposed = false;
    const finish = () => {
      if (disposed) return;
      element.style.height = '';
      element.style.overflowAnchor = '';
      heightAnimation.current?.cancel();
      heightAnimation.current = null;
      busy.current = false;
      setTransition(null);
    };

    if (typeof element.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const animation = element.animate(
      [{ height: `${before}px` }, { height: `${after}px` }],
      { duration: SETTLE_MS, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' },
    );
    heightAnimation.current = animation;
    void animation.finished.then(finish, () => {});
    return () => { disposed = true; animation.cancel(); };
  }, [transition?.stage]);

  const beginReset = (result: SpeedTestResult) => {
    if (busy.current) return;
    const element = instrumentRef.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      resetTest();
      return;
    }

    busy.current = true;
    element.style.height = `${element.getBoundingClientRect().height}px`;
    element.style.overflowAnchor = 'none';
    setTransition({ stage: 'rewind', result });
    resetTest();
    timer.current = setTimeout(() => {
      setTransition(current => current ? { ...current, stage: 'settle' } : null);
    }, REWIND_MS);
  };

  return {
    instrumentRef,
    beginReset,
    resetting: transition !== null,
    resetStage: transition?.stage,
    retainedResult: transition?.stage === 'rewind' ? transition.result : null,
  };
}
