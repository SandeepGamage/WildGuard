import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AppTextInput } from './AppTextInput';

/**
 * react-hook-form bound text field. Zod messages are translation keys, so the
 * error text is translated here.
 */
export function FormTextField({ control, name, ...inputProps }) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <AppTextInput
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          testID={`field-${name}`}
          {...inputProps}
        />
      )}
    />
  );
}
