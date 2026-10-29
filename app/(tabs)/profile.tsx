import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsPicker, type Setting } from '@/components/ui/settings-picker';
import { Text } from '@/components/ui/text';
import { getMe, updateMe, type MePatch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useHealthSync } from '@/lib/health-sync-context';
import { ChevronRight, HeartPulse, User } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 60;

const SETTINGS: Setting[] = [
   { key: 'heightCm', label: 'Altura', type: 'number', unit: 'cm', min: 120, max: 220, step: 1 },
   { key: 'birthDate', label: 'Fecha de nacimiento', type: 'date' },
   { key: 'dailyKcalTarget', label: 'Calorías diarias', type: 'number', unit: 'kcal', min: 1000, max: 5000, step: 50 },
   { key: 'dailyProteinTarget', label: 'Proteína diaria', type: 'number', unit: 'g', min: 50, max: 300, step: 5 },
];

type Values = Record<string, number | string | null>;

function formatValue(setting: Setting, value: number | string | null) {
   if (value === null || value === undefined) return '—';
   if (setting.type === 'number') return `${value} ${setting.unit}`;
   const [y, m, d] = String(value).split('-');
   return `${d}-${m}-${y}`;
}

export default function ProfileScreen() {
   const insets = useSafeAreaInsets();
   const { user, logout } = useAuth();
   const { sync } = useHealthSync();
   const [values, setValues] = React.useState<Values>({});
   const [error, setError] = React.useState<string | null>(null);
   const [editing, setEditing] = React.useState<Setting | null>(null);
   const [syncing, setSyncing] = React.useState(false);
   const [syncMessage, setSyncMessage] = React.useState<string | null>(null);

   React.useEffect(() => {
      getMe()
         .then((me) => setValues(me))
         .catch((e: Error) => setError(e.message));
   }, []);

   async function handleSave(key: string, value: number | string) {
      setEditing(null);
      setValues((prev) => ({ ...prev, [key]: value }));
      try {
         const me = await updateMe({ [key]: value } as MePatch);
         setValues(me);
         setError(null);
      } catch (e) {
         setError((e as Error).message);
      }
   }

   async function handleSync() {
      setSyncing(true);
      setSyncMessage(null);
      try {
         const result = await sync(true);
         setSyncMessage(`Listo: ${result.daysUpserted} días y ${result.workoutsUpserted} entrenamientos`);
      } catch (e) {
         setSyncMessage((e as Error).message);
      } finally {
         setSyncing(false);
      }
   }

   return (
      <View className="flex-1">
         <ScreenHeader title="Perfil" />
         <View className="flex-row items-center gap-4 p-6">
            <Icon as={User} size={48} className="text-muted-foreground" />
            <View className="flex-1 gap-1">
               <Text className="font-medium">{user?.email}</Text>
               <Pressable onPress={logout}>
                  <Text className="text-sm text-foreground">Cerrar sesión</Text>
               </Pressable>
            </View>
         </View>

         <View
            className="flex-1 justify-center gap-4 px-6"
            style={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT }}>
            <Text variant="h4" className="text-center">
               Settings
            </Text>
            {error && <Text className="text-center text-sm text-destructive">{error}</Text>}
            <View className="rounded-xl border border-border bg-card">
               {SETTINGS.map((setting, i) => (
                  <Pressable
                     key={setting.key}
                     onPress={() => setEditing(setting)}
                     className={`flex-row items-center justify-between px-4 py-3 ${
                        i < SETTINGS.length - 1 ? 'border-b border-border' : ''
                     }`}>
                     <Text>{setting.label}</Text>
                     <View className="flex-row items-center gap-1">
                        <Text className="text-muted-foreground">
                           {formatValue(setting, values[setting.key] ?? null)}
                        </Text>
                        <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
                     </View>
                  </Pressable>
               ))}
            </View>

            {Platform.OS === 'ios' && (
               <View className="gap-2">
                  <Pressable
                     onPress={handleSync}
                     disabled={syncing}
                     className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                     <Icon as={HeartPulse} size={18} className="text-foreground" />
                     <Text>{syncing ? 'Sincronizando...' : 'Sincronizar con Apple Health'}</Text>
                  </Pressable>
                  {syncMessage && (
                     <Text className="text-center text-sm text-muted-foreground">{syncMessage}</Text>
                  )}
               </View>
            )}
         </View>

         <SettingsPicker
            setting={editing}
            value={editing ? (values[editing.key] ?? null) : null}
            onSave={handleSave}
            onClose={() => setEditing(null)}
         />
      </View>
   );
}
