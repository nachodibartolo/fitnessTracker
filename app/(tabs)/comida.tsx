import { AddEntrySheet, type EntryField, type EntryValues } from '@/components/ui/add-entry-sheet';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  analyzeMeal,
  createMeal,
  deleteMeal,
  getMe,
  getMeals,
  getRecentMeals,
  type Me,
  type Meal,
  type MealInput,
  type MealsDay,
  type MealsGroup,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { Camera, ImagePlus, Sparkles, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
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
const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

const MANUAL_FIELDS: EntryField[] = [
  { key: 'name', label: 'Qué comiste', type: 'text', placeholder: 'Milanesa con puré' },
  { key: 'calories', label: 'Calorías', type: 'number', unit: 'kcal', optional: true },
  { key: 'proteinG', label: 'Proteína', type: 'number', unit: 'g', optional: true },
  { key: 'fatG', label: 'Grasas', type: 'number', unit: 'g', optional: true },
  { key: 'carbsG', label: 'Carbs', type: 'number', unit: 'g', optional: true },
];

export default function ComidaScreen() {
  const [day, setDay] = React.useState<MealsDay | null>(null);
  const [history, setHistory] = React.useState<MealsGroup[]>([]);
  const [me, setMe] = React.useState<Me | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [addingAi, setAddingAi] = React.useState(false);
  const [addingManual, setAddingManual] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [d, h] = await Promise.all([getMeals(), getRecentMeals(8)]);
      setDay(d);
      setHistory(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      getMe()
        .then(setMe)
        .catch(() => {});
    }, [])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function chooseHow() {
    Alert.alert('Agregar comida', '¿Cómo la querés cargar?', [
      { text: 'Manual', onPress: () => setAddingManual(true) },
      { text: 'Con IA', onPress: () => setAddingAi(true) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleManualSave(values: EntryValues) {
    setSaving(true);
    setSaveError(null);
    try {
      const input: MealInput = { name: String(values.name) };
      if (values.calories !== undefined) input.calories = Number(values.calories);
      if (values.proteinG !== undefined) input.proteinG = Number(values.proteinG);
      if (values.fatG !== undefined) input.fatG = Number(values.fatG);
      if (values.carbsG !== undefined) input.carbsG = Number(values.carbsG);
      await createMeal(input);
      setAddingManual(false);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
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

  const sections = [
    { title: 'Hoy', data: day?.meals ?? [] },
    ...history.map((g) => ({ title: fecha(g.date), data: g.meals })),
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Comida" onAdd={chooseHow} />
      <SectionList
        sections={sections}
        keyExtractor={(m) => m.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="gap-3 px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="mb-1 gap-4">
            <Totals day={day} me={me} />
            {error ? <Text className="text-destructive">Error: {error}</Text> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="h4" className="mt-2 capitalize">
            {section.title}
          </Text>
        )}
        renderSectionFooter={({ section }) => {
          if (section.title !== 'Hoy' || section.data.length > 0) return null;
          if (day === null && !error) {
            return (
              <View className="gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </View>
            );
          }
          return <Text variant="muted">Todavía no registraste comidas hoy.</Text>;
        }}
        renderItem={({ item }) => <MealRow meal={item} onLongPress={() => confirmDelete(item)} />}
      />

      <AddEntrySheet
        visible={addingManual}
        title="Comida manual"
        fields={MANUAL_FIELDS}
        saving={saving}
        error={saveError}
        onSave={handleManualSave}
        onClose={() => setAddingManual(false)}
      />

      <AddMealModal
        visible={addingAi}
        onClose={() => setAddingAi(false)}
        onSaved={() => {
          setAddingAi(false);
          load();
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------

function Totals({ day, me }: { day: MealsDay | null; me: Me | null }) {
  const t = day?.totals;
  const kcalTarget = me?.dailyKcalTarget ?? null;
  const proteinTarget = me?.dailyProteinTarget ?? null;
  const hasTargets = kcalTarget !== null || proteinTarget !== null;
  const cells: { label: string; value: string; target: string | null }[] = [
    {
      label: 'Calorías',
      value: t ? kcal(t.calories) : '',
      target: kcalTarget === null ? null : `/ ${kcal(kcalTarget)}`,
    },
    {
      label: 'Proteína',
      value: t ? g(t.proteinG) : '',
      target: proteinTarget === null ? null : `/ ${g(proteinTarget)}`,
    },
    { label: 'Carbs', value: t ? g(t.carbsG) : '', target: null },
    { label: 'Grasas', value: t ? g(t.fatG) : '', target: null },
  ];
  return (
    <Card className="flex-row gap-0 px-2 py-4">
      {cells.map((c, i) => (
        <View
          key={c.label}
          className={cn('flex-1 items-center gap-1', i > 0 && 'border-l border-border')}>
          <Text variant="muted">{c.label}</Text>
          <View className="h-8 justify-center">
            {t ? (
              <Text className={cn('font-sans-semibold', i === 0 ? 'text-2xl' : 'text-xl')}>
                {c.value}
              </Text>
            ) : (
              <Skeleton className="h-7 w-14" />
            )}
          </View>
          {hasTargets && (
            <Text variant="muted" className="text-xs">
              {c.target ?? ' '}
            </Text>
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
