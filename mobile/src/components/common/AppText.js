import { Text } from 'react-native';
import { colors, typography } from '../../theme';

/**
 * Themed text. `variant` selects a style from the typography scale, `color` a
 * token from the colour palette.
 */
export function AppText({ variant = 'body', color = 'text', style, children, ...props }) {
  return (
    <Text style={[typography[variant], { color: colors[color] }, style]} {...props}>
      {children}
    </Text>
  );
}
