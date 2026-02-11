import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timer, TimerState, Group } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 9);

const getNextOccurrence = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    // If target is in the past, move to tomorrow
    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }
    return target.getTime();
}

// Calculate remaining time for a timeOfDay timer
const calculateTimeOfDayRemaining = (targetTimeOfDay: string): number => {
    const next = getNextOccurrence(targetTimeOfDay);
    return Math.max(0, next - Date.now());
};

export const useTimerStore = create<TimerState>()(
    persist(
        (set, get) => ({
            timers: {},
            groups: {},
            isDarkMode: false,

            toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

            addTimer: (timerData) => set((state) => {
                const id = generateId();
                const now = Date.now();
                let initialRemaining = timerData.duration;

                if (timerData.type === 'timeOfDay' && timerData.targetTimeOfDay) {
                    initialRemaining = calculateTimeOfDayRemaining(timerData.targetTimeOfDay);
                }

                // Calculate order: count existing timers in the same group
                const existingInGroup = Object.values(state.timers)
                    .filter(t => t.groupId === timerData.groupId);
                const order = existingInGroup.length;

                return {
                    timers: {
                        ...state.timers,
                        [id]: {
                            ...timerData,
                            id,
                            remainingTime: initialRemaining,
                            initialDuration: timerData.duration,
                            status: 'idle',
                            createdAt: now,
                            order,
                            isRecurring: timerData.isRecurring,
                        },
                    },
                };
            }),

            updateTimer: (id, updates) => set((state) => {
                const timer = state.timers[id];
                if (!timer) return state;

                const updatedTimer = { ...timer, ...updates };

                // If duration changed, we should probably reset remainingTime if it was idle
                if (updates.duration !== undefined && timer.status === 'idle') {
                    updatedTimer.remainingTime = updates.duration;
                    updatedTimer.initialDuration = updates.duration;
                }

                if (updates.targetTimeOfDay !== undefined && timer.status === 'idle') {
                    updatedTimer.remainingTime = calculateTimeOfDayRemaining(updates.targetTimeOfDay);
                }

                return {
                    timers: {
                        ...state.timers,
                        [id]: updatedTimer,
                    },
                };
            }),

            deleteTimer: (id) => set((state) => {
                const newTimers = { ...state.timers };
                delete newTimers[id];
                return { timers: newTimers };
            }),

            startTimer: (id) => set((state) => {
                const timer = state.timers[id];
                if (!timer) return state;

                let updates: Partial<Timer> = { status: 'running' };

                if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                    // Recalculate expiry on start/resume
                    const expiry = getNextOccurrence(timer.targetTimeOfDay);
                    updates.expiryTimestamp = expiry;
                    updates.remainingTime = Math.max(0, expiry - Date.now());
                }

                return {
                    timers: {
                        ...state.timers,
                        [id]: { ...timer, ...updates },
                    },
                };
            }),

            pauseTimer: (id) => set((state) => ({
                timers: {
                    ...state.timers,
                    [id]: { ...state.timers[id], status: 'paused', expiryTimestamp: undefined },
                },
            })),

            resetTimer: (id) => set((state) => {
                const timer = state.timers[id];
                if (!timer) return state;

                let resetRemaining = timer.initialDuration;
                if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                    resetRemaining = calculateTimeOfDayRemaining(timer.targetTimeOfDay);
                }

                return {
                    timers: {
                        ...state.timers,
                        [id]: {
                            ...timer,
                            status: 'idle',
                            remainingTime: resetRemaining,
                            expiryTimestamp: undefined
                        },
                    },
                };
            }),

            tick: (deltaMs: number) => set((state) => {
                const newTimers = { ...state.timers };
                let changed = false;
                const now = Date.now();
                const justCompleted: string[] = [];

                // Process running timers
                Object.keys(newTimers).forEach((key) => {
                    const timer = newTimers[key];
                    if (timer.status !== 'running') return;

                    let newRemaining = timer.remainingTime;

                    if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                        if (timer.expiryTimestamp) {
                            newRemaining = Math.max(0, timer.expiryTimestamp - now);
                        } else {
                            const expiry = getNextOccurrence(timer.targetTimeOfDay);
                            newRemaining = Math.max(0, expiry - now);
                        }
                    } else {
                        newRemaining = Math.max(0, timer.remainingTime - deltaMs);
                    }

                    const shouldComplete = newRemaining <= 0;

                    if (shouldComplete || newRemaining !== timer.remainingTime) {
                        const isFinalCompletion = shouldComplete && !timer.isRecurring;

                        newTimers[key] = {
                            ...timer,
                            remainingTime: timer.isRecurring && shouldComplete ? timer.initialDuration : newRemaining,
                            status: isFinalCompletion ? 'completed' : timer.status,
                            lastCycleCompletedAt: shouldComplete ? now : timer.lastCycleCompletedAt
                        };
                        changed = true;

                        if (shouldComplete && timer.groupId && !timer.isRecurring) {
                            justCompleted.push(key);
                        }
                    }
                });

                // Processes completions and chains
                justCompleted.forEach(completedId => {
                    const completedTimer = newTimers[completedId];
                    if (completedTimer.groupId) {
                        const nextTimer = Object.values(newTimers)
                            .filter(t => t.groupId === completedTimer.groupId && t.status === 'waiting')
                            .sort((a, b) => a.order - b.order)[0];

                        if (nextTimer) {
                            newTimers[nextTimer.id] = { ...nextTimer, status: 'running' };
                            changed = true;
                        }
                    }
                });

                // Scheduled Groups: Check if any group is scheduled to start now
                Object.values(state.groups).forEach(group => {
                    if (group.targetStartTime) {
                        const [h, m] = group.targetStartTime.split(':').map(Number);
                        const nowTime = new Date();
                        if (nowTime.getHours() === h && nowTime.getMinutes() === m) {
                            // Check if group already has running timers to avoid re-triggering every tick
                            const groupTimers = Object.values(newTimers).filter(t => t.groupId === group.id);
                            const alreadyRunning = groupTimers.some(t => t.status === 'running' || t.status === 'waiting');

                            if (!alreadyRunning && groupTimers.length > 0) {
                                // Trigger startGroup logic manually here or just call it after set
                                // For simplicity/consistency, we'll implement the start logic here
                                let firstDurationStarted = false;
                                groupTimers.sort((a, b) => a.order - b.order).forEach(timer => {
                                    if (timer.type === 'timeOfDay' || timer.isRecurring) {
                                        let updates: Partial<Timer> = { status: 'running' };
                                        if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                                            const expiry = getNextOccurrence(timer.targetTimeOfDay);
                                            updates.expiryTimestamp = expiry;
                                            updates.remainingTime = Math.max(0, expiry - Date.now());
                                        }
                                        newTimers[timer.id] = { ...timer, ...updates };
                                    } else {
                                        if (!firstDurationStarted) {
                                            newTimers[timer.id] = { ...timer, status: 'running' };
                                            firstDurationStarted = true;
                                        } else {
                                            newTimers[timer.id] = { ...timer, status: 'waiting' };
                                        }
                                    }
                                });
                                changed = true;
                                // Clear schedule to prevent immediate restart? 
                                // Or leave it so it triggers every day? User probably wants it to stay scheduled.
                                // To prevent spam, we just checked !alreadyRunning.
                            }
                        }
                    }
                });

                return changed ? { timers: newTimers } : state;
            }),

            addGroup: (name, targetStartTime) => set((state) => {
                const id = generateId();
                return {
                    groups: {
                        ...state.groups,
                        [id]: { id, name, collapsed: false, targetStartTime },
                    },
                };
            }),

            updateGroup: (id, updates) => set((state) => {
                const group = state.groups[id];
                if (!group) return state;
                return {
                    groups: {
                        ...state.groups,
                        [id]: { ...group, ...updates },
                    },
                };
            }),

            deleteGroup: (id) => set((state) => {
                const newGroups = { ...state.groups };
                delete newGroups[id];

                const newTimers = { ...state.timers };
                let timersChanged = false;
                Object.keys(newTimers).forEach(key => {
                    if (newTimers[key].groupId === id) {
                        newTimers[key] = { ...newTimers[key], groupId: null };
                        timersChanged = true;
                    }
                });

                return {
                    groups: newGroups,
                    timers: timersChanged ? newTimers : state.timers
                };
            }),

            toggleGroupCollapse: (id) => set((state) => {
                const group = state.groups[id];
                if (!group) return state;
                return {
                    groups: {
                        ...state.groups,
                        [id]: { ...group, collapsed: !group.collapsed },
                    },
                };
            }),

            startGroup: (groupId: string) => set((state) => {
                const groupTimers = Object.values(state.timers)
                    .filter(t => t.groupId === groupId)
                    .sort((a, b) => a.order - b.order);

                if (groupTimers.length === 0) return state;

                const newTimers = { ...state.timers };

                // TimeOfDay timers: start immediately (exempt from chain)
                // Duration timers: first one starts, rest go to 'waiting'
                let firstDurationStarted = false;

                groupTimers.forEach(timer => {
                    if (timer.type === 'timeOfDay' || timer.isRecurring) {
                        // Start immediately (exempt from chain)
                        let updates: Partial<Timer> = { status: 'running' };
                        if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                            const expiry = getNextOccurrence(timer.targetTimeOfDay);
                            updates.expiryTimestamp = expiry;
                            updates.remainingTime = Math.max(0, expiry - Date.now());
                        }
                        newTimers[timer.id] = { ...timer, ...updates };
                    } else {
                        // Sequential duration timer
                        if (!firstDurationStarted) {
                            newTimers[timer.id] = { ...timer, status: 'running' };
                            firstDurationStarted = true;
                        } else {
                            newTimers[timer.id] = { ...timer, status: 'waiting' };
                        }
                    }
                });

                return { timers: newTimers };
            }),

            resetGroup: (groupId: string) => set((state) => {
                const newTimers = { ...state.timers };
                let changed = false;

                Object.keys(newTimers).forEach(id => {
                    const timer = newTimers[id];
                    if (timer.groupId === groupId) {
                        let resetRemaining = timer.initialDuration;
                        if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                            resetRemaining = calculateTimeOfDayRemaining(timer.targetTimeOfDay);
                        }
                        newTimers[id] = {
                            ...timer,
                            status: 'idle',
                            remainingTime: resetRemaining,
                            expiryTimestamp: undefined
                        };
                        changed = true;
                    }
                });

                return changed ? { timers: newTimers } : state;
            }),

            reorderTimers: (groupId: string, orderedIds: string[]) => set((state) => {
                const newTimers = { ...state.timers };
                orderedIds.forEach((id, index) => {
                    if (newTimers[id]) {
                        newTimers[id] = { ...newTimers[id], order: index };
                    }
                });
                return { timers: newTimers };
            }),
        }),
        {
            name: 'timer-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
