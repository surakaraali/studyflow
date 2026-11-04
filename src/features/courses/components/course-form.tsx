import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { COURSE_NAME_MAX } from '@/domain/rules';
import { ColorPicker } from '@/features/courses/components/color-picker';
import type { CourseNameError } from '@/features/courses/validation';

type CourseFormProps = {
  name: string;
  onChangeName: (name: string) => void;
  color: string;
  onChangeColor: (hex: string) => void;
  error: CourseNameError | null;
  onSubmit?: () => void;
  autoFocus?: boolean;
};

/** Name and color of a course (custom course, edit). */
export function CourseForm({
  name,
  onChangeName,
  color,
  onChangeColor,
  error,
  onSubmit,
  autoFocus,
}: CourseFormProps) {
  const { t } = useTranslation();
  const errorText =
    error === 'required'
      ? t('courses.nameRequired')
      : error === 'tooLong'
        ? t('courses.nameTooLong', { max: COURSE_NAME_MAX })
        : error === 'duplicate'
          ? t('courses.nameDuplicate')
          : null;

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('courses.nameLabel')}
        placeholder={t('courses.namePlaceholder')}
        hint={t('courses.nameHint', { max: COURSE_NAME_MAX })}
        error={errorText}
        value={name}
        onChangeText={onChangeName}
        maxLength={COURSE_NAME_MAX}
        autoCapitalize="words"
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <ColorPicker value={color} onChange={onChangeColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xl,
  },
});
