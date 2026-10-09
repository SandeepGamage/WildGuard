import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';

/**
 * Expo Router turns `href: null` into `tabBarItemStyle: { display: 'none' }` (and drops `href`),
 * so that is what marks a screen that must not get its own tab.
 */
const isHiddenTab = (options) =>
  options.href === null || StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none';

/**
 * Bottom navigation matching the Figma bar: white surface, icon sitting in a
 * mint pill when active, small semibold label underneath.
 * Used as the `tabBar` of both role-specific Tabs navigators.
 */
export function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        if (isHiddenTab(options)) return null;

        const focused = state.index === index;
        const label = options.title ?? route.name;
        const iconColor = focused ? colors.primary : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={styles.item}
            testID={`tab-${route.name}`}
          >
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              {options.tabBarIcon?.({ focused, color: iconColor, size: 22 })}
            </View>
            <AppText variant="tab" color={focused ? 'primary' : 'textMuted'}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: spacing.xs, minHeight: 56 },
  iconPill: {
    width: 64,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: { backgroundColor: colors.surfaceTint },
});
