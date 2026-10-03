import { StyleSheet } from 'react-native';
import { spacing } from '../../theme';
import { AppText } from './AppText';

/** Small muted heading above a form group ("How many elephants?", "Notes"). */
export function SectionLabel({ children, style }) {
  return (
    <AppText variant="label" color="textMuted" style={[styles.label, style]}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm, marginTop: spacing.sm },
});
