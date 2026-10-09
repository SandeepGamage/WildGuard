import { AlertCircle, CheckCircle, CloudOff, Info, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

const TOAST_THEMES = {
  success: {
    border: colors.borderStrong,
    iconColor: colors.success,
    iconBg: colors.successTint,
    Icon: CheckCircle,
  },
  warning: {
    border: colors.warningBorder,
    iconColor: colors.warningText,
    iconBg: colors.warningTint,
    Icon: CloudOff,
  },
  danger: {
    border: colors.dangerBorder,
    iconColor: colors.danger,
    iconBg: colors.dangerTint,
    Icon: AlertCircle,
  },
  info: {
    border: colors.border,
    iconColor: colors.primary,
    iconBg: colors.surfaceTint,
    Icon: Info,
  },
};

/**
 * Professional floating in-app toast notification.
 * Slides down smoothly from the top of the window.
 *
 * @param {{
 *   visible: boolean,
 *   type?: 'success' | 'warning' | 'danger' | 'info',
 *   title?: string,
 *   message?: string,
 *   onDismiss: () => void,
 *   duration?: number,
 *   testID?: string,
 * }} props
 */
export function Toast({
  visible,
  type = 'success',
  title,
  message,
  onDismiss,
  duration = 4000,
  testID = 'top-toast',
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          dismiss();
        }, duration);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration]);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  if (!visible) return null;

  const theme = TOAST_THEMES[type] || TOAST_THEMES.success;
  const IconComponent = theme.Icon;
  const topOffset = Math.max(insets?.top || 0, 16) + spacing.xs;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          top: topOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Pressable style={[styles.card, { borderColor: theme.border }]} onPress={dismiss}>
        <View style={[styles.iconCircle, { backgroundColor: theme.iconBg }]}>
          <IconComponent size={20} color={theme.iconColor} />
        </View>

        <View style={styles.textContainer}>
          {title ? (
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
          ) : null}
          {message ? (
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {message}
            </AppText>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss toast"
          onPress={dismiss}
          style={styles.closeBtn}
          hitSlop={8}
          testID={`${testID}-close`}
        >
          <X size={16} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    shadowColor: '#0C3B2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    color: colors.primary,
  },
  closeBtn: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
