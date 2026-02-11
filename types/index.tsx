export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'waiting';

export type TimerType = 'duration' | 'timeOfDay';

export interface Timer {
    id: string;
    name: string;
    duration: number; // Total duration in ms (for 'duration' timers)
    remainingTime: number; // Current remaining time in ms
    initialDuration: number; // Original set duration
    status: TimerStatus;
    type: TimerType;
    targetTimeOfDay?: string; // "HH:mm" in 24h format for 'timeOfDay' timers
    expiryTimestamp?: number; // Calculated expiry time for 'timeOfDay' timers
    groupId?: string | null;
    soundFile?: string | null;
    createdAt: number;
    order: number; // Position within group for sequential ordering
    isRecurring?: boolean;
    lastCycleCompletedAt?: number;
    soundUri?: string | null;
    soundName?: string | null;
}

export interface Group {
    id: string;
    name: string;
    collapsed: boolean;
    targetStartTime?: string; // "HH:mm" in 24h format
}

export interface TimerState {
    timers: Record<string, Timer>;
    groups: Record<string, Group>;
    addTimer: (timer: Omit<Timer, 'id' | 'remainingTime' | 'status' | 'createdAt' | 'order'>) => void;
    updateTimer: (id: string, updates: Partial<Timer>) => void;
    deleteTimer: (id: string) => void;
    startTimer: (id: string) => void;
    pauseTimer: (id: string) => void;
    resetTimer: (id: string) => void;
    tick: (deltaMs: number) => void;

    addGroup: (name: string, targetStartTime?: string) => void;
    updateGroup: (id: string, updates: Partial<Group>) => void;
    deleteGroup: (id: string) => void;
    toggleGroupCollapse: (id: string) => void;

    startGroup: (groupId: string) => void;
    resetGroup: (groupId: string) => void;
    reorderTimers: (groupId: string, orderedIds: string[]) => void;

    isDarkMode: boolean;
    toggleDarkMode: () => void;
}
