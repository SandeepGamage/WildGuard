import { AlertTriangle, LogOut, ShieldAlert } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

/**
 * Reusable modal dialog for destructive or critical user confirmations
 * (e.g. Sign out, reject report, delete, discard draft).
 *
 * @param {{
 *   visible: boolean,
 *   title: string,
 *   message?: string,
 *   confirmText?: string,
 *   cancelText?: string,
 *   variant?: 'danger' | 'primary',
 *   icon?: import('react').ReactNode,
 *   loading?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 *   testIDPrefix?: string,
 * }} props
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon = null,
  loading = false,
  onConfirm,
  onCancel,
  testIDPrefix = 'confirm-dialog',
}) {
  const isDanger = variant === 'danger';
  const defaultIcon = isDanger ? (
    <LogOut size={26} color={colors.danger} />
  ) : (
    <ShieldAlert size={26} color={colors.primary} />
  );

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelText}
        testID={`${testIDPrefix}-backdrop`}
      >
        <Pressable
          style={styles.card}
          onPress={(e) => {
            // Prevent clicks inside card from closing backdrop
            e?.stopPropagation?.();
          }}
          accessibilityRole="alert"
          accessibilityViewIsModal
          testID={`${testIDPrefix}-container`}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isDanger ? colors.dangerTint : colors.surfaceTint },
            ]}
          >
            {icon ?? defaultIcon}
          </View>

          <AppText variant="cardTitle" style={styles.title} testID={`${testIDPrefix}-title`}>
            {title}
          </AppText>

          {message ? (
            <AppText
              variant="body"
              color="textMuted"
              style={styles.message}
              testID={`${testIDPrefix}-message`}
            >
              {message}
            </AppText>
          ) : null}

          <View style={styles.buttonRow}>
            <View style={styles.btnCol}>
              <AppButton
                compact
                variant="secondary"
                title={cancelText}
                onPress={onCancel}
                disabled={loading}
                testID={`${testIDPrefix}-cancel`}
              />
            </View>
            <View style={styles.btnCol}>
              <AppButton
                compact
                variant={isDanger ? 'danger' : 'primary'}
                title={confirmText}
                loading={loading}
                onPress={onConfirm}
                testID={`${testIDPrefix}-confirm`}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  btnCol: {
    flex: 1,
  },
});
