import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, View } from 'react-native';

export type EntryField = {
   key: string;
   label: string;
   type: 'number' | 'text';
   unit?: string;
   optional?: boolean;
   placeholder?: string;
};

export type EntryValues = Record<string, number | string>;

type Props = {
   visible: boolean;
   title: string;
   fields: EntryField[];
   saving: boolean;
   error: string | null;
   onSave: (values: EntryValues) => void;
   onClose: () => void;
};

function parseNumber(text: string): number | null {
   const n = Number(text.replace(',', '.'));
   if (Number.isNaN(n)) return null;
   return n;
}

export function AddEntrySheet({ visible, title, fields, saving, error, onSave, onClose }: Props) {
   const [drafts, setDrafts] = React.useState<Record<string, string>>({});

   React.useEffect(() => {
      if (visible) setDrafts({});
   }, [visible]);

   function setDraft(key: string, text: string) {
      setDrafts({ ...drafts, [key]: text });
   }

   function collect(): EntryValues | null {
      const out: EntryValues = {};
      for (const f of fields) {
         const text = (drafts[f.key] ?? '').trim();
         if (text === '') {
            if (f.optional) continue;
            return null;
         }
         if (f.type === 'number') {
            const n = parseNumber(text);
            if (n === null) return null;
            out[f.key] = n;
         } else {
            out[f.key] = text;
         }
      }
      return out;
   }

   const values = collect();
   const canSave = values !== null && !saving;

   return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
         <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
               <Button variant="ghost" onPress={onClose} disabled={saving}>
                  <Text>Cancelar</Text>
               </Button>
               <Text variant="h4">{title}</Text>
               <Button variant="ghost" onPress={() => values && onSave(values)} disabled={!canSave}>
                  <Text>Guardar</Text>
               </Button>
            </View>

            <ScrollView contentContainerClassName="gap-4 px-4 py-4" keyboardShouldPersistTaps="handled">
               {fields.map((f) => (
                  <View key={f.key} className="gap-1.5">
                     <Text variant="muted">
                        {f.label}
                        {f.unit ? ` (${f.unit})` : ''}
                        {f.optional ? ' · opcional' : ''}
                     </Text>
                     <TextInput
                        className={
                           f.type === 'text'
                              ? 'min-h-24 rounded-xl border border-input bg-background px-4 py-3 font-sans text-base text-foreground placeholder:text-muted-foreground'
                              : 'h-12 rounded-xl border border-input bg-background px-4 font-sans text-base text-foreground placeholder:text-muted-foreground'
                        }
                        value={drafts[f.key] ?? ''}
                        onChangeText={(t) => setDraft(f.key, t)}
                        placeholder={f.placeholder}
                        keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                        multiline={f.type === 'text'}
                        textAlignVertical={f.type === 'text' ? 'top' : 'center'}
                        editable={!saving}
                     />
                  </View>
               ))}

               {error ? <Text className="text-destructive">{error}</Text> : null}
               {saving ? <Text variant="muted">Guardando…</Text> : null}
            </ScrollView>
         </KeyboardAvoidingView>
      </Modal>
   );
}
