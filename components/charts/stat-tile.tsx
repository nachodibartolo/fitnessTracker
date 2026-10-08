import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import type { WeeklyComparison } from '@/lib/weekly-stats';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react-native';
import { View } from 'react-native';

type Props = {
  label: string;
  unit: string;
  stats: WeeklyComparison | null;
  deltaMode: 'percent' | 'absolute';
  decimals?: number;
  format?: (value: number) => string;
};

function formatDelta(stats: WeeklyComparison, mode: Props['deltaMode'], decimals: number) {
  const value = mode === 'percent' ? stats.deltaPct : stats.delta;
  if (value === null) return null;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  return mode === 'percent' ? `${sign}${(abs * 100).toFixed(0)}%` : `${sign}${abs.toFixed(decimals)}`;
}

export function StatTile({ label, unit, stats, deltaMode, decimals = 1, format }: Props) {
  const delta = stats ? formatDelta(stats, deltaMode, decimals) : null;
  const trend = stats?.delta === null || stats?.delta === undefined ? null : Math.sign(stats.delta);
  const TrendIcon = trend === 1 ? ArrowUpRight : trend === -1 ? ArrowDownRight : Minus;

  return (
    <Card className="flex-1 gap-2 px-4 py-4">
      <Text variant="muted">{label}</Text>

      {stats === null ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <View className="flex-row items-baseline gap-1">
          <Text className="font-sans-semibold text-2xl">
            {stats.current === null
              ? '—'
              : format
                ? format(stats.current)
                : stats.current.toFixed(decimals)}
          </Text>
          <Text variant="muted">{unit}</Text>
        </View>
      )}

      {stats === null ? (
        <Skeleton className="h-4 w-28" />
      ) : delta === null ? (
        <Text variant="muted">Sin semana previa</Text>
      ) : (
        <View className="flex-row items-center gap-1">
          <Icon as={TrendIcon} size={14} className="text-muted-foreground" />
          <Text variant="muted">
            <Text className="text-sm font-sans-medium">{delta}</Text> vs. semana anterior
          </Text>
        </View>
      )}
    </Card>
  );
}
