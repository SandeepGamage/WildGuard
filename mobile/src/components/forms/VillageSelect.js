import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVillages } from '../../hooks/useVillages';
import { colors, radius, spacing } from '../../theme';
import { villageName } from '../../utils/villageName';
import { AppText } from '../common/AppText';
import { ErrorState, LoadingState } from '../common/StateViews';

/**
 * Village list picker. Used on sign-up ("Choose village") and by "Change" on
 * the report location card. Villagers pick from a list; coordinates are never typed.
 *
 * Uncontrolled: renders a field that opens the sheet. Controlled (`visible` + `onClose`):
 * renders only the sheet, so another control (e.g. "Change") can open it.
 *
 * @param {{ value: string|null, onChange: (villageId: string) => void, label?: string, error?: string, visible?: boolean, onClose?: () => void }} props
 */
export function VillageSelect({ value, onChange, label, error, visible, onClose }) {
  const { t, i18n } = useTranslation();
  const villages = useVillages();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = visible !== undefined;
  const open = controlled ? visible : internalOpen;
  const close = () => (controlled ? onClose?.() : setInternalOpen(false));
  const selected = villages.data?.find((village) => village.id === value);

  return (
    <View style={styles.wrapper}>
      {controlled ? null : (
        <>
          {label ? (
            <AppText variant="label" color="textMuted" style={styles.label}>
              {label}
            </AppText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setInternalOpen(true)}
            style={[styles.field, error && styles.fieldError]}
            testID="village-select"
          >
            <AppText variant="body" color={selected ? 'textBody' : 'textSubtle'} style={styles.fieldText}>
              {selected ? villageName(selected, i18n.language) : t('villages.choose')}
            </AppText>
            <ChevronDown size={18} color={colors.textMuted} />
          </Pressable>
          {error ? (
            <AppText variant="caption" color="dangerText" style={styles.error}>
              {error}
            </AppText>
          ) : null}
        </>
      )}

      <Modal transparent animationType="slide" visible={open} onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <AppText variant="heading" style={styles.sheetTitle}>
              {t('villages.title')}
            </AppText>
            {villages.isLoading ? <LoadingState /> : null}
            {villages.isError ? (
              <ErrorState message={t('errors.network')} onRetry={() => villages.refetch()} />
            ) : null}
            <FlatList
              data={villages.data ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: item.id === value }}
                  onPress={() => {
                    onChange(item.id);
                    close();
                  }}
                  style={styles.option}
                  testID={`village-option-${item.id}`}
                >
                  <AppText variant="cardTitle" style={styles.optionText}>
                    {villageName(item, i18n.language)}
                  </AppText>
                  {item.id === value ? <Check size={18} color={colors.primary} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.sm },
  field: {
    minHeight: 56,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldError: { borderColor: colors.danger },
  fieldText: { flex: 1 },
  error: { marginTop: spacing.xs },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: spacing.xxl,
  },
  sheetTitle: { marginBottom: spacing.md },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1 },
});
