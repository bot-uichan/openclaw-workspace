import { useEffect, useRef, useState } from 'react';

type UseOcrLoopOptions = {
  enabled: boolean;
  intervalMs?: number;
  busy: boolean;
  onTick: () => Promise<void> | void;
};

export function useOcrLoop({ enabled, intervalMs = 1200, busy, onTick }: UseOcrLoopOptions) {
  const [isLoopActive, setIsLoopActive] = useState(false);
  const tickRef = useRef(onTick);
  const busyRef = useRef(busy);

  useEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!enabled || !isLoopActive) return undefined;

    const timer = window.setInterval(() => {
      if (busyRef.current) return;
      void tickRef.current();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, isLoopActive]);

  return {
    isLoopActive,
    startLoop: () => setIsLoopActive(true),
    stopLoop: () => setIsLoopActive(false),
    toggleLoop: () => setIsLoopActive((current) => !current),
  };
}
