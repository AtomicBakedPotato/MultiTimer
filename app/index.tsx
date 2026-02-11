import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Animated, Dimensions, Easing, Alert, NativeSyntheticEvent, NativeScrollEvent, Switch } from 'react-native';
import { useTimerStore } from '../store/timerStore';
import { useTimerTicker } from '../hooks/useTimerTicker';
import { TimerItem } from '../components/TimerItem';
import {
    Plus, FolderPlus, Play, ChevronDown, ChevronRight, X,
    Trash2, Hourglass, Clock, Pencil, Moon, Sun, RotateCw, Repeat, Music, Volume2
} from 'lucide-react-native';
import { pickAndSaveAudio } from '../utils/audioStorage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type TimerType = 'duration' | 'timeOfDay';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_ITEMS = Math.floor(VISIBLE_ITEMS / 2);

// Scroll-based picker wheel (iOS style)
const PickerWheel = ({ value, onChange, max, label, isDarkMode }: { value: number; onChange: (v: number) => void; max: number; label: string; isDarkMode?: boolean }) => {
    const items = Array.from({ length: max + 1 }, (_, i) => i);
    const scrollRef = useRef<ScrollView>(null);
    const didInitialScroll = useRef(false);

    useEffect(() => {
        // Scroll to initial value on mount only
        if (!didInitialScroll.current) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: false });
                didInitialScroll.current = true;
            }, 100);
        }
    }, []);

    const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(index, max));
        onChange(clamped);
    }, [max, onChange]);

    return (
        <View style={pickerStyles.column}>
            <Text style={[pickerStyles.label, isDarkMode && pickerStyles.labelDark]}>{label}</Text>
            <View style={pickerStyles.wheelContainer}>
                <View style={pickerStyles.selectionHighlight} />
                <ScrollView
                    ref={scrollRef}
                    style={pickerStyles.scroll}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={handleScrollEnd}
                    contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PADDING_ITEMS }}
                    nestedScrollEnabled={true}
                >
                    {items.map(item => {
                        const isSelected = value === item;
                        return (
                            <View key={item} style={pickerStyles.item}>
                                <Text style={[
                                    pickerStyles.itemText,
                                    isDarkMode && pickerStyles.itemTextDark,
                                    isSelected && pickerStyles.itemTextSelected,
                                ]}>
                                    {item.toString().padStart(2, '0')}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
};

const pickerStyles = StyleSheet.create({
    column: {
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        color: '#999',
        marginBottom: 6,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    labelDark: {
        color: '#666',
    },
    wheelContainer: {
        height: PICKER_HEIGHT,
        width: 80,
        position: 'relative',
        overflow: 'hidden',
    },
    selectionHighlight: {
        position: 'absolute',
        top: ITEM_HEIGHT * PADDING_ITEMS,
        left: 4,
        right: 4,
        height: ITEM_HEIGHT,
        backgroundColor: '#007AFF',
        borderRadius: 10,
        zIndex: 0,
    },
    scroll: {
        zIndex: 1,
    },
    item: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemText: {
        fontSize: 22,
        color: '#999',
        fontVariant: ['tabular-nums'],
    },
    itemTextDark: {
        color: '#555',
    },
    itemTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 24,
    },
});

export default function HomeScreen() {
    useTimerTicker(200);
    const {
        timers, groups, addTimer, updateTimer, deleteTimer,
        addGroup, updateGroup, deleteGroup, toggleGroupCollapse,
        startGroup, resetGroup, reorderTimers, isDarkMode, toggleDarkMode
    } = useTimerStore();

    // Modal States
    const [timerModalVisible, setTimerModalVisible] = useState(false);
    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

    // Timer Form State
    const [timerType, setTimerType] = useState<TimerType>('duration');
    const [newTimerName, setNewTimerName] = useState('');
    const [timerValue, setTimerValue] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [isRecurring, setIsRecurring] = useState(false);

    // Time Picker State (Used for Time of Day timers)
    const [selectedHour, setSelectedHour] = useState(12);
    const [selectedMinute, setSelectedMinute] = useState(0);

    // Duration Picker State (HH:MM:SS)
    const [durationHour, setDurationHour] = useState(0);
    const [durationMinute, setDurationMinute] = useState(0);
    const [durationSecond, setDurationSecond] = useState(0);

    // Sound State
    const [selectedSoundUri, setSelectedSoundUri] = useState<string | null>(null);
    const [selectedSoundName, setSelectedSoundName] = useState<string | null>(null);

    // Group Form State
    const [newGroupName, setNewGroupName] = useState('');
    const [groupStartHour, setGroupStartHour] = useState(12);
    const [groupStartMinute, setGroupStartMinute] = useState(0);
    const [isGroupScheduled, setIsGroupScheduled] = useState(false);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const openTimerModal = (groupId: string | null = null, timerId: string | null = null) => {
        setEditingTimerId(timerId);
        setSelectedGroupId(groupId);

        if (timerId && timers[timerId]) {
            const timer = timers[timerId];
            setNewTimerName(timer.name);
            setTimerType(timer.type);

            if (timer.type === 'duration') {
                const totalSeconds = Math.floor(timer.initialDuration / 1000);
                setDurationHour(Math.floor(totalSeconds / 3600));
                setDurationMinute(Math.floor((totalSeconds % 3600) / 60));
                setDurationSecond(totalSeconds % 60);
            } else if (timer.type === 'timeOfDay' && timer.targetTimeOfDay) {
                const [h, m] = timer.targetTimeOfDay.split(':').map(Number);
                setSelectedHour(h);
                setSelectedMinute(m);
            }
            setIsRecurring(!!timer.isRecurring);
            setSelectedSoundUri(timer.soundUri || null);
            setSelectedSoundName(timer.soundName || null);
        } else {
            setTimerType('duration');
            setNewTimerName('');
            setIsRecurring(false);
            setDurationHour(0);
            setDurationMinute(0);
            setDurationSecond(0);
            const now = new Date();
            setSelectedHour(now.getHours());
            setSelectedMinute(now.getMinutes());
            setSelectedSoundUri(null);
            setSelectedSoundName(null);
        }

        setTimerModalVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.poly(4)),
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                easing: Easing.out(Easing.poly(4)),
                useNativeDriver: true,
            }),
        ]).start();
    };

    const openGroupModal = (groupId: string | null = null) => {
        setEditingGroupId(groupId);
        if (groupId && groups[groupId]) {
            const group = groups[groupId];
            setNewGroupName(group.name);
            if (group.targetStartTime) {
                const [h, m] = group.targetStartTime.split(':').map(Number);
                setGroupStartHour(h);
                setGroupStartMinute(m);
                setIsGroupScheduled(true);
            } else {
                setIsGroupScheduled(false);
            }
        } else {
            setNewGroupName('');
            const now = new Date();
            setGroupStartHour(now.getHours());
            setGroupStartMinute(now.getMinutes());
            setIsGroupScheduled(false);
        }
        setGroupModalVisible(true);
    };

    const closeTimerModal = () => {
        Keyboard.dismiss();
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(() => {
            setTimerModalVisible(false);
        });
    };

    const handleSoundPick = async () => {
        const result = await pickAndSaveAudio();
        if (result) {
            setSelectedSoundUri(result.uri);
            setSelectedSoundName(result.name);
        }
    };

    const handleAddTimer = () => {
        if (!newTimerName.trim()) {
            Alert.alert("Missing Name", "Please enter a timer name.");
            return;
        }

        let durationMs = 0;
        let targetTimeOfDay: string | undefined;

        if (timerType === 'duration') {
            durationMs = (durationHour * 3600 + durationMinute * 60 + durationSecond) * 1000;
            if (durationMs <= 0) {
                Alert.alert("Invalid Duration", "Please set a duration greater than zero.");
                return;
            }
        } else {
            const timeStr = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
            targetTimeOfDay = timeStr;
            durationMs = 0;
        }

        if (editingTimerId) {
            updateTimer(editingTimerId, {
                name: newTimerName.trim(),
                duration: durationMs,
                type: timerType,
                targetTimeOfDay,
                isRecurring,
                soundUri: selectedSoundUri,
                soundName: selectedSoundName,
            });
        } else {
            addTimer({
                name: newTimerName.trim(),
                duration: durationMs,
                initialDuration: durationMs,
                type: timerType,
                targetTimeOfDay,
                groupId: selectedGroupId,
                soundFile: null,
                isRecurring,
                soundUri: selectedSoundUri,
                soundName: selectedSoundName,
            });
        }

        closeTimerModal();
    };

    const handleAddGroup = () => {
        if (!newGroupName.trim()) return;

        const targetStartTime = isGroupScheduled
            ? `${groupStartHour.toString().padStart(2, '0')}:${groupStartMinute.toString().padStart(2, '0')}`
            : undefined;

        if (editingGroupId) {
            updateGroup(editingGroupId, {
                name: newGroupName.trim(),
                targetStartTime
            });
        } else {
            addGroup(newGroupName.trim(), targetStartTime);
        }
        setNewGroupName('');
        setGroupModalVisible(false);
    };

    const confirmDeleteGroup = (id: string) => {
        Alert.alert(
            "Delete Group",
            "Timers in this group will be ungrouped.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteGroup(id) }
            ]
        );
    };

    const handleMoveTimer = (timerId: string, groupId: string, direction: 'up' | 'down') => {
        const groupTimers = Object.values(timers)
            .filter(t => t.groupId === groupId)
            .sort((a, b) => a.order - b.order);

        const currentIndex = groupTimers.findIndex(t => t.id === timerId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= groupTimers.length) return;

        const updatedTimers = [...groupTimers];
        const [movedTimer] = updatedTimers.splice(currentIndex, 1);
        updatedTimers.splice(newIndex, 0, movedTimer);

        reorderTimers(groupId, updatedTimers.map(t => t.id));
    };

    const renderTimers = () => {
        const timerValues = Object.values(timers);
        const groupValues = Object.values(groups);

        return (
            <>
                {groupValues.map(group => {
                    const groupTimers = timerValues
                        .filter(t => t.groupId === group.id)
                        .sort((a, b) => a.order - b.order);

                    const hasActiveTimers = groupTimers.some(t => t.status === 'running' || t.status === 'waiting');

                    return (
                        <View key={group.id} style={[styles.groupContainer, isDarkMode && styles.groupContainerDark]}>
                            <View style={styles.groupHeader}>
                                <TouchableOpacity
                                    style={styles.groupToggle}
                                    onPress={() => toggleGroupCollapse(group.id)}
                                >
                                    {group.collapsed ?
                                        <ChevronRight size={20} color={isDarkMode ? "#aaa" : "#333"} /> :
                                        <ChevronDown size={20} color={isDarkMode ? "#aaa" : "#333"} />
                                    }
                                    <View style={{ flex: 1, marginRight: 32 }}>
                                        <Text
                                            style={[styles.groupTitle, { color: isDarkMode ? '#fff' : '#000' }]}
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                        >
                                            {group.name}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                            <Text style={styles.groupCount}>{groupTimers.length} timers</Text>
                                            {group.targetStartTime && (
                                                <View style={[styles.scheduleBadge, isDarkMode && styles.scheduleBadgeDark]}>
                                                    <Clock size={10} color={isDarkMode ? "#8E8E93" : "#5856D6"} />
                                                    <Text style={[styles.scheduleBadgeText, isDarkMode && { color: '#8E8E93' }]}>
                                                        {group.targetStartTime}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.groupHeaderActions}>
                                    <TouchableOpacity
                                        onPress={() => openGroupModal(group.id)}
                                        style={styles.groupEditButton}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Pencil size={16} color="#007AFF" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => resetGroup(group.id)}
                                        style={styles.groupResetButton}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <RotateCw size={16} color={isDarkMode ? "#aaa" : "#666"} />
                                    </TouchableOpacity>

                                    {!hasActiveTimers && groupTimers.length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => startGroup(group.id)}
                                            style={styles.playAllButton}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Play size={16} color="#fff" fill="#fff" />
                                            <Text style={styles.playAllText}>Play</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => confirmDeleteGroup(group.id)}
                                        style={styles.groupDeleteButton}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Trash2 size={18} color={isDarkMode ? "#555" : "#999"} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {!group.collapsed && (
                                <View style={styles.groupList}>
                                    {groupTimers.map((timer, index) => (
                                        <TimerItem
                                            key={timer.id}
                                            timer={timer}
                                            showDragHandle={true}
                                            orderNumber={timer.type === 'duration' ? groupTimers.filter(t => t.type === 'duration' && t.order <= timer.order).length : undefined}
                                            onMoveUp={() => handleMoveTimer(timer.id, group.id, 'up')}
                                            onMoveDown={() => handleMoveTimer(timer.id, group.id, 'down')}
                                            onEdit={() => openTimerModal(group.id, timer.id)}
                                            isFirst={index === 0}
                                            isLast={index === groupTimers.length - 1}
                                        />
                                    ))}
                                    <TouchableOpacity
                                        style={[styles.addTimerButton, isDarkMode && styles.addTimerButtonDark]}
                                        onPress={() => openTimerModal(group.id)}
                                    >
                                        <Plus size={18} color="#007AFF" />
                                        <Text style={styles.addTimerButtonText}>Add Timer</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}

                {timerValues.filter(t => !t.groupId).map(timer => (
                    <TimerItem
                        key={timer.id}
                        timer={timer}
                        onEdit={() => openTimerModal(null, timer.id)}
                    />
                ))}
            </>
        );
    };

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <View style={[styles.mainHeader, isDarkMode && styles.mainHeaderDark]}>
                <Text style={[styles.mainTitle, isDarkMode && styles.mainTitleDark]}>Multi-Timer</Text>
                <TouchableOpacity onPress={toggleDarkMode} style={styles.themeToggle}>
                    {isDarkMode ? <Sun size={24} color="#FFD60A" /> : <Moon size={24} color="#5856D6" />}
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {Object.keys(timers).length === 0 && Object.keys(groups).length === 0 ? (
                    <Text style={styles.emptyText}>No timers yet. Tap + to start!</Text>
                ) : (
                    renderTimers()
                )}
            </ScrollView>

            <View style={styles.fabContainer}>
                <TouchableOpacity
                    style={[styles.fab, styles.fabSecondary]}
                    onPress={() => openGroupModal()}
                >
                    <FolderPlus color="#fff" size={24} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => openTimerModal(null)}
                >
                    <Plus color="#fff" size={32} />
                </TouchableOpacity>
            </View>

            {/* Add Timer Modal */}
            <Modal visible={timerModalVisible} transparent onRequestClose={closeTimerModal} animationType="none">
                <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                    <TouchableWithoutFeedback onPress={closeTimerModal}>
                        <View style={styles.modalOverlayTouch} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        style={[
                            styles.modalContent,
                            isDarkMode && styles.simpleModalContentDark,
                            { transform: [{ translateY: slideAnim }] }
                        ]}
                    >
                        <View style={[styles.backgroundExtension, isDarkMode && { backgroundColor: '#1c1c1e' }]} />
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>{editingTimerId ? 'Edit Timer' : 'New Timer'}</Text>
                            <TouchableOpacity onPress={closeTimerModal} style={styles.closeButton}>
                                <X color={isDarkMode ? "#fff" : "#333"} size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: Dimensions.get('window').height * 0.6 }}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            <TextInput
                                style={[styles.input, isDarkMode && styles.inputDark]}
                                placeholder="Timer Name (e.g. Pasta)"
                                placeholderTextColor={isDarkMode ? "#555" : "#888"}
                                value={newTimerName}
                                onChangeText={setNewTimerName}
                            />

                            <View style={styles.typeChoice}>
                                <TouchableOpacity
                                    style={[
                                        styles.typeChoiceButton,
                                        isDarkMode && styles.typeChoiceButtonDark,
                                        timerType === 'duration' && styles.typeChoiceButtonActive
                                    ]}
                                    onPress={() => setTimerType('duration')}
                                >
                                    <Hourglass size={18} color={timerType === 'duration' ? "#fff" : (isDarkMode ? "#8E8E93" : "#666")} />
                                    <Text style={[
                                        styles.typeChoiceText,
                                        isDarkMode && styles.typeChoiceTextDark,
                                        timerType === 'duration' && styles.typeChoiceTextActive
                                    ]}>Duration</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.typeChoiceButton,
                                        isDarkMode && styles.typeChoiceButtonDark,
                                        timerType === 'timeOfDay' && styles.typeChoiceButtonActive
                                    ]}
                                    onPress={() => setTimerType('timeOfDay')}
                                >
                                    <Clock size={18} color={timerType === 'timeOfDay' ? "#fff" : (isDarkMode ? "#8E8E93" : "#666")} />
                                    <Text style={[
                                        styles.typeChoiceText,
                                        isDarkMode && styles.typeChoiceTextDark,
                                        timerType === 'timeOfDay' && styles.typeChoiceTextActive
                                    ]}>Time of Day</Text>
                                </TouchableOpacity>
                            </View>

                            {timerType === 'duration' ? (
                                <View style={[styles.inlinePickerContainer, isDarkMode && styles.inlinePickerContainerDark]}>
                                    <Text style={[styles.inlinePickerLabel, isDarkMode && styles.inlinePickerLabelDark]}>
                                        {durationHour.toString().padStart(2, '0')}:{durationMinute.toString().padStart(2, '0')}:{durationSecond.toString().padStart(2, '0')}
                                    </Text>
                                    <View style={styles.inlinePickerWheels}>
                                        <PickerWheel value={durationHour} onChange={setDurationHour} max={23} label="HR" isDarkMode={isDarkMode} />
                                        <Text style={[styles.pickerSeparator, isDarkMode && styles.pickerSeparatorDark]}>:</Text>
                                        <PickerWheel value={durationMinute} onChange={setDurationMinute} max={59} label="MIN" isDarkMode={isDarkMode} />
                                        <Text style={[styles.pickerSeparator, isDarkMode && styles.pickerSeparatorDark]}>:</Text>
                                        <PickerWheel value={durationSecond} onChange={setDurationSecond} max={59} label="SEC" isDarkMode={isDarkMode} />
                                    </View>
                                </View>
                            ) : (
                                <View style={[styles.inlinePickerContainer, isDarkMode && styles.inlinePickerContainerDark]}>
                                    <Text style={[styles.inlinePickerLabel, isDarkMode && styles.inlinePickerLabelDark]}>
                                        Alarm at {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
                                    </Text>
                                    <View style={styles.inlinePickerWheels}>
                                        <PickerWheel value={selectedHour} onChange={setSelectedHour} max={23} label="HOUR" isDarkMode={isDarkMode} />
                                        <Text style={[styles.pickerSeparator, isDarkMode && styles.pickerSeparatorDark]}>:</Text>
                                        <PickerWheel value={selectedMinute} onChange={setSelectedMinute} max={59} label="MIN" isDarkMode={isDarkMode} />
                                    </View>
                                </View>
                            )}

                            <View style={[styles.recurringRow, isDarkMode && styles.recurringRowDark]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Repeat size={18} color="#007AFF" />
                                    <View>
                                        <Text style={[styles.recurringLabel, isDarkMode && styles.recurringLabelDark]}>Recurring / Interval</Text>
                                        <Text style={styles.recurringSublabel}>Auto-restart when finished</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={isRecurring}
                                    onValueChange={setIsRecurring}
                                    trackColor={{ false: '#767577', true: '#34C759' }}
                                    thumbColor={isRecurring ? '#fff' : '#f4f3f4'}
                                />
                            </View>

                            <View style={[styles.recurringRow, isDarkMode && styles.recurringRowDark, { marginTop: 12 }]}>
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                                    onPress={handleSoundPick}
                                >
                                    <Music size={18} color="#007AFF" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.recurringLabel, isDarkMode && styles.recurringLabelDark]}>Sound / Alarm</Text>
                                        <Text style={styles.recurringSublabel} numberOfLines={1} ellipsizeMode="tail">
                                            {selectedSoundName || 'Default Beep'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                {selectedSoundUri && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSelectedSoundUri(null);
                                            setSelectedSoundName(null);
                                        }}
                                        style={{ padding: 8 }}
                                    >
                                        <Volume2 size={20} color="#FF3B30" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, isDarkMode && styles.cancelButtonDark]} onPress={closeTimerModal}>
                                <Text style={[styles.modalButtonText, styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.addButton]} onPress={handleAddTimer}>
                                <Text style={[styles.modalButtonText, styles.addButtonText]}>{editingTimerId ? 'Save' : 'Create'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Animated.View>
            </Modal>

            {/* Add Group Modal */}
            <Modal visible={groupModalVisible} transparent onRequestClose={() => setGroupModalVisible(false)} animationType="fade">
                <View style={styles.simpleModalOverlay}>
                    <View style={[styles.simpleModalContent, isDarkMode && styles.simpleModalContentDark]}>
                        <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark, { marginBottom: 20 }]}>{editingGroupId ? 'Edit Group' : 'New Group'}</Text>
                        <TextInput
                            style={[styles.input, isDarkMode && styles.inputDark]}
                            placeholder="Group Name (e.g. Kitchen)"
                            placeholderTextColor={isDarkMode ? "#555" : "#888"}
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                        />

                        <View style={[styles.scheduleToggleRow, isDarkMode && styles.scheduleToggleRowDark]}>
                            <Text style={[styles.scheduleLabel, isDarkMode && styles.scheduleLabelDark]}>Schedule Start</Text>
                            <Switch
                                value={isGroupScheduled}
                                onValueChange={setIsGroupScheduled}
                                trackColor={{ false: "#767577", true: "#34C759" }}
                            />
                        </View>

                        {isGroupScheduled && (
                            <View style={[styles.inlinePickerContainer, isDarkMode && styles.inlinePickerContainerDark, { marginTop: 10, marginBottom: 20 }]}>
                                <Text style={[styles.inlinePickerLabel, isDarkMode && styles.inlinePickerLabelDark]}>
                                    Starts at {groupStartHour.toString().padStart(2, '0')}:{groupStartMinute.toString().padStart(2, '0')}
                                </Text>
                                <View style={styles.inlinePickerWheels}>
                                    <PickerWheel value={groupStartHour} onChange={setGroupStartHour} max={23} label="HOUR" isDarkMode={isDarkMode} />
                                    <Text style={[styles.pickerSeparator, isDarkMode && styles.pickerSeparatorDark]}>:</Text>
                                    <PickerWheel value={groupStartMinute} onChange={setGroupStartMinute} max={59} label="MIN" isDarkMode={isDarkMode} />
                                </View>
                            </View>
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, isDarkMode && styles.cancelButtonDark]} onPress={() => setGroupModalVisible(false)}>
                                <Text style={[styles.modalButtonText, styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.addButton]} onPress={handleAddGroup}>
                                <Text style={[styles.modalButtonText, styles.addButtonText]}>{editingGroupId ? 'Save' : 'Create'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    containerDark: {
        backgroundColor: '#000',
    },
    mainHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        backgroundColor: '#fff',
    },
    mainHeaderDark: {
        backgroundColor: '#000',
    },
    mainTitle: {
        fontSize: 34,
        fontWeight: 'bold',
        letterSpacing: -1,
        color: '#000',
    },
    mainTitleDark: {
        color: '#fff',
    },
    themeToggle: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#f2f2f7',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 18,
        color: '#888',
    },
    fab: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    fabSecondary: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#8E8E93',
        marginBottom: 12,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        alignItems: 'center',
        zIndex: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalOverlayTouch: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        elevation: 10,
        marginBottom: -2,
        position: 'relative',
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    backgroundExtension: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        height: 1000,
        backgroundColor: '#fff',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalTitleDark: {
        color: '#fff',
    },
    typeChoice: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    typeChoiceButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
        gap: 8,
    },
    typeChoiceButtonDark: {
        backgroundColor: '#2c2c2e',
    },
    typeChoiceButtonActive: {
        backgroundColor: '#007AFF',
    },
    typeChoiceText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
    typeChoiceTextDark: {
        color: '#8E8E93',
    },
    typeChoiceTextActive: {
        color: '#fff',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        fontSize: 16,
        color: '#000',
        backgroundColor: '#f9f9f9',
    },
    inputDark: {
        backgroundColor: '#1c1c1e',
        borderColor: '#3a3a3c',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButton: {
        backgroundColor: '#007AFF',
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    cancelButtonDark: {
        backgroundColor: '#2c2c2e',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    addButtonText: {
        color: '#fff',
    },
    cancelButtonText: {
        color: '#333',
    },
    cancelButtonTextDark: {
        color: '#aaa',
    },
    simpleModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    simpleModalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        elevation: 10,
    },
    simpleModalContentDark: {
        backgroundColor: '#1c1c1e',
    },
    groupContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    groupContainerDark: {
        backgroundColor: '#1c1c1e',
        borderColor: '#2c2c2e',
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    groupToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    groupTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    groupCount: {
        fontSize: 13,
        color: '#8E8E93',
    },
    groupHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    groupEditButton: {
        padding: 4,
    },
    groupResetButton: {
        padding: 4,
    },
    groupDeleteButton: {
        padding: 4,
    },
    playAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    playAllText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    groupList: {
        padding: 16,
        paddingTop: 0,
        gap: 8,
    },
    addTimerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        marginTop: 8,
        gap: 8,
    },
    addTimerButtonDark: {
        borderColor: '#0a84ff',
        backgroundColor: 'rgba(10, 132, 255, 0.05)',
    },
    addTimerButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    scheduleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 4,
    },
    scheduleBadgeDark: {
        backgroundColor: '#2c2c2e',
    },
    scheduleBadgeText: {
        fontSize: 10,
        color: '#5856D6',
        fontWeight: 'bold',
    },
    // Inline Time Picker
    inlinePickerContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e8e8e8',
    },
    inlinePickerContainerDark: {
        backgroundColor: '#1c1c1e',
        borderColor: '#2c2c2e',
    },
    inlinePickerLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
        marginBottom: 12,
        fontVariant: ['tabular-nums'],
    },
    inlinePickerLabelDark: {
        color: '#fff',
    },
    inlinePickerWheels: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    pickerSeparator: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 24,
    },
    pickerSeparatorDark: {
        color: '#8E8E93',
    },
    recurringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    recurringRowDark: {
        backgroundColor: '#2c2c2e',
        borderColor: '#3c3c3e',
    },
    recurringLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    recurringLabelDark: {
        color: '#fff',
    },
    recurringSublabel: {
        fontSize: 12,
        color: '#8E8E93',
    },
    scheduleToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        marginTop: 4,
    },
    scheduleToggleRowDark: {
        borderTopColor: '#2c2c2e',
    },
    scheduleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    scheduleLabelDark: {
        color: '#fff',
    },
});

