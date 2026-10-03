import { Redirect, Stack } from 'expo-router';
import { config } from '../../src/constants/config';
import { colors } from '../../src/theme';

/**
 * Demo-only area (SMS simulator). It is not a bottom tab, and the whole group
 * is unreachable unless EXPO_PUBLIC_DEMO_MODE=true.
 */
export default function DemoLayout() {
  if (!config.demoMode) return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
