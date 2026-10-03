import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../src/components/common/AppHeader';
import { AppText } from '../../../src/components/common/AppText';
import { Card } from '../../../src/components/common/Card';
import { ScreenContainer } from '../../../src/components/common/ScreenContainer';
import { CategoryCard } from '../../../src/components/reports/CategoryCard';
import { CATEGORY_ORDER } from '../../../src/constants/incidentTypes';
import { ROUTES } from '../../../src/constants/routes';
import { spacing } from '../../../src/theme';

const chunkPairs = (items) =>
  items.reduce((rows, item, index) => {
    if (index % 2 === 0) rows.push([item]);
    else rows[rows.length - 1].push(item);
    return rows;
  }, []);

/** Flow 1, step 2: large icon tiles for "What is happening?". */
export default function CategoryScreen() {
  const { t } = useTranslation();

  const choose = (incidentType) =>
    router.push({ pathname: ROUTES.villager.reportDetails, params: { type: incidentType } });

  return (
    <ScreenContainer>
      <AppHeader title={t('categories.title')} subtitle={t('categories.subtitle')} />

      <View style={styles.grid}>
        {chunkPairs(CATEGORY_ORDER).map((pair) => (
          <View key={pair[0]} style={styles.row}>
            {pair.map((incidentType) => (
              <CategoryCard key={incidentType} incidentType={incidentType} onPress={choose} />
            ))}
          </View>
        ))}
      </View>

      <Card tone="tint" style={styles.help}>
        <AppText variant="bodyStrong">{t('categories.notSure')}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('categories.notSureBody')}
        </AppText>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  help: { marginTop: spacing.xl, gap: spacing.xs },
});
