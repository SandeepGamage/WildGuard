import { History, MapPinned } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppTabBar } from '../../src/components/navigation/AppTabBar';
import { RoleGuard } from '../../src/components/navigation/RoleGuard';
import { USER_ROLES } from '../../src/constants/domain';
import { PatrolProvider } from '../../src/contexts/PatrolContext';

/** Focused task screens: the tab bar is hidden while the ranger patrols, logs an incident or reads the summary. */
const HIDE_TAB_BAR_ON = ['active-patrol', 'log-incident', 'patrol-summary'];

function RangerTabs() {
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) =>
        HIDE_TAB_BAR_ON.includes(props.state.routes[props.state.index].name) ? null : (
          <AppTabBar {...props} />
        )
      }
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="start-patrol"
        options={{
          title: t('tabs.patrol'),
          tabBarIcon: ({ color, size }) => <MapPinned size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="patrol-history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="active-patrol" options={{ href: null }} />
      <Tabs.Screen name="log-incident" options={{ href: null }} />
      <Tabs.Screen name="patrol-summary" options={{ href: null }} />
    </Tabs>
  );
}

/**
 * Field ranger interface (UC1): Patrol (start, active, log incident, summary) and History.
 * The provider keeps tracking and uploading alive while the ranger moves between screens.
 */
export default function RangerLayout() {
  return (
    <RoleGuard role={USER_ROLES.FIELD_RANGER}>
      <PatrolProvider>
        <RangerTabs />
      </PatrolProvider>
    </RoleGuard>
  );
}
