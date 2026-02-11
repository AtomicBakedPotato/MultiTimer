import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTimerStore } from '../store/timerStore';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const useTimerNotifications = () => {
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const lastBackgroundDate = useRef<number | null>(null);
    const tick = useTimerStore((state) => state.tick);

    useEffect(() => {
        // Request permissions
        Notifications.requestPermissionsAsync();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            const timers = useTimerStore.getState().timers;

            if (appState.current.match(/active/) && nextAppState === 'background') {
                // Going to background
                lastBackgroundDate.current = Date.now();

                // Schedule notifications for running timers
                Object.values(timers).forEach((timer) => {
                    if (timer.status === 'running' && timer.remainingTime > 0) {
                        Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Timer Complete',
                                body: `${timer.name} finished!`,
                                sound: 'default', // TODO: Custom sounds
                            },
                            trigger: {
                                seconds: Math.floor(timer.remainingTime / 1000),
                            },
                        });
                    }
                });
            } else if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // Coming to foreground
                if (lastBackgroundDate.current) {
                    const now = Date.now();
                    const elapsed = now - lastBackgroundDate.current;
                    tick(elapsed);

                    // Cancel notifications since we are back in app
                    // Actually, we might want to let them fire if they already did? 
                    // But if they are future scheduled, we cancel them so they don't pop while we are looking at the app
                    Notifications.cancelAllScheduledNotificationsAsync();
                }
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [tick]);
};
