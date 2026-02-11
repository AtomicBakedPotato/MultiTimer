import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { useTimerStore } from '../store/timerStore';

export const useTimerAudio = () => {
    const timers = useTimerStore((s) => s.timers);
    const previousTimers = useRef(timers);

    useEffect(() => {
        Object.values(timers).forEach(async (timer) => {
            const prev = previousTimers.current[timer.id];
            // Check if lastCycleCompletedAt changed
            if (prev && prev.lastCycleCompletedAt !== timer.lastCycleCompletedAt && timer.lastCycleCompletedAt) {
                await playSound(timer.soundUri);
            }
        });
        previousTimers.current = timers;
    }, [timers]);

    const playSound = async (soundUri?: string | null) => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                soundUri ? { uri: soundUri } : { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' }
            );
            await sound.playAsync();
        } catch (error) {
            console.log('Error playing sound', error);
        }
    };
};
