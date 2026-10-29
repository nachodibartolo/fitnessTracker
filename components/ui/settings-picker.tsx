import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as React from 'react';
import { Modal, View } from 'react-native';

export type NumberSetting = {
   key: string;
   label: string;
   type: 'number';
   unit: string;
   min: number;
   max: number;
   step: number;
};

export type DateSetting = {
   key: string;
   label: string;
   type: 'date';
};

export type Setting = NumberSetting | DateSetting;

type Props = {
   setting: Setting | null;
   value: number | string | null;
   onSave: (key: string, value: number | string) => void;
   onClose: () => void;
};

function parseIsoDate(iso: string) {
   return new Date(`${iso}T00:00:00Z`);
}

function toIsoDate(date: Date) {
   return date.toISOString().slice(0, 10);
}

function range(min: number, max: number, step: number) {
   const out: number[] = [];
   for (let n = min; n <= max; n += step) out.push(n);
   return out;
}

export function SettingsPicker({ setting, value, onSave, onClose }: Props) {
   const [draft, setDraft] = React.useState<number | string | null>(value);

   React.useEffect(() => {
      setDraft(value);
   }, [setting, value]);

   if (!setting) return null;

   const current = draft ?? (setting.type === 'number' ? setting.min : null);

   return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
         <View className="flex-1 bg-background">
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
               <Button variant="ghost" onPress={onClose}>
                  <Text>Cancelar</Text>
               </Button>
               <Text variant="h4">{setting.label}</Text>
               <Button variant="ghost" onPress={() => current !== null && onSave(setting.key, current)}>
                  <Text>Guardar</Text>
               </Button>
            </View>

            <View className="flex-1 justify-center">
               {setting.type === 'number' ? (
                  <Picker selectedValue={current} onValueChange={(v) => setDraft(v)}>
                     {range(setting.min, setting.max, setting.step).map((n) => (
                        <Picker.Item key={n} label={`${n} ${setting.unit}`} value={n} />
                     ))}
                  </Picker>
               ) : (
                  <View className="items-center">
                     <DateTimePicker
                        value={draft ? new Date(draft) : new Date(2000, 0, 1)}
                        mode="date"
                        display="spinner"
                        maximumDate={new Date()}
                        onChange={(_e, date) => date && setDraft(date.toISOString().slice(0, 10))}
                     />
                  </View>
               )}
            </View>
         </View>
      </Modal>
   );
}
