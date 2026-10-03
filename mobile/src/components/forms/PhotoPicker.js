import { Camera, X } from 'lucide-react-native';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PHOTO_ERRORS } from '../../hooks/usePhotoPicker';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';

const ERROR_KEYS = {
  [PHOTO_ERRORS.PERMISSION]: 'details.photoPermission',
  [PHOTO_ERRORS.TOO_LARGE]: 'details.photoTooLarge',
  [PHOTO_ERRORS.UNSUPPORTED]: 'details.photoUnsupported',
};

/**
 * Optional photo ("Add photo - Optional, only if it is safe"). Shows a
 * dashed add area, or the chosen thumbnail with a remove button.
 *
 * @param {{ photo: object|null, error: string|null, onPick: (source: 'camera'|'library') => void, onRemove: () => void }} props
 */
export function PhotoPicker({ photo, error, onPick, onRemove }) {
  const { t } = useTranslation();

  const chooseSource = () =>
    Alert.alert(t('details.addPhoto'), t('details.photoSafe'), [
      { text: t('details.takePhoto'), onPress: () => onPick('camera') },
      { text: t('details.chooseGallery'), onPress: () => onPick('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  return (
    <View>
      {photo ? (
        <View style={styles.preview} testID="photo-preview">
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            accessibilityLabel={t('details.photoAttached')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('details.removePhoto')}
            onPress={onRemove}
            style={styles.remove}
            testID="photo-remove"
          >
            <X size={18} color={colors.textOnPrimary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('details.addPhoto')}
          onPress={chooseSource}
          style={styles.add}
          testID="photo-add"
        >
          <Camera size={24} color={colors.primary} />
          <View style={styles.text}>
            <AppText variant="cardTitle">{t('details.addPhoto')}</AppText>
            <AppText variant="caption" color="textMuted">
              {t('details.photoOptional')}
            </AppText>
          </View>
        </Pressable>
      )}
      {error ? (
        <AppText variant="caption" color="dangerText" style={styles.error}>
          {t(ERROR_KEYS[error])}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    minHeight: 88,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  text: { flex: 1 },
  preview: { height: 180, borderRadius: radius.card, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { marginTop: spacing.sm },
});
