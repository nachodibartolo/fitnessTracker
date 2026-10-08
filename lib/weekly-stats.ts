/**
 * Promedios semanales para los indicadores del dashboard. Funciones puras:
 * reciben la lista de días y devuelven números, sin saber nada de React.
 *
 * Las dos ventanas son los últimos 7 días con datos y los 7 anteriores.
 * Se ancla en el último día que tiene datos (y no en "hoy") porque el export
 * de Apple Health puede estar atrasado: si no, todo daría vacío.
 */

type DayLike = { date: string };

export type WeeklyComparison = {
  /** Promedio de los últimos 7 días. `null` si ninguno tiene dato. */
  current: number | null;
  /** Promedio de los 7 días anteriores a esos. */
  previous: number | null;
  /** current - previous. `null` si falta alguno de los dos. */
  delta: number | null;
  /** delta / previous, en fracción (0.05 = +5%). `null` si no se puede calcular. */
  deltaPct: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Promedio ignorando `null`. `null` si no quedó ningún valor. */
export function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Fecha `YYYY-MM-DD` corrida `offset` días. Trabaja en UTC igual que chart-scale. */
function shiftDate(date: string, offset: number): string {
  return new Date(new Date(date).getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Último día (por fecha) con un valor no nulo en `pick`. */
export function lastDateWithData<T extends DayLike>(
  days: T[],
  pick: (d: T) => number | null
): string | null {
  let last: string | null = null;
  for (const d of days) {
    if (pick(d) !== null && (last === null || d.date > last)) last = d.date;
  }
  return last;
}

/**
 * Compara el promedio de los 7 días que terminan en `anchor` (inclusive)
 * contra el promedio de los 7 anteriores.
 */
export function compareWeeks<T extends DayLike>(
  days: T[],
  pick: (d: T) => number | null,
  anchor: string | null = lastDateWithData(days, pick)
): WeeklyComparison {
  if (anchor === null) return { current: null, previous: null, delta: null, deltaPct: null };

  const curFrom = shiftDate(anchor, -6);
  const prevFrom = shiftDate(anchor, -13);
  const prevTo = shiftDate(anchor, -7);

  const inRange = (from: string, to: string) =>
    days.filter((d) => d.date >= from && d.date <= to).map(pick);

  const current = average(inRange(curFrom, anchor));
  const previous = average(inRange(prevFrom, prevTo));
  const delta = current !== null && previous !== null ? current - previous : null;
  const deltaPct = delta !== null && previous ? delta / previous : null;

  return { current, previous, delta, deltaPct };
}
