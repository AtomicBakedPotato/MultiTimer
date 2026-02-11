import { useEffect, useRef } from 'react';
import { useTimerStore } from '../store/timerStore';

export const useTimerTicker = (intervalMs = 100) => {
    const tick = useTimerStore((state) => state.tick);
    const lastTickRef = useRef<number>(Date.now());

    useEffect(() => {
        lastTickRef.current = Date.now();
        const interval = setInterval(() => {
            const now = Date.now();
            const delta = now - lastTickRef.current;
            if (delta > 0) {
                tick(delta);
            }
            lastTickRef.current = now;
        }, intervalMs);

        return () => clearInterval(interval);
    }, [tick, intervalMs]);
};
