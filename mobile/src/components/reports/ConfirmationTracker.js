import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { REPORT_PROGRESS } from '../../constants/domain';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';

const STEPS = [
  { key: REPORT_PROGRESS.RECEIVED, title: 'tracker.received', body: 'tracker.receivedBody' },
  { key: REPORT_PROGRESS.BEING_CHECKED, title: 'tracker.beingChecked', body: 'tracker.beingCheckedBody' },
  { key: REPORT_PROGRESS.OUTCOME, title: 'tracker.outcome', body: 'tracker.outcomeBody' },
];

const ORDER = STEPS.map((step) => step.key);

/**
 * "What happens next": Received -> Being checked -> Outcome.
 * Steps up to and including `current` are ticked, so it is honest about how far
 * the report has really got.
 *
 * @param {{ current: 'RECEIVED'|'BEING_CHECKED'|'OUTCOME' }} props
 */
export function ConfirmationTracker({ current = REPORT_PROGRESS.RECEIVED }) {
  const { t } = useTranslation();
  const currentIndex = ORDER.indexOf(current);

  return (
    <Card testID="confirmation-tracker">
      <AppText variant="cardTitle" style={styles.heading}>
        {t('tracker.title')}
      </AppText>
      {STEPS.map((step, index) => {
        const done = index <= currentIndex;
        return (
          <View key={step.key} style={styles.row} testID={`tracker-step-${step.key}`}>
            <View
              style={[styles.dot, done && styles.dotDone]}
              accessibilityLabel={done ? t('tracker.done') : t('tracker.pending')}
            >
              {done ? <Check size={14} color={colors.textOnPrimary} /> : null}
            </View>
            <AppText variant="bodyStrong" color={done ? 'text' : 'textMuted'} style={styles.stepTitle}>
              {t(step.title)}
            </AppText>
            <AppText variant="caption" color="textMuted" style={styles.stepBody}>
              {t(step.body)}
            </AppText>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: spacing.md },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primary },
  stepTitle: { width: 104 },
  stepBody: { flex: 1 },
});
