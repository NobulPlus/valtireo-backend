import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useV2Colors, V2_FONTS } from '../theme';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

/**
 * See docs/design-system/03-component-specifications.md ("Input"). Pill-radius field
 * with a leading icon and, for secure fields, a trailing show/hide toggle that actually
 * controls the obscured state — not a decorative copy of the reference mockup's icon.
 */
export function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, autoComplete, leadingIcon, error }: InputProps) {
  const v2 = useV2Colors();
  const [obscured, setObscured] = useState(secureTextEntry ?? false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: v2.muted }]}>{label}</Text>
      <View style={[styles.wrap, { backgroundColor: v2.surface, borderColor: focused ? v2.primary : v2.border }]}>
        {leadingIcon ? <Ionicons name={leadingIcon} size={18} color={v2.muted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={v2.muted}
          secureTextEntry={secureTextEntry ? obscured : false}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: v2.ink, fontFamily: V2_FONTS.interRegular }]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setObscured((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={obscured ? 'Show password' : 'Hide password'}
            hitSlop={8}
          >
            <Ionicons name={obscured ? 'eye-outline' : 'eye-off-outline'} size={18} color={v2.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: v2.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontFamily: V2_FONTS.interMedium, fontSize: 13 },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md + 2,
    height: 54,
    gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  error: { fontSize: 13, fontFamily: V2_FONTS.interRegular },
});
