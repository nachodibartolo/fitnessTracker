import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { dateToMs, formatDayMonth, niceTicks, scaleLinear } from '@/lib/chart-scale';
import { FONTS, THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

const CHART_HEIGHT = 180;
const MARGIN = { top: 8, right: 8, bottom: 22, left: 36 };
const LABEL_SIZE = 10;
const BAR_GAP = 2;
const SEGMENT_GAP = 2;
const RADIUS = 3;

export type StackedSeries = {
   label: string;
   color: string;
   hollow?: boolean;
};

export type StackedBar = {
   date: string;
   values: (number | null)[];
};

type Props = {
   title: string;
   unit: string;
   series: StackedSeries[];
   data: StackedBar[];
   decimals?: number;
};

type Segment = { x: number; y: number; width: number; height: number; series: number };

type Geom = {
   plot: { left: number; right: number; top: number; bottom: number };
   bars: { px: number; width: number; total: number; segments: Segment[]; bar: StackedBar }[];
   yTicks: { value: number; py: number }[];
   xTicks: { label: string; px: number; anchor: 'start' | 'middle' | 'end' }[];
};

function total(bar: StackedBar) {
   return bar.values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function buildGeom(data: StackedBar[], width: number): Geom | null {
   if (width === 0 || data.length === 0) return null;

   const plot = {
      left: MARGIN.left,
      right: width - MARGIN.right,
      top: MARGIN.top,
      bottom: CHART_HEIGHT - MARGIN.bottom,
   };

   const maxTotal = Math.max(...data.map(total), 0);
   const yTicksRaw = niceTicks(0, maxTotal, 4);
   const yMax = Math.max(maxTotal, yTicksRaw[yTicksRaw.length - 1] ?? 0) || 1;
   const y = scaleLinear([0, yMax], [plot.bottom, plot.top]);

   const slot = (plot.right - plot.left) / data.length;
   const barWidth = Math.max(1, slot - BAR_GAP);

   const bars = data.map((bar, i) => {
      const px = plot.left + i * slot + BAR_GAP / 2;
      let cursor = plot.bottom;
      const segments: Segment[] = [];
      bar.values.forEach((v, s) => {
         if (!v || v <= 0) return;
         const h = plot.bottom - y(v);
         const yTop = cursor - h;
         const gap = segments.length > 0 ? SEGMENT_GAP : 0;
         segments.push({ x: px, y: yTop + gap, width: barWidth, height: Math.max(0, h - gap), series: s });
         cursor = yTop;
      });
      return { px, width: barWidth, total: total(bar), segments, bar };
   });

   const labelIdx = Array.from(new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]));
   const xTicks = labelIdx.map((i) => ({
      label: formatDayMonth(dateToMs(data[i].date)),
      px: bars[i].px + barWidth / 2,
      anchor: (i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
   }));

   return {
      plot,
      bars,
      yTicks: yTicksRaw.map((value) => ({ value, py: y(value) })),
      xTicks,
   };
}

function nearestIndex(bars: Geom['bars'], touchX: number): number {
   let best = 0;
   for (let i = 1; i < bars.length; i++) {
      const c = bars[i].px + bars[i].width / 2;
      const b = bars[best].px + bars[best].width / 2;
      if (Math.abs(c - touchX) < Math.abs(b - touchX)) best = i;
   }
   return best;
}

export function StackedBarChart({ title, unit, series, data, decimals = 1 }: Props) {
   const [width, setWidth] = useState(0);
   const [active, setActive] = useState<number | null>(null);
   const { colorScheme } = useColorScheme();
   const colors = THEME[colorScheme ?? 'light'];

   const geom = buildGeom(data, width);
   const shownIdx = geom ? (active !== null && active < geom.bars.length ? active : geom.bars.length - 1) : null;
   const shown = geom && shownIdx !== null ? geom.bars[shownIdx] : undefined;

   function handleTouch(e: GestureResponderEvent) {
      if (geom) setActive(nearestIndex(geom.bars, e.nativeEvent.locationX));
   }

   return (
      <Card className="w-full">
         <CardHeader>
            <CardTitle>{title}</CardTitle>
            <View className="flex-row items-baseline gap-1.5">
               <Text className="font-sans-semibold text-2xl">
                  {shown ? shown.total.toFixed(decimals) : '—'}
               </Text>
               <Text variant="muted">{unit}</Text>
               {shown && <Text variant="muted">· {formatDayMonth(dateToMs(shown.bar.date))}</Text>}
            </View>
         </CardHeader>

         <CardContent className="gap-3">
            <View
               onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
               onStartShouldSetResponder={() => true}
               onMoveShouldSetResponder={() => true}
               onResponderGrant={handleTouch}
               onResponderMove={handleTouch}
               onResponderRelease={() => setActive(null)}
               onResponderTerminate={() => setActive(null)}
               onResponderTerminationRequest={() => false}
               style={{ height: CHART_HEIGHT }}>
               {geom && (
                  <Svg width={width} height={CHART_HEIGHT} pointerEvents="none">
                     {geom.yTicks.map((t) => (
                        <G key={t.value}>
                           <Line
                              x1={geom.plot.left}
                              x2={geom.plot.right}
                              y1={t.py}
                              y2={t.py}
                              stroke={colors.border}
                              strokeWidth={1}
                           />
                           <SvgText
                              x={geom.plot.left - 6}
                              y={t.py + LABEL_SIZE / 3}
                              fill={colors.mutedForeground}
                              fontSize={LABEL_SIZE}
                              fontFamily={FONTS.sans}
                              textAnchor="end">
                              {t.value.toFixed(0)}
                           </SvgText>
                        </G>
                     ))}

                     {geom.bars.map((b, i) => (
                        <G key={b.bar.date} opacity={active !== null && active !== i ? 0.45 : 1}>
                           {b.segments.map((s) => {
                              const def = series[s.series];
                              return (
                                 <Rect
                                    key={s.series}
                                    x={s.x}
                                    y={s.y}
                                    width={s.width}
                                    height={s.height}
                                    rx={Math.min(RADIUS, s.width / 2)}
                                    fill={def.hollow ? colors.card : def.color}
                                    stroke={def.hollow ? def.color : undefined}
                                    strokeWidth={def.hollow ? 1 : 0}
                                 />
                              );
                           })}
                        </G>
                     ))}

                     {geom.xTicks.map((t) => (
                        <SvgText
                           key={t.label}
                           x={t.px}
                           y={CHART_HEIGHT - 7}
                           fill={colors.mutedForeground}
                           fontSize={LABEL_SIZE}
                           fontFamily={FONTS.sans}
                           textAnchor={t.anchor}>
                           {t.label}
                        </SvgText>
                     ))}
                  </Svg>
               )}
            </View>

            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
               {series.map((s, i) => {
                  const v = shown?.bar.values[i];
                  return (
                     <View key={s.label} className="flex-row items-center gap-1.5">
                        <View
                           style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              backgroundColor: s.hollow ? colors.card : s.color,
                              borderWidth: s.hollow ? 1 : 0,
                              borderColor: s.color,
                           }}
                        />
                        <Text variant="muted" className="text-xs">
                           {s.label}
                           {v !== null && v !== undefined ? ` ${v.toFixed(decimals)}` : ''}
                        </Text>
                     </View>
                  );
               })}
            </View>
         </CardContent>
      </Card>
   );
}
