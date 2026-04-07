import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const minimumGapMs = 34;
let lastTriggeredAt = 0;

function shouldSkip() {
  const now = Date.now();

  if (now - lastTriggeredAt < minimumGapMs) {
    return true;
  }

  lastTriggeredAt = now;
  return false;
}

async function run(task: () => Promise<void>) {
  if (Platform.OS === 'web' || shouldSkip()) {
    return;
  }

  try {
    await task();
  } catch (error) {
    console.warn('[haptics] skipped', error);
  }
}

export function hapticSoft() {
  void run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticSelection() {
  void run(() => Haptics.selectionAsync());
}

export function hapticSuccess() {
  void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning() {
  void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

