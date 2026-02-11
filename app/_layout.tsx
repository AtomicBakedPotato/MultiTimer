import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Audio, InterruptionModeIOS } from 'expo-av';
import { useTimerStore } from '../store/timerStore';
import { StatusBar } from 'expo-status-bar';

import { useTimerNotifications } from '../hooks/useTimerNotifications';
import { useTimerAudio } from '../hooks/useTimerAudio';

export default function RootLayout() {
    const isDarkMode = useTimerStore((state) => state.isDarkMode);
    useTimerNotifications();
    useTimerAudio();

    useEffect(() => {
        // Configure Audio for mixing
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        }).catch(console.error);
    }, []);

    return (
        <>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
            </Stack>
        </>
    );
}
