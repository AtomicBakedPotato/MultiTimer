import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Timer } from '../types';
import { formatTime } from '../utils/formatTime';
import { useTimerStore } from '../store/timerStore';
import { Play, Pause, RotateCcw, Trash2, GripVertical, Clock, ChevronUp, ChevronDown, Pencil, Repeat } from 'lucide-react-native';

interface TimerItemProps {
    timer: Timer;
    showDragHandle?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onEdit?: () => void;
    orderNumber?: number;
    isFirst?: boolean;
    isLast?: boolean;
}

export const TimerItem: React.FC<TimerItemProps> = ({
    timer,
    showDragHandle,
    onMoveUp,
    onMoveDown,
    onEdit,
    orderNumber,
    isFirst,
    isLast
}) => {
    const { startTimer, pauseTimer, resetTimer, deleteTimer, isDarkMode } = useTimerStore();

    const progress = timer.initialDuration > 0
        ? (timer.remainingTime / timer.initialDuration) * 100
        : 0;

    const isTimeOfDay = timer.type === 'timeOfDay';
    const isWaiting = timer.status === 'waiting';

    const getStatusColor = () => {
        switch (timer.status) {
            case 'running': return '#007AFF';
            case 'waiting': return '#FF9500';
            case 'completed': return '#34C759';
            case 'paused': return '#8E8E93';
            default: return isDarkMode ? '#444' : '#ddd';
        }
    };

    const textColor = isDarkMode ? '#fff' : '#000';
    const subTextColor = isDarkMode ? '#aaa' : '#666';
    const iconColor = isDarkMode ? '#fff' : '#000';

    return (
        <View style={[
            styles.container,
            isDarkMode && styles.containerDark,
            isWaiting && (isDarkMode ? styles.containerWaitingDark : styles.containerWaiting)
        ]}>
            <View style={styles.header}>
                <View style={styles.leftHeader}>
                    {showDragHandle && (
                        <View style={styles.reorderContainer}>
                            <TouchableOpacity
                                onPress={onMoveUp}
                                style={[styles.reorderButton, isFirst && styles.disabledButton]}
                                disabled={isFirst}
                            >
                                <ChevronUp size={16} color={isFirst ? (isDarkMode ? "#555" : "#eee") : (isDarkMode ? "#888" : "#bbb")} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onMoveDown}
                                style={[styles.reorderButton, isLast && styles.disabledButton]}
                                disabled={isLast}
                            >
                                <ChevronDown size={16} color={isLast ? (isDarkMode ? "#555" : "#eee") : (isDarkMode ? "#888" : "#bbb")} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {orderNumber !== undefined && !isTimeOfDay && (
                        <View style={[styles.orderBadge, { backgroundColor: getStatusColor() }]}>
                            <Text style={styles.orderText}>{orderNumber}</Text>
                        </View>
                    )}
                    {isTimeOfDay && (
                        <View style={[styles.orderBadge, { backgroundColor: '#5856D6' }]}>
                            <Clock size={12} color="#fff" />
                        </View>
                    )}
                    <View style={styles.nameContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.name, { color: textColor }]}>{timer.name}</Text>
                            {timer.isRecurring && (
                                <Repeat size={14} color="#007AFF" />
                            )}
                        </View>
                        {isTimeOfDay && timer.targetTimeOfDay && (
                            <Text style={[styles.targetTime, { color: subTextColor }]}>⏰ {timer.targetTimeOfDay}</Text>
                        )}
                        {isWaiting && (
                            <Text style={styles.waitingLabel}>Queued — waiting...</Text>
                        )}
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={onEdit}
                        style={styles.editButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Pencil size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => deleteTimer(timer.id)}
                        style={styles.deleteButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Trash2 size={20} color="#ff4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.timeContainer}>
                <Text style={[styles.timeText, { color: textColor }]}>{formatTime(timer.remainingTime)}</Text>
                {isTimeOfDay && timer.status === 'running' && (
                    <Text style={[styles.timeLabel, { color: subTextColor }]}>until {timer.targetTimeOfDay}</Text>
                )}
            </View>

            <View style={[styles.progressBarBg, isDarkMode && styles.progressBarBgDark]}>
                <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: getStatusColor() }]} />
            </View>

            <View style={styles.controls}>
                {isWaiting ? (
                    <Text style={styles.queuedText}>In queue</Text>
                ) : timer.status === 'running' ? (
                    <TouchableOpacity style={styles.button} onPress={() => pauseTimer(timer.id)}>
                        <Pause size={24} color={iconColor} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.button} onPress={() => startTimer(timer.id)}>
                        <Play size={24} color={iconColor} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.button} onPress={() => resetTimer(timer.id)}>
                    <RotateCcw size={24} color={iconColor} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        marginBottom: 12,
        elevation: 2,
    },
    containerDark: {
        backgroundColor: '#2c2c2e',
        elevation: 0,
        borderWidth: 1,
        borderColor: '#3a3a3c',
    },
    containerWaiting: {
        backgroundColor: '#FFF8F0',
        borderWidth: 1,
        borderColor: '#FFD699',
    },
    containerWaitingDark: {
        backgroundColor: '#3d2b1f',
        borderWidth: 1,
        borderColor: '#664a33',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    leftHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editButton: {
        padding: 8,
    },
    deleteButton: {
        padding: 8,
    },
    reorderContainer: {
        flexDirection: 'column',
        marginRight: 8,
    },
    reorderButton: {
        padding: 6,
    },
    disabledButton: {
        opacity: 0.3,
    },
    dragHandle: {
        padding: 4,
        marginLeft: -4,
    },
    orderBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orderText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
    },
    nameContainer: {
        flex: 1,
    },
    targetTime: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    waitingLabel: {
        fontSize: 12,
        color: '#FF9500',
        fontWeight: '600',
        marginTop: 2,
    },
    timeContainer: {
        alignItems: 'center',
        marginBottom: 12,
    },
    timeText: {
        fontSize: 32,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    timeLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#ddd',
        borderRadius: 3,
        marginBottom: 12,
        overflow: 'hidden',
    },
    progressBarBgDark: {
        backgroundColor: '#3a3a3c',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#007AFF',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
    },
    button: {
        padding: 8,
    },
    queuedText: {
        fontSize: 14,
        color: '#FF9500',
        fontWeight: '600',
        paddingVertical: 8,
    },
});
