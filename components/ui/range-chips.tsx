import { Text } from '@/components/ui/text';
import { Pressable, View } from 'react-native';

export const RANGE_PRESETS = [7, 15, 30, 60, 90];

type Props = {
   value: number;
   onChange: (days: number) => void;
};

export function RangeChips({ value, onChange }: Props) {
   return (
      <View className="flex-row gap-2">
         {RANGE_PRESETS.map((n) => {
            const isSelected = n === value;
            return (
               <Pressable
                  key={n}
                  onPress={() => onChange(n)}
                  className={isSelected ? 'rounded-full bg-primary px-3 py-1' : 'rounded-full bg-muted px-3 py-1'}>
                  <Text className={isSelected ? 'text-sm font-semibold text-primary-foreground' : 'text-sm text-muted-foreground'}>
                     {n}d
                  </Text>
               </Pressable>
            );
         })}
      </View>
   );
}
