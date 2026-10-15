import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { IconTile } from '../components/IconTile';
import { useAuth } from '../context/AuthContext';
import { spacing, useTheme, type ThemeColors } from '../theme';
import type { MoreStackParamList } from '../navigation/MoreStack';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>;

/**
 * Directory and Documents are deliberately NOT gated by the 'employees' or
 * 'documents' platform modules — those modules' required_permission is
 * admin-level (employees.view / employee_documents.view), which the plain
 * Employee role never holds, so checking can_access on them would hide these
 * tiles for every ordinary employee even though the self-service endpoints
 * behind them (directory via the allow_employee_directory workspace setting,
 * documents via /employee-profile/overview) work fine. The web app gates
 * Directory the same way: by the workspace setting alone, not a module.
 */
const ITEMS = [
  { key: 'Directory', icon: 'people-outline', label: 'Directory', moduleColorKey: 'directory', module: null },
  { key: 'Calendar', icon: 'calendar-outline', label: 'Calendar', moduleColorKey: 'calendar', module: null },
  { key: 'Assets', icon: 'laptop-outline', label: 'My assets', moduleColorKey: 'assets', module: 'assets' },
  { key: 'Documents', icon: 'document-text-outline', label: 'Documents', moduleColorKey: 'documents', module: 'employee_self_service' },
  { key: 'Payslips', icon: 'cash-outline', label: 'Payslips', moduleColorKey: 'payslips', module: 'payroll' },
  { key: 'Lifestyle', icon: 'heart-outline', label: 'Lifestyle', moduleColorKey: 'lifestyle', module: 'employee_self_service' },
] as const;

export function MoreMenuScreen({ navigation }: Props) {
  const { colors, moduleColors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { moduleByKey, session } = useAuth();
  const items = ITEMS.filter((item) => (!item.module || moduleByKey(item.module)?.can_access === true) && (item.key !== 'Directory' || session?.workspace?.employee_experience.allow_employee_directory === true));

  return (
    <ScrollView style={styles.flex}>
      <Text style={typography.title}>More</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>Everything else, in one place.</Text>
      <View style={styles.grid}>
        {items.map((item) => {
          const tileColors = moduleColors[item.moduleColorKey];
          return (
            <IconTile
              key={item.key}
              icon={item.icon}
              label={item.label}
              bg={tileColors.bg}
              iconColor={tileColors.icon}
              onPress={() => navigation.navigate(item.key)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: spacing.lg },
});
