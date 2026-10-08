import { Text } from '@/components/ui/text';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Título de pantalla común a todas las tabs. NativeTabs no dibuja header,
 * así que esquiva la barra de estado por su cuenta.
 */
export function ScreenHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="border-b border-border bg-background px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}>
      <Text variant="h3">{title}</Text>
    </View>
  );
}
