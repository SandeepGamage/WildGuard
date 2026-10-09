import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';
import { AppText } from '../common/AppText';

/**
 * Destructive action that must be held down to confirm, so it cannot be tapped by accident
 * with gloves or in a pocket. Screen readers get a normal "activate" action instead.
 */
export function HoldToConfirmButton({ title, hint, holdMs, onConfirm, disabled = false, testID }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [width] = useState(() => progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }));
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => {
    clearTimeout(timer.current);
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const begin = () => {
    if (disabled) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(() => {
      progress.setValue(0);
      onConfirm();
    }, holdMs);
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={hint}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => !disabled && onConfirm()}
        disabled={disabled}
        onPressIn={begin}
        onPressOut={cancel}
        testID={testID}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Animated.View style={[styles.fill, { width }]} />
        <AppText variant="button" color="dangerText">
          {title}
        </AppText>
      </Pressable>
      {hint ? (
        <AppText variant="caption" color="textMuted" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.dangerTint },
  disabled: { opacity: 0.5 },
  hint: { textAlign: 'center', marginTop: 6 },
});
