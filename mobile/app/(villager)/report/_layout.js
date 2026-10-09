import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function ReportStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
