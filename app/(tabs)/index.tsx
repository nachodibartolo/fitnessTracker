import { LineChart } from '@/components/charts/line-chart';
import { StatTile } from '@/components/charts/stat-tile';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { getHealthDays, type DailyHealthSummary } from '@/lib/api';
import { compareWeeks } from '@/lib/weekly-stats';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

const formatInt = (v: number) => Math.round(v).toLocaleString('es-AR');

export default function Dashboard() {
  const [days, setDays] = useState<DailyHealthSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealthDays('2026-06-01')
      .then(setDays)
      .catch((e) => setError(e.message));
  }, []);

  // Saca los días sin pesaje y traduce al formato del gráfico.
  const weightPoints = (days ?? []).flatMap((d) =>
    d.weightKg === null ? [] : [{ date: d.date, value: d.weightKg }]
  );

  // Promedio de los últimos 7 días con dato vs. los 7 anteriores. `null` = cargando.
  const weight = days && compareWeeks(days, (d) => d.weightKg);
  const sleep =
    days && compareWeeks(days, (d) => (d.sleepAsleepMin === null ? null : d.sleepAsleepMin / 60));
  const steps = days && compareWeeks(days, (d) => d.steps);
  const energy = days && compareWeeks(days, (d) => d.activeEnergyKcal);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Dashboard" />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 py-4">
        {error ? (
          <Text>Error: {error}</Text>
        ) : (
          <>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <StatTile label="Peso" unit="kg" stats={weight} deltaMode="absolute" decimals={1} />
                <StatTile label="Sueño" unit="h" stats={sleep} deltaMode="absolute" decimals={1} />
              </View>
              <View className="flex-row gap-3">
                <StatTile
                  label="Pasos"
                  unit=""
                  stats={steps}
                  deltaMode="percent"
                  format={formatInt}
                />
                <StatTile
                  label="Energía activa"
                  unit="kcal"
                  stats={energy}
                  deltaMode="percent"
                  format={formatInt}
                />
              </View>
            </View>

            <LineChart title="Peso" data={weightPoints} unit="kg" />
          </>
        )}
      </ScrollView>
    </View>
  );
}
