import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { analyzeMeal, deleteMeal, getMeals, type Meal, type MealsDay } from '@/lib/api';
import { cn } from '@/lib/utils';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, Plus, Sparkles, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MEAL_TYPE: Record<NonNullable<Meal['mealType']>, string> = {
  BREAKFAST: 'Desayuno',
  LUNCH: 'Almuerzo',
  DINNER: 'Cena',
  SNACK: 'Snack',
};

const g = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${Math.round(v)} g`;
const kcal = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Math.round(v).toLocaleString('es-AR');
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function ComidaScreen() {
  const insets = useSafeAreaInsets();
  const [day, setDay] = React.useState<MealsDay | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setDay(await getMeals());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmDelete(meal: Meal) {
    Alert.alert('Borrar comida', `¿Borrar "${meal.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(meal.id);
            await load();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo borrar');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Comida" />
      <FlatList
        data={day?.meals ?? []}
        keyExtractor={(m) => m.id}
        contentContainerClassName="gap-3 px-4 pb-28 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="mb-1 gap-4">
            <Totals day={day} />
            {error ? <Text className="text-destructive">Error: {error}</Text> : null}
            <Text variant="h4">Hoy</Text>
          </View>
        }
        ListEmptyComponent={
          day === null && !error ? (
            <View className="gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </View>
          ) : (
            <Text variant="muted">Todavía no registraste comidas hoy.</Text>
          )
        }
        renderItem={({ item }) => <MealRow meal={item} onLongPress={() => confirmDelete(item)} />}
      />

      <Pressable
        onPress={() => setAdding(true)}
        className="absolute right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-black/20 active:bg-primary/90"
        style={{ bottom: insets.bottom + 16 }}>
        <Icon as={Plus} size={26} className="text-primary-foreground" />
      </Pressable>

      <AddMealModal
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          load();
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------

function Totals({ day }: { day: MealsDay | null }) {
  const t = day?.totals;
  const cells: { label: string; value: string }[] = [
    { label: 'Calorías', value: t ? kcal(t.calories) : '' },
    { label: 'Proteína', value: t ? g(t.proteinG) : '' },
    { label: 'Carbs', value: t ? g(t.carbsG) : '' },
    { label: 'Grasas', value: t ? g(t.fatG) : '' },
  ];
  return (
    <Card className="flex-row gap-0 px-2 py-4">
      {cells.map((c, i) => (
        <View
          key={c.label}
          className={cn('flex-1 items-center gap-1', i > 0 && 'border-l border-border')}>
          <Text variant="muted">{c.label}</Text>
          {t ? (
            <Text className={cn('font-sans-semibold', i === 0 ? 'text-2xl' : 'text-xl')}>
              {c.value}
            </Text>
          ) : (
            <Skeleton className="h-7 w-14" />
          )}
        </View>
      ))}
    </Card>
  );
}

function MealRow({ meal, onLongPress }: { meal: Meal; onLongPress: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} onLongPress={onLongPress} delayLongPress={400}>
      <Card className="gap-3 px-4 py-4 active:bg-accent">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="font-sans-semibold text-base" numberOfLines={2}>
              {meal.name}
            </Text>
            <Text variant="muted">
              {hora(meal.eatenAt)}
              {meal.mealType ? ` · ${MEAL_TYPE[meal.mealType]}` : ''}
              {meal.aiConfidence !== null && meal.aiConfidence < 0.5 ? ' · estimación dudosa' : ''}
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-sans-semibold text-xl">{kcal(meal.calories)}</Text>
            <Text variant="muted">kcal</Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <Macro label="P" value={meal.proteinG} />
          <Macro label="C" value={meal.carbsG} />
          <Macro label="G" value={meal.fatG} />
        </View>

        {open && meal.items.length > 0 ? (
          <View className="gap-1 border-t border-border pt-3">
            {meal.items.map((it) => (
              <View key={it.id} className="flex-row justify-between gap-3">
                <Text variant="muted" className="flex-1" numberOfLines={1}>
                  {it.name}
                  {it.quantity ? ` · ${it.quantity}${it.unit ? ` ${it.unit}` : ''}` : ''}
                </Text>
                <Text variant="muted">{kcal(it.calories)} kcal</Text>
              </View>
            ))}
            {meal.notes ? (
              <Text variant="muted" className="mt-1 italic">
                {meal.notes}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function Macro({ label, value }: { label: string; value: number | null }) {
  return (
    <View className="flex-row items-baseline gap-1 rounded-md bg-muted px-2 py-1">
      <Text variant="muted" className="font-sans-medium">
        {label}
      </Text>
      <Text className="font-sans-medium text-sm">{g(value)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------

type Picked = { uri: string; dataUrl: string };

function AddMealModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [description, setDescription] = React.useState('');
  const [image, setImage] = React.useState<Picked | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setDescription('');
    setImage(null);
    setError(null);
  }

  async function pick(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(
        source === 'camera' ? 'Sin permiso para usar la cámara' : 'Sin permiso para ver tus fotos'
      );
      return;
    }
    // Calidad baja a propósito: la foto viaja en base64 dentro del JSON y al modelo
    // le alcanza con mucho menos que la resolución nativa.
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    const mime = asset.mimeType ?? 'image/jpeg';
    setImage({ uri: asset.uri, dataUrl: `data:${mime};base64,${asset.base64}` });
    setError(null);
  }

  async function submit() {
    if (busy || (!description.trim() && !image)) return;
    setBusy(true);
    setError(null);
    try {
      await analyzeMeal({ description: description.trim() || undefined, image: image?.dataUrl });
      reset();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && (description.trim().length > 0 || image !== null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text variant="h4">Agregar comida</Text>
          <Pressable
            onPress={onClose}
            disabled={busy}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-accent">
            <Icon as={X} size={20} />
          </Pressable>
        </View>

        <View className="flex-1 gap-4 px-4 pt-4">
          {image ? (
            <View className="relative">
              <Image
                source={{ uri: image.uri }}
                className="h-56 w-full rounded-xl bg-muted"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setImage(null)}
                disabled={busy}
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-background/90">
                <Icon as={X} size={16} />
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <PickButton
                icon={Camera}
                label="Sacar foto"
                onPress={() => pick('camera')}
                disabled={busy}
              />
              <PickButton
                icon={ImagePlus}
                label="Subir foto"
                onPress={() => pick('library')}
                disabled={busy}
              />
            </View>
          )}

          <TextInput
            className="min-h-24 rounded-xl border border-input bg-background px-4 py-3 font-sans text-base text-foreground placeholder:text-muted-foreground"
            placeholder="Describí la comida: qué es, cuánto, cómo está hecha… (opcional si hay foto)"
            value={description}
            onChangeText={setDescription}
            multiline
            editable={!busy}
            textAlignVertical="top"
          />

          {error ? <Text className="text-destructive">{error}</Text> : null}

          {busy ? (
            <View className="flex-row items-center gap-2 self-start rounded-2xl bg-muted px-4 py-3">
              <ActivityIndicator size="small" />
              <Text variant="muted">Estimando calorías y macros…</Text>
            </View>
          ) : null}
        </View>

        <View className="px-4 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:bg-primary/90 disabled:opacity-50">
            <Icon as={Sparkles} size={18} className="text-primary-foreground" />
            <Text className="font-sans-semibold text-primary-foreground">Registrar con IA</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PickButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-6 active:bg-accent disabled:opacity-50">
      <Icon as={icon} size={24} className="text-muted-foreground" />
      <Text variant="muted">{label}</Text>
    </Pressable>
  );
}
