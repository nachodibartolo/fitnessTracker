import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  dateToMs,
  extent,
  formatDayMonth,
  niceTicks,
  padDomain,
  scaleLinear,
  spreadTicks,
} from '@/lib/chart-scale';
import { FONTS, THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

const CHART_HEIGHT = 180;
/** Espacio para los labels de los ejes, fuera del área de dibujo. */
const MARGIN = { top: 8, right: 8, bottom: 22, left: 36 };
const LABEL_SIZE = 10;

/** La serie que recibe el gráfico: fechas y números, nada del schema de Health. */
export type ChartPoint = { date: string; value: number };

type Props = {
  title: string;
  data: ChartPoint[];
  secondary?: ChartPoint[];
  /** Unidad para el label del header ("kg", "pasos"). */
  unit: string;
  /** Cuánto agrandar el dominio Y de cada lado, en unidades del dato. */
  pad?: number;
  decimals?: number;
  format?: (value: number) => string;
  labelWidth?: number;
};

type Geom = {
  plot: { left: number; right: number; top: number; bottom: number };
  pts: { px: number; py: number; p: ChartPoint }[];
  pts2: { px: number; py: number; p: ChartPoint }[];
  yTicks: { value: number; py: number }[];
  xTicks: { ms: number; px: number }[];
};

/** Toda la geometría del gráfico en píxeles. `null` hasta que haya ancho y datos. */
function buildGeom(
  data: ChartPoint[],
  secondary: ChartPoint[],
  width: number,
  pad: number,
  labelWidth: number
): Geom | null {
  if (width === 0 || data.length === 0) return null;

  const plot = {
    left: labelWidth,
    right: width - MARGIN.right,
    top: MARGIN.top,
    bottom: CHART_HEIGHT - MARGIN.bottom,
  };

  const msValues = data.map((d) => dateToMs(d.date));
  const xDomain = extent(msValues);
  const allValues = [...data, ...secondary].map((d) => d.value);
  const yDomain = padDomain(extent(allValues), pad);

  const x = scaleLinear(xDomain, [plot.left, plot.right]);
  // Rango invertido: en SVG el y=0 está arriba.
  const y = scaleLinear(yDomain, [plot.bottom, plot.top]);

  return {
    plot,
    pts: data.map((p, i) => ({ px: x(msValues[i]), py: y(p.value), p })),
    pts2: secondary.map((p) => ({ px: x(dateToMs(p.date)), py: y(p.value), p })),
    yTicks: niceTicks(yDomain[0], yDomain[1], 4).map((value) => ({ value, py: y(value) })),
    xTicks: spreadTicks(xDomain[0], xDomain[1], 4).map((ms) => ({ ms, px: x(ms) })),
  };
}

const HALF_WINDOW_MS = 3.5 * 24 * 60 * 60 * 1000;

function movingAverage(pts: Geom['pts']): { px: number; py: number }[] {
  const msValues = pts.map((pt) => dateToMs(pt.p.date));
  const result: { px: number; py: number }[] = [];

  for (let i = 0; i < pts.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < pts.length; j++) {
      if (Math.abs(msValues[j] - msValues[i]) <= HALF_WINDOW_MS) {
        sum += pts[j].py;
        count += 1;
      }
    }
    result.push({ px: pts[i].px, py: sum / count });
  }
  return result;
}

/** Índice del punto más cercano al dedo, en píxeles. */
function nearestIndex(pts: Geom['pts'], touchX: number): number {
  let best = 0;
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].px - touchX) < Math.abs(pts[best].px - touchX)) best = i;
  }
  return best;
}

export function LineChart({
  title,
  data,
  secondary = [],
  unit,
  pad = 0.5,
  decimals = 1,
  format = (v) => v.toFixed(decimals),
  labelWidth = MARGIN.left,
}: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  const geom = buildGeom(data, secondary, width, pad, labelWidth);
  const trend = geom ? movingAverage(geom.pts) : [];
  const trend2 = geom ? movingAverage(geom.pts2) : [];

  const shown = geom
    ? geom.pts[active !== null && active < geom.pts.length ? active : geom.pts.length - 1]
    : undefined;
  const shown2 = shown && geom ? geom.pts2.find((pt) => pt.p.date === shown.p.date) : undefined;

  function handleTouch(e: GestureResponderEvent) {
    if (geom) setActive(nearestIndex(geom.pts, e.nativeEvent.locationX));
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <View className="flex-row items-baseline gap-1.5">
          <Text className="font-sans-semibold text-2xl">
            {shown ? format(shown.p.value) : '—'}
            {shown2 ? ` – ${format(shown2.p.value)}` : ''}
          </Text>
          <Text variant="muted">{unit}</Text>
          {shown && <Text variant="muted">· {formatDayMonth(dateToMs(shown.p.date))}</Text>}
        </View>
      </CardHeader>

      <CardContent>
        {}
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
                    {format(t.value)}
                  </SvgText>
                </G>
              ))}

              {geom.xTicks.map((t, i) => (
                <SvgText
                  key={t.ms}
                  x={t.px}
                  y={CHART_HEIGHT - 7}
                  fill={colors.mutedForeground}
                  fontSize={LABEL_SIZE}
                  fontFamily={FONTS.sans}
                  textAnchor={i === 0 ? 'start' : i === geom.xTicks.length - 1 ? 'end' : 'middle'}>
                  {formatDayMonth(t.ms)}
                </SvgText>
              ))}

              <Polyline
                points={geom.pts.map((pt) => `${pt.px},${pt.py}`).join(' ')}
                fill="none"
                stroke={colors.primary}
                strokeWidth={1.5}
              />

              {geom.pts2.length > 1 && (
                <Polyline
                  points={geom.pts2.map((pt) => `${pt.px},${pt.py}`).join(' ')}
                  fill="none"
                  stroke={colors.chart2}
                  strokeWidth={1.5}
                />
              )}

              {trend.length > 1 && (
                <Polyline
                  points={trend.map((t) => `${t.px},${t.py}`).join(' ')}
                  fill="none"
                  stroke={colors.destructive}
                  strokeOpacity={0.85}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                />
              )}

              {trend2.length > 1 && (
                <Polyline
                  points={trend2.map((t) => `${t.px},${t.py}`).join(' ')}
                  fill="none"
                  stroke={colors.destructive}
                  strokeOpacity={0.85}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                />
              )}

              {active !== null && shown && (
                <G>
                  <Line
                    x1={shown.px}
                    x2={shown.px}
                    y1={geom.plot.top}
                    y2={geom.plot.bottom}
                    stroke={colors.mutedForeground}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <Circle
                    cx={shown.px}
                    cy={shown.py}
                    r={4}
                    fill={colors.primary}
                    stroke={colors.card}
                    strokeWidth={2}
                  />
                  {shown2 && (
                    <Circle
                      cx={shown2.px}
                      cy={shown2.py}
                      r={4}
                      fill={colors.chart2}
                      stroke={colors.card}
                      strokeWidth={2}
                    />
                  )}
                </G>
              )}
            </Svg>
          )}
        </View>
      </CardContent>
    </Card>
  );
}
