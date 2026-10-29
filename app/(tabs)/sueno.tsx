import { LineChart } from '@/components/charts/line-chart';
import { StackedBarChart } from '@/components/charts/stacked-bar-chart';
import { StatTile } from '@/components/charts/stat-tile';
import { AddEntrySheet, type EntryField, type EntryValues } from '@/components/ui/add-entry-sheet';
import { RangeChips } from '@/components/ui/range-chips';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { getHealthDays, todayIso, updateHealthDay, type DailyHealthSummary } from '@/lib/api';
import { THEME } from '@/lib/theme';
import { compareWeeks, shiftDate } from '@/lib/weekly-stats';
import { useColorScheme } from 'nativewind';
import { useHealthSync } from '@/lib/health-sync-context';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

const hours = (min: number | null) => (min === null ? null : min / 60);

function hoursSinceNoonBefore(iso: string, date: string) {
   const noon = new Date(`${date}T12:00:00`);
   noon.setDate(noon.getDate() - 1);
   return (new Date(iso).getTime() - noon.getTime()) / 3600000;
}

function formatClock(value: number) {
   const totalMin = Math.round(((value + 12) % 24) * 60);
   const hh = Math.floor(totalMin / 60) % 24;
   const mm = totalMin % 60;
   const suffix = hh < 12 ? 'am' : 'pm';
   const hh12 = hh % 12 === 0 ? 12 : hh % 12;
   return `${hh12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

const FIELDS: EntryField[] = [
   { key: 'sleepHours', label: 'Horas dormidas', type: 'number', unit: 'h', placeholder: '7.5' },
];

export default function SuenoScreen() {
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
         const sleepAsleepMin = Math.round(Number(values.sleepHours) * 60);
         await updateHealthDay(todayIso(), { sleepAsleepMin });
         setAdding(false);
         load();
      } catch (e) {
         setSaveError((e as Error).message);
      } finally {
         setSaving(false);
      }
   }

   const asleep = days && compareWeeks(days, (d) => hours(d.sleepAsleepMin));
   const deep = days && compareWeeks(days, (d) => hours(d.sleepDeepMin));
   const rem = days && compareWeeks(days, (d) => hours(d.sleepRemMin));
   const inBed = days && compareWeeks(days, (d) => hours(d.sleepInBedMin));

   const chartFrom = shiftDate(todayIso(), -(rangeDays - 1));
   const chartDays = (days ?? []).filter((d) => d.date >= chartFrom);

   const sleepBars = chartDays
      .filter((d) => d.sleepAsleepMin !== null)
      .map((d) => ({
         date: d.date,
         values: [
            hours(d.sleepDeepMin),
            hours(d.sleepCoreMin),
            hours(d.sleepRemMin),
            hours(d.sleepAwakeMin),
         ],
      }));

   const nights = chartDays.filter((d) => d.sleepStartedAt !== null && d.sleepEndedAt !== null);
   const bedtimePoints = nights.map((d) => ({
      date: d.date,
      value: hoursSinceNoonBefore(d.sleepStartedAt!, d.date),
   }));
   const wakePoints = nights.map((d) => ({
      date: d.date,
      value: hoursSinceNoonBefore(d.sleepEndedAt!, d.date),
   }));

   const dark = colorScheme === 'dark';
   const series = [
      { label: 'Profundo', color: dark ? colors.chart1 : colors.chart5 },
      { label: 'Ligero', color: dark ? colors.chart2 : colors.chart3 },
      { label: 'REM', color: dark ? colors.chart3 : colors.chart1 },
      { label: 'Despierto', color: colors.mutedForeground, hollow: true },
   ];

   return (
      <View className="flex-1 bg-background">
         <ScreenHeader title="Sueño" onAdd={() => setAdding(true)} />
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
                        <StatTile
                           label="Dormido"
                           unit="h"
                           stats={asleep}
                           deltaMode="absolute"
                           decimals={1}
                        />
                        <StatTile
                           label="En cama"
                           unit="h"
                           stats={inBed}
                           deltaMode="absolute"
                           decimals={1}
                        />
                     </View>
                     <View className="flex-row gap-3">
                        <StatTile
                           label="Profundo"
                           unit="h"
                           stats={deep}
                           deltaMode="absolute"
                           decimals={1}
                        />
                        <StatTile
                           label="REM"
                           unit="h"
                           stats={rem}
                           deltaMode="absolute"
                           decimals={1}
                        />
                     </View>
                  </View>

                  <StackedBarChart
                     title="Etapas de sueño"
                     unit="h"
                     decimals={1}
                     series={series}
                     data={sleepBars}
                  />

                  <LineChart
                     title="Horarios de sueño"
                     unit=""
                     data={bedtimePoints}
                     secondary={wakePoints}
                     format={formatClock}
                     labelWidth={56}
                  />
               </>
            )}
         </ScrollView>

         <AddEntrySheet
            visible={adding}
            title="Sueño de anoche"
            fields={FIELDS}
            saving={saving}
            error={saveError}
            onSave={handleSave}
            onClose={() => setAdding(false)}
         />
      </View>
   );
}
