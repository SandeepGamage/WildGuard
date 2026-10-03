import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

/**
 * Standard screen shell: background, safe-area padding, 24 px side gutters,
 * optional scrolling, keyboard avoidance and a pinned footer (primary action).
 *
 * @param {object} props
 * @param {boolean} [props.scroll=true] Wrap content in a ScrollView.
 * @param {boolean} [props.padTop=true] Add the status-bar inset on top.
 * @param {import('react').ReactNode} [props.footer] Pinned below the content, above the tab bar.
 * @param {{ refreshing: boolean, onRefresh: () => void }} [props.refresh] Pull-to-refresh.
 * @param {boolean} [props.edgeToEdge] No horizontal padding (for full-bleed heroes).
 */
export function ScreenContainer({
  children,
  scroll = true,
  padTop = true,
  footer = null,
  refresh,
  edgeToEdge = false,
  testID,
}) {
  const insets = useSafeAreaInsets();
  const horizontal = edgeToEdge ? 0 : spacing.screenX;
  const content = [
    styles.content,
    { paddingTop: padTop ? insets.top + spacing.lg : 0, paddingHorizontal: horizontal },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID={testID}
    >
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refresh.refreshing}
                onRefresh={refresh.onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, ...content]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingHorizontal: horizontal || spacing.screenX }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: spacing.xxl },
  footer: { paddingTop: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.background },
});
