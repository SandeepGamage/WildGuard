import { ClipboardList, History, Map as MapIcon, User } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppTabBar } from '../../src/components/navigation/AppTabBar';
import { RoleGuard } from '../../src/components/navigation/RoleGuard';
import { USER_ROLES } from '../../src/constants/domain';

function LiaisonTabs() {
  const { t } = useTranslation();

  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="queue"
        options={{
          title: t('tabs.queue'),
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ color, size }) => <MapIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

/** Community Liaison Officer interface: Queue, Map, History, Profile. Villagers are redirected away. */
export default function LiaisonLayout() {
  return (
    <RoleGuard role={USER_ROLES.COMMUNITY_LIAISON_OFFICER}>
      <LiaisonTabs />
    </RoleGuard>
  );
}
