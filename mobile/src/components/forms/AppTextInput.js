import { forwardRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { AppText } from '../common/AppText';

/**
 * Labelled rounded text field with inline error text.
 * @param {{ label?: string, error?: string, multiline?: boolean }} props
 */
export const AppTextInput = forwardRef(function AppTextInput(
  { label, error, multiline = false, style, ...inputProps },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText variant="label" color="textMuted" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError, style]}
        {...inputProps}
      />
      {error ? (
        <AppText variant="caption" color="dangerText" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.sm },
  input: {
    ...typography.body,
    minHeight: 56,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textBody,
    paddingHorizontal: spacing.lg,
  },
  multiline: { minHeight: 112, paddingTop: spacing.lg },
  inputError: { borderColor: colors.danger },
  error: { marginTop: spacing.xs },
});
