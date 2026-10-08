/**
 * Rango [inicio, fin) de un día calendario en una zona horaria IANA,
 * expresado en instantes UTC. Sin librerías: se calcula el offset de la
 * zona para esa fecha con Intl y se corrige la medianoche UTC.
 */
export function dayRangeInTz(isoDate: string, timeZone: string): { from: Date; to: Date } {
  const utcMidnight = new Date(`${isoDate}T00:00:00.000Z`);
  const offsetMs = tzOffsetMs(utcMidnight, timeZone);
  // Medianoche local = medianoche UTC menos el offset de la zona.
  const from = new Date(utcMidnight.getTime() - offsetMs);
  // El offset puede cambiar dentro del día (DST): se recalcula para el fin.
  const nextUtcMidnight = new Date(utcMidnight.getTime() + 86_400_000);
  const to = new Date(nextUtcMidnight.getTime() - tzOffsetMs(nextUtcMidnight, timeZone));
  return { from, to };
}

/** Offset (ms) de `timeZone` respecto a UTC en el instante `at`. Positivo al este de Greenwich. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - at.getTime();
}

/** Fecha YYYY-MM-DD de "hoy" en la zona horaria dada. */
export function todayInTz(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}
