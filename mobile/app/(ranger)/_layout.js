import { Stack } from 'expo-router';
import { RoleGuard } from '../../src/components/navigation/RoleGuard';
import { USER_ROLES } from '../../src/constants/domain';
import { PatrolProvider } from '../../src/contexts/PatrolContext';
import { colors } from '../../src/theme';

/**
 * Field ranger interface (UC1): start patrol, active patrol, log incident, summary.
 * The provider keeps tracking and uploading alive while the ranger moves between screens.
 */
export default function RangerLayout() {
  return (
    <RoleGuard role={USER_ROLES.FIELD_RANGER}>
      <PatrolProvider>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
        />
      </PatrolProvider>
    </RoleGuard>
  );
}
