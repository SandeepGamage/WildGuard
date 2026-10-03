import { CirclePlus, ClipboardList, House, ShieldCheck } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppTabBar } from '../../src/components/navigation/AppTabBar';
import { RoleGuard } from '../../src/components/navigation/RoleGuard';
import { USER_ROLES } from '../../src/constants/domain';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePendingReportsSync } from '../../src/hooks/usePendingReports';

function VillagerTabs() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  // Retries reports saved on the phone whenever the connection returns.
  usePendingReportsSync(profile.id);

  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t('tabs.report'),
          tabBarIcon: ({ color, size }) => <CirclePlus size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-reports"
        options={{
          title: t('tabs.myReports'),
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: t('tabs.safety'),
          tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

/** Villager interface: Home, Report, My Reports, Safety. Other roles are redirected away. */
export default function VillagerLayout() {
  return (
    <RoleGuard role={USER_ROLES.VILLAGER}>
      <VillagerTabs />
    </RoleGuard>
  );
}
