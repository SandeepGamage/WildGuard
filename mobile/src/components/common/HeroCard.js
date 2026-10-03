import { Camera } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

/**
 * Green photo-style banner (Home "Report now", Safety "Elephant nearby?").
 * The gradient stands in for the Figma photo area; the caption names the photo
 * to drop into assets/images when real artwork is supplied.
 */
export function HeroCard({ title, body, caption, action, style, testID }) {
  return (
    <LinearGradient
      colors={[colors.heroTop, colors.heroBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
      testID={testID}
    >
      <View style={styles.cameraMark} accessibilityElementsHidden importantForAccessibility="no">
        <Camera size={18} color={colors.textOnPrimary} />
      </View>
      <AppText variant="heading" color="textOnPrimary" style={styles.title}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color="textOnPrimary" style={styles.body}>
          {body}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
      {caption ? (
        <AppText variant="caption" color="textOnPrimary" style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.hero,
    padding: spacing.xl,
    minHeight: 188,
  },
  cameraMark: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  title: { paddingRight: spacing.xxxl },
  body: { marginTop: spacing.xs, opacity: 0.92 },
  action: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  caption: { marginTop: spacing.lg, opacity: 0.9 },
});
