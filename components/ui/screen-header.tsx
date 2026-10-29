import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
   title: string;
   onAdd?: () => void;
};

export function ScreenHeader({ title, onAdd }: Props) {
   const insets = useSafeAreaInsets();
   return (
      <View
         className="flex-row items-center justify-between border-b border-border bg-background px-4 pb-3"
         style={{ paddingTop: insets.top + 8 }}>
         <Text variant="h3">{title}</Text>
         {onAdd ? (
            <Pressable
               onPress={onAdd}
               hitSlop={8}
               className="h-8 w-8 items-center justify-center rounded-full bg-primary active:bg-primary/90">
               <Icon as={Plus} size={18} className="text-primary-foreground" />
            </Pressable>
         ) : null}
      </View>
   );
}
