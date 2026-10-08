/**
 * Escalas para los gráficos del dashboard. Son funciones puras: no saben nada
 * de React ni de SVG, solo traducen números. Las comparten todos los gráficos.
 */

/** El [min, max] de una lista de valores. */
export function extent(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

/** Agranda un dominio en `pad` de cada lado, para que la línea no toque los bordes. */
export function padDomain([min, max]: [number, number], pad: number): [number, number] {
  return [min - pad, max + pad];
}

/**
 * Devuelve una función que mapea un valor del dominio a un píxel del rango.
 *
 * Para el eje Y se pasa el rango invertido ([abajo, arriba]), porque en SVG
 * el y=0 está arriba: así un valor más alto da un píxel más chico.
 */
export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  return (value: number) => {
    // Dominio de ancho cero (un solo dato, o todos iguales): al medio del rango.
    if (span === 0) return (r0 + r1) / 2;
    return r0 + ((value - d0) / span) * (r1 - r0);
  };
}

/** `2026-09-04` -> milisegundos, para poder escalar fechas como números. */
export function dateToMs(date: string): number {
  return new Date(date).getTime();
}

/**
 * Valores "redondos" para los labels del eje Y. Elige un paso de la familia
 * 1/2/2.5/5/10 escalada a la magnitud del dominio, así los labels caen en
 * números legibles (72, 73, 74) en vez de los bordes crudos (71.2, 74.9).
 */
export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (span === 0 || count < 1) return [min];

  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? 10 * mag;

  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    // Reencuadra en el paso para que no se acumule el error de punto flotante.
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

/** `count` valores repartidos parejo entre min y max, incluyendo los extremos. */
export function spreadTicks(min: number, max: number, count: number): number[] {
  if (count < 2 || min === max) return [min];
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * `1698796800000` -> `"1 nov"`. Usa los getters UTC a propósito: las fechas
 * vienen como `YYYY-MM-DD`, que `new Date()` parsea como medianoche UTC, y con
 * los getters locales (UTC-3) el día se correría uno para atrás.
 */
export function formatDayMonth(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
