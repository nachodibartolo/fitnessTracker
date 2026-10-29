import { LineChart } from '@/components/charts/line-chart';
import { StackedBarChart } from '@/components/charts/stacked-bar-chart';
import { StatTile } from '@/components/charts/stat-tile';
import { AddEntrySheet, type EntryField, type EntryValues } from '@/components/ui/add-entry-sheet';
import { RangeChips } from '@/components/ui/range-chips';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import {
   getHealthDays,
   todayIso,
   updateHealthDay,
   type DailyHealthSummary,
   type HealthDayPatch,
} from '@/lib/api';
import { THEME } from '@/lib/theme';
import { compareWeeks, shiftDate } from '@/lib/weekly-stats';
import { useColorScheme } from 'nativewind';
import { useHealthSync } from '@/lib/health-sync-context';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

const formatInt = (v: number) => Math.round(v).toLocaleString('es-AR');

const FIELDS: EntryField[] = [
   { key: 'weightKg', label: 'Peso', type: 'number', unit: 'kg', placeholder: '76.4' },
   { key: 'bodyFatPct', label: 'Grasa corporal', type: 'number', unit: '%', optional: true, placeholder: '18' },
];

export default function SaludScreen() {
   const [rangeDays, setRangeDays] = useState(30);
   const [days, setDays] = useState<DailyHealthSummary[] | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [adding, setAdding] = useState(false);
   const [saving, setSaving] = useState(false);
   const [saveError, setSaveError] = useState<string | null>(null);
   const { colorScheme } = useColorScheme();
   const colors = THEME[colorScheme ?? 'light'];

   function load() {
      const from = shiftDate(todayIso(), -(Math.max(rangeDays, 14) - 1));
      getHealthDays(from)
         .then(setDays)
         .catch((e) => setError(e.message));
   }

   const { syncedAt } = useHealthSync();

   useEffect(() => {
      load();
   }, [rangeDays, syncedAt]);

   async function handleSave(values: EntryValues) {
      setSaving(true);
      setSaveError(null);
      try {
         const patch: HealthDayPatch = { weightKg: Number(values.weightKg) };
         if (values.bodyFatPct !== undefined) {
            patch.bodyFatPct = Number(values.bodyFatPct) / 100;
         }
         await updateHealthDay(todayIso(), patch);
         setAdding(false);
         load();
      } catch (e) {
         setSaveError((e as Error).message);
      } finally {
         setSaving(false);
      }
   }

   const steps = days && compareWeeks(days, (d) => d.steps);
   const energy = days && compareWeeks(days, (d) => d.activeEnergyKcal);
   const restingHr = days && compareWeeks(days, (d) => d.restingHeartRate);
   const weight = days && compareWeeks(days, (d) => d.weightKg);

   const chartFrom = shiftDate(todayIso(), -(rangeDays - 1));
   const chartDays = (days ?? []).filter((d) => d.date >= chartFrom);

   const energyBars = chartDays
      .filter((d) => d.basalEnergyKcal !== null || d.activeEnergyKcal !== null)
      .map((d) => ({ date: d.date, values: [d.basalEnergyKcal, d.activeEnergyKcal] }));

   const weightPoints = chartDays.flatMap((d) =>
      d.weightKg === null ? [] : [{ date: d.date, value: d.weightKg }]
   );

   const fatPoints = chartDays.flatMap((d) =>
      d.bodyFatPct === null ? [] : [{ date: d.date, value: d.bodyFatPct * 100 }]
   );

   return (
      <View className="flex-1 bg-background">
         <ScreenHeader title="Salud" onAdd={() => setAdding(true)} />
         <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 py-4"
            contentInsetAdjustmentBehavior="automatic">
            {error ? (
               <Text>Error: {error}</Text>
            ) : (
               <>
                  <RangeChips value={rangeDays} onChange={setRangeDays} />
                  <View className="gap-3">
                     <View className="flex-row gap-3">
                        <StatTile label="Pasos" unit="" stats={steps} deltaMode="percent" format={formatInt} />
                        <StatTile
                           label="Energía activa"
                           unit="kcal"
                           stats={energy}
                           deltaMode="percent"
                           format={formatInt}
                        />
                     </View>
                     <View className="flex-row gap-3">
                        <StatTile
                           label="FC en reposo"
                           unit="lpm"
                           stats={restingHr}
                           deltaMode="absolute"
                           decimals={0}
                        />
                        <StatTile label="Peso" unit="kg" stats={weight} deltaMode="absolute" decimals={1} />
                     </View>
                  </View>

                  <LineChart title="Peso" data={weightPoints} unit="kg" />

                  <LineChart title="Grasa corporal" data={fatPoints} unit="%" />

                  <StackedBarChart
                     title="Calorías quemadas"
                     unit="kcal"
                     decimals={0}
                     series={[
                        { label: 'Basal', color: colors.primary },
                        { label: 'Activa', color: colors.chart2 },
                     ]}
                     data={energyBars}
                  />
               </>
            )}
         </ScrollView>

         <AddEntrySheet
            visible={adding}
            title="Medición de hoy"
            fields={FIELDS}
            saving={saving}
            error={saveError}
            onSave={handleSave}
            onClose={() => setAdding(false)}
         />
      </View>
   );
}
