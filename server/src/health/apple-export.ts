import { StringDecoder } from 'node:string_decoder';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import type { HealthMetric, WorkoutType } from '../generated/prisma/enums.js';
import type { DayInput, HealthSyncPayload, SampleInput, WorkoutInput } from './sync.schema.js';

/**
 * Parser en streaming del export.xml de Apple Health.
 *
 * Lee el archivo una sola vez, acumula por día y devuelve el mismo payload
 * que va a mandar la app cuando lea HealthKit directo. Lo crudo (FC minuto a
 * minuto, pasos por intervalo, segmentos de sueño) se descarta acá.
 *
 * Reglas:
 * - "Día" = fecha local del startDate. Apple exporta "2026-06-24 00:00:59 -0300"
 *   en hora local del dispositivo, así que son los primeros 10 caracteres.
 * - Métricas acumulativas (pasos, distancia, kcal, pisos): se suman por
 *   fuente y se toma la fuente con el total más alto del día, para no sumar
 *   dos veces lo que reportan reloj y teléfono a la vez.
 * - Sueño: cada segmento va al día en que uno se levanta, con corte a las
 *   18:00 sobre la hora de inicio (lo que empieza después de las 18 cuenta
 *   para el día siguiente; una siesta queda en su día). Es la convención de
 *   Apple. Los minutos por etapa suman todos los segmentos del día; la hora
 *   de acostarse/levantarse sale del bloque de sueño más largo (la noche),
 *   uniendo segmentos separados por menos de 90 minutos.
 * - Si hay <ActivitySummary>, sus kcal activas pisan a las calculadas.
 */

// ---------------------------------------------------------------- fechas

const localDate = (s: string) => s.slice(0, 10);
const localHour = (s: string) => Number(s.slice(11, 13));
/** "2026-06-24 00:00:59 -0300" → Date */
const toDate = (s: string) => new Date(`${s.slice(0, 10)}T${s.slice(11, 19)}${s.slice(20, 23)}:${s.slice(23, 25)}`);
const toMs = (s: string) => toDate(s).getTime();

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Día al que pertenece un segmento de sueño: corte a las 18:00 sobre startDate. */
const sleepDay = (start: string) => (localHour(start) >= 18 ? nextDay(localDate(start)) : localDate(start));

/** Bloque más largo uniendo segmentos con huecos menores a `gapMs`. */
function mainBlock(segs: { s: number; e: number }[], gapMs: number): { s: number; e: number } | null {
  if (segs.length === 0) return null;
  const sorted = [...segs].sort((a, b) => a.s - b.s);
  let best = { ...sorted[0]! };
  let cur = { ...sorted[0]! };
  for (const seg of sorted.slice(1)) {
    if (seg.s - cur.e <= gapMs) cur.e = Math.max(cur.e, seg.e);
    else {
      if (cur.e - cur.s > best.e - best.s) best = cur;
      cur = { ...seg };
    }
  }
  if (cur.e - cur.s > best.e - best.s) best = cur;
  return best;
}

// -------------------------------------------------------------- unidades

type Conv = (v: number, unit: string) => number;
const id: Conv = (v) => v;
const toKg: Conv = (v, u) => (u === 'lb' ? v * 0.45359237 : u === 'g' ? v / 1000 : v);
const toKm: Conv = (v, u) => (u === 'm' ? v / 1000 : u === 'mi' ? v * 1.609344 : u === 'yd' ? v * 0.0009144 : v);
const toKcal: Conv = (v, u) => (u === 'kJ' ? v / 4.184 : u === 'J' ? v / 4184 : u === 'cal' ? v / 1000 : v);
const toCm: Conv = (v, u) => (u === 'm' ? v * 100 : u === 'in' ? v * 2.54 : u === 'ft' ? v * 30.48 : v);
const toFraction: Conv = (v) => (v > 1 ? v / 100 : v);
const toMin: Conv = (v, u) => (u === 'sec' || u === 's' ? v / 60 : u === 'hr' || u === 'h' ? v * 60 : v);

const round = (v: number, decimals = 0) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

// --------------------------------------------------------- tablas de tipos

type CumKey = 'steps' | 'distanceKm' | 'flightsClimbed' | 'activeEnergyKcal' | 'basalEnergyKcal';
const CUMULATIVE: Record<string, { key: CumKey; conv: Conv }> = {
  HKQuantityTypeIdentifierStepCount: { key: 'steps', conv: id },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { key: 'distanceKm', conv: toKm },
  HKQuantityTypeIdentifierFlightsClimbed: { key: 'flightsClimbed', conv: id },
  HKQuantityTypeIdentifierActiveEnergyBurned: { key: 'activeEnergyKcal', conv: toKcal },
  HKQuantityTypeIdentifierBasalEnergyBurned: { key: 'basalEnergyKcal', conv: toKcal },
};

type AvgKey = 'hr' | 'rr' | 'spo2' | 'restingHr' | 'hrv';
const AVERAGED: Record<string, { key: AvgKey; conv: Conv }> = {
  HKQuantityTypeIdentifierHeartRate: { key: 'hr', conv: id },
  HKQuantityTypeIdentifierRespiratoryRate: { key: 'rr', conv: id },
  HKQuantityTypeIdentifierOxygenSaturation: { key: 'spo2', conv: toFraction },
  HKQuantityTypeIdentifierRestingHeartRate: { key: 'restingHr', conv: id },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { key: 'hrv', conv: id },
};

type LastKey = 'weightKg' | 'bodyFatPct' | 'leanBodyMassKg';
const LAST_OF_DAY: Record<string, { key: LastKey; conv: Conv }> = {
  HKQuantityTypeIdentifierBodyMass: { key: 'weightKg', conv: toKg },
  HKQuantityTypeIdentifierBodyFatPercentage: { key: 'bodyFatPct', conv: toFraction },
  HKQuantityTypeIdentifierLeanBodyMass: { key: 'leanBodyMassKg', conv: toKg },
};

/** Métricas puntuales que además suben como HealthSample. */
const SAMPLES: Record<string, { metric: HealthMetric; conv: Conv }> = {
  HKQuantityTypeIdentifierBodyMass: { metric: 'BODY_MASS', conv: toKg },
  HKQuantityTypeIdentifierBodyFatPercentage: { metric: 'BODY_FAT_PERCENTAGE', conv: toFraction },
  HKQuantityTypeIdentifierLeanBodyMass: { metric: 'LEAN_BODY_MASS', conv: toKg },
  HKQuantityTypeIdentifierBodyMassIndex: { metric: 'BODY_MASS_INDEX', conv: id },
  HKQuantityTypeIdentifierHeight: { metric: 'HEIGHT', conv: toCm },
  HKQuantityTypeIdentifierRestingHeartRate: { metric: 'RESTING_HEART_RATE', conv: id },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { metric: 'HEART_RATE_VARIABILITY_SDNN', conv: id },
  HKQuantityTypeIdentifierVO2Max: { metric: 'VO2_MAX', conv: id },
};

type Stage = 'inBed' | 'awake' | 'core' | 'deep' | 'rem' | 'unspecified';
const SLEEP_STAGES: Record<string, Stage> = {
  HKCategoryValueSleepAnalysisInBed: 'inBed',
  HKCategoryValueSleepAnalysisAwake: 'awake',
  HKCategoryValueSleepAnalysisAsleepCore: 'core',
  HKCategoryValueSleepAnalysisAsleepDeep: 'deep',
  HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'unspecified',
  HKCategoryValueSleepAnalysisAsleep: 'unspecified', // exports viejos
};
const ASLEEP: Stage[] = ['core', 'deep', 'rem', 'unspecified'];

const WORKOUT_TYPES: Record<string, WorkoutType> = {
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'TRADITIONAL_STRENGTH_TRAINING',
  HKWorkoutActivityTypeFunctionalStrengthTraining: 'FUNCTIONAL_STRENGTH_TRAINING',
  HKWorkoutActivityTypeRunning: 'RUNNING',
  HKWorkoutActivityTypeWalking: 'WALKING',
  HKWorkoutActivityTypeCycling: 'CYCLING',
  HKWorkoutActivityTypeStairClimbing: 'STAIR_CLIMBING',
  HKWorkoutActivityTypeSwimming: 'SWIMMING',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'HIIT',
};

// ------------------------------------------------------------ acumuladores

type Avg = { sum: number; n: number; min: number; max: number };
const avgOf = (a?: Avg) => (a && a.n ? a.sum / a.n : null);

type DayAgg = {
  sums: Partial<Record<CumKey, Map<string, number>>>;
  avg: Partial<Record<AvgKey, Avg>>;
  last: Partial<Record<LastKey, { t: number; v: number }>>;
  sleep: { keys: Set<string>; min: Record<Stage, number>; segs: { s: number; e: number }[] };
  activity: { activeKcal?: number; goalKcal?: number; exerciseMin?: number; exerciseGoal?: number; standHours?: number; standGoal?: number } | null;
  workoutCount: number;
  workoutMin: number;
};

const newDay = (): DayAgg => ({
  sums: {},
  avg: {},
  last: {},
  sleep: { keys: new Set(), min: { inBed: 0, awake: 0, core: 0, deep: 0, rem: 0, unspecified: 0 }, segs: [] },
  activity: null,
  workoutCount: 0,
  workoutMin: 0,
});

export type ParseStats = {
  recordsSeen: number;
  recordsUsed: number;
  ignoredTypes: Record<string, number>;
  days: number;
  workouts: number;
  samples: number;
  ms: number;
};

type PendingWorkout = WorkoutInput & { hasHr: boolean };

export async function parseAppleExport(
  input: AsyncIterable<string | Buffer>,
): Promise<{ payload: HealthSyncPayload; stats: ParseStats }> {
  const t0 = Date.now();
  const days = new Map<string, DayAgg>();
  const day = (d: string) => {
    let agg = days.get(d);
    if (!agg) days.set(d, (agg = newDay()));
    return agg;
  };

  const samples: SampleInput[] = [];
  const sampleKeys = new Set<string>();
  const workouts: PendingWorkout[] = [];
  let current: PendingWorkout | null = null;

  // FC cruda, solo en memoria, para calcular FC promedio/máx por workout.
  const hrTimes: number[] = [];
  const hrValues: number[] = [];

  const stats: ParseStats = { recordsSeen: 0, recordsUsed: 0, ignoredTypes: {}, days: 0, workouts: 0, samples: 0, ms: 0 };

  function onRecord(a: Record<string, string>) {
    stats.recordsSeen++;
    const type = a.type ?? '';
    const start = a.startDate ?? '';
    const end = a.endDate ?? start;
    const source = a.sourceName ?? '';
    const unit = a.unit ?? '';
    let used = false;

    const stage = SLEEP_STAGES[a.value ?? ''];
    if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && stage) {
      const key = `${start}|${end}|${stage}`;
      const s = day(sleepDay(start)).sleep;
      if (!s.keys.has(key)) {
        s.keys.add(key);
        const startMs = toMs(start);
        const endMs = toMs(end);
        s.min[stage] += (endMs - startMs) / 60000;
        // Para ubicar la noche: dormido + despierto (no InBed, que abarca todo).
        if (stage !== 'inBed') s.segs.push({ s: startMs, e: endMs });
      }
      stats.recordsUsed++;
      return;
    }

    const value = Number(a.value);
    if (!Number.isFinite(value)) {
      stats.ignoredTypes[type] = (stats.ignoredTypes[type] ?? 0) + 1;
      return;
    }
    const d = localDate(start);

    const cum = CUMULATIVE[type];
    if (cum) {
      const agg = day(d);
      const bySource = (agg.sums[cum.key] ??= new Map());
      bySource.set(source, (bySource.get(source) ?? 0) + cum.conv(value, unit));
      used = true;
    }

    const av = AVERAGED[type];
    if (av) {
      const v = av.conv(value, unit);
      const agg = day(d);
      const cur = (agg.avg[av.key] ??= { sum: 0, n: 0, min: Infinity, max: -Infinity });
      cur.sum += v;
      cur.n++;
      if (v < cur.min) cur.min = v;
      if (v > cur.max) cur.max = v;
      if (av.key === 'hr') {
        hrTimes.push(toMs(start));
        hrValues.push(v);
      }
      used = true;
    }

    const last = LAST_OF_DAY[type];
    if (last) {
      const t = toMs(start);
      const agg = day(d);
      const prev = agg.last[last.key];
      if (!prev || t >= prev.t) agg.last[last.key] = { t, v: last.conv(value, unit) };
      used = true;
    }

    const smp = SAMPLES[type];
    if (smp) {
      const key = `${smp.metric}|${source}|${start}`;
      if (!sampleKeys.has(key)) {
        sampleKeys.add(key);
        samples.push({ metric: smp.metric, value: smp.conv(value, unit), measuredAt: toDate(start), sourceName: source });
      }
      used = true;
    }

    if (used) stats.recordsUsed++;
    else stats.ignoredTypes[type] = (stats.ignoredTypes[type] ?? 0) + 1;
  }

  function onWorkoutOpen(a: Record<string, string>) {
    const raw = a.workoutActivityType ?? '';
    const start = a.startDate ?? '';
    current = {
      type: WORKOUT_TYPES[raw] ?? 'OTHER',
      activityTypeRaw: raw,
      startedAt: toDate(start),
      endedAt: toDate(a.endDate ?? start),
      durationMin: round(toMin(Number(a.duration ?? 0), a.durationUnit ?? 'min'), 2),
      sourceName: a.sourceName ?? '',
      hasHr: false,
    };
  }

  function onWorkoutStat(a: Record<string, string>) {
    if (!current) return;
    const type = a.type ?? '';
    const unit = a.unit ?? '';
    if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      current.activeEnergyKcal = round(toKcal(Number(a.sum), unit), 1);
    } else if (type.startsWith('HKQuantityTypeIdentifierDistance')) {
      current.distanceKm = round(toKm(Number(a.sum), unit), 3);
    } else if (type === 'HKQuantityTypeIdentifierHeartRate') {
      if (a.average) current.avgHeartRate = round(Number(a.average), 1);
      if (a.maximum) current.maxHeartRate = Math.round(Number(a.maximum));
      current.hasHr = true;
    }
  }

  function onWorkoutClose() {
    if (!current) return;
    workouts.push(current);
    current = null;
  }

  function onActivitySummary(a: Record<string, string>) {
    const d = a.dateComponents;
    if (!d || d.length !== 10) return;
    const unit = a.activeEnergyBurnedUnit ?? 'kcal';
    day(d).activity = {
      activeKcal: toKcal(Number(a.activeEnergyBurned ?? 0), unit),
      goalKcal: toKcal(Number(a.activeEnergyBurnedGoal ?? 0), unit),
      exerciseMin: Number(a.appleExerciseTime ?? 0),
      exerciseGoal: Number(a.appleExerciseTimeGoal ?? 0),
      standHours: Number(a.appleStandHours ?? 0),
      standGoal: Number(a.appleStandHoursGoal ?? 0),
    };
  }

  // --------------------------------------------------------------- parseo

  const workoutLocalStart: string[] = [];
  const parser = new SaxesParser();
  const failure: { error: Error | null } = { error: null };
  parser.on('error', (e) => {
    failure.error ??= e;
  });
  parser.on('opentag', (tag: SaxesTagPlain) => {
    const a = tag.attributes;
    switch (tag.name) {
      case 'Record':
        onRecord(a);
        break;
      case 'Workout':
        onWorkoutOpen(a);
        workoutLocalStart.push(localDate(a.startDate ?? ''));
        break;
      case 'WorkoutStatistics':
        onWorkoutStat(a);
        break;
      case 'MetadataEntry':
        if (current && a.key === 'HKIndoorWorkout') current.isIndoor = a.value === '1';
        break;
      case 'ActivitySummary':
        onActivitySummary(a);
        break;
    }
  });
  parser.on('closetag', (tag: SaxesTagPlain) => {
    if (tag.name === 'Workout') onWorkoutClose();
  });

  const decoder = new StringDecoder('utf8');
  for await (const chunk of input) {
    parser.write(typeof chunk === 'string' ? chunk : decoder.write(chunk));
    if (failure.error) throw new Error(`XML inválido: ${failure.error.message}`);
  }
  parser.write(decoder.end());
  parser.close();
  if (failure.error) throw new Error(`XML inválido: ${failure.error.message}`);

  // ------------------------------------------ FC por workout (post-parseo)

  const order = new Uint32Array(hrTimes.length);
  for (let i = 0; i < order.length; i++) order[i] = i;
  order.sort((x, y) => hrTimes[x]! - hrTimes[y]!);
  const lowerBound = (t: number) => {
    let lo = 0;
    let hi = order.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (hrTimes[order[mid]!]! < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  workouts.forEach((w, i) => {
    const agg = day(workoutLocalStart[i]!);
    agg.workoutCount++;
    agg.workoutMin += w.durationMin;

    if (w.hasHr || order.length === 0) return;
    const from = w.startedAt.getTime();
    const to = w.endedAt.getTime();
    let sum = 0;
    let n = 0;
    let max = 0;
    for (let k = lowerBound(from); k < order.length; k++) {
      const t = hrTimes[order[k]!]!;
      if (t > to) break;
      const v = hrValues[order[k]!]!;
      sum += v;
      n++;
      if (v > max) max = v;
    }
    if (n > 0) {
      w.avgHeartRate = round(sum / n, 1);
      w.maxHeartRate = Math.round(max);
    }
  });

  // ------------------------------------------------------- armar los días

  const maxSource = (m?: Map<string, number>) => (m && m.size ? Math.max(...m.values()) : null);
  const dayInputs: DayInput[] = [];

  for (const [date, agg] of [...days.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const act = agg.activity;
    const computedActive = maxSource(agg.sums.activeEnergyKcal);
    const hr = agg.avg.hr;
    const s = agg.sleep;
    const hasSleep = s.keys.size > 0;
    const asleep = ASLEEP.reduce((acc, st) => acc + s.min[st], 0);
    const inBed = s.min.inBed > 0 ? s.min.inBed : asleep + s.min.awake;
    const night = mainBlock(s.segs, 90 * 60000);

    const steps = maxSource(agg.sums.steps);
    const distance = maxSource(agg.sums.distanceKm);
    const flights = maxSource(agg.sums.flightsClimbed);
    const basal = maxSource(agg.sums.basalEnergyKcal);

    dayInputs.push({
      date,
      steps: steps === null ? null : Math.round(steps),
      distanceKm: distance === null ? null : round(distance, 2),
      flightsClimbed: flights === null ? null : Math.round(flights),
      activeEnergyKcal: act && act.activeKcal! > 0 ? round(act.activeKcal!, 1) : computedActive === null ? null : round(computedActive, 1),
      basalEnergyKcal: basal === null ? null : round(basal, 1),
      activeEnergyGoalKcal: act && act.goalKcal! > 0 ? round(act.goalKcal!, 1) : null,
      exerciseMin: act && (act.exerciseGoal! > 0 || act.exerciseMin! > 0) ? Math.round(act.exerciseMin!) : null,
      standHours: act && (act.standGoal! > 0 || act.standHours! > 0) ? Math.round(act.standHours!) : null,

      restingHeartRate: avgOf(agg.avg.restingHr) === null ? null : Math.round(avgOf(agg.avg.restingHr)!),
      avgHeartRate: hr ? round(hr.sum / hr.n, 1) : null,
      minHeartRate: hr ? Math.round(hr.min) : null,
      maxHeartRate: hr ? Math.round(hr.max) : null,
      hrvSdnnMs: avgOf(agg.avg.hrv) === null ? null : round(avgOf(agg.avg.hrv)!, 1),
      respiratoryRate: avgOf(agg.avg.rr) === null ? null : round(avgOf(agg.avg.rr)!, 1),
      oxygenSaturation: avgOf(agg.avg.spo2) === null ? null : round(avgOf(agg.avg.spo2)!, 3),

      sleepStartedAt: night ? new Date(night.s) : null,
      sleepEndedAt: night ? new Date(night.e) : null,
      sleepInBedMin: hasSleep ? Math.round(inBed) : null,
      sleepAsleepMin: hasSleep ? Math.round(asleep) : null,
      sleepCoreMin: hasSleep ? Math.round(s.min.core) : null,
      sleepDeepMin: hasSleep ? Math.round(s.min.deep) : null,
      sleepRemMin: hasSleep ? Math.round(s.min.rem) : null,
      sleepAwakeMin: hasSleep ? Math.round(s.min.awake) : null,

      weightKg: agg.last.weightKg ? round(agg.last.weightKg.v, 2) : null,
      bodyFatPct: agg.last.bodyFatPct ? round(agg.last.bodyFatPct.v, 3) : null,
      leanBodyMassKg: agg.last.leanBodyMassKg ? round(agg.last.leanBodyMassKg.v, 2) : null,

      workoutCount: agg.workoutCount,
      workoutMin: Math.round(agg.workoutMin),
    });
  }

  const workoutInputs: WorkoutInput[] = workouts.map(({ hasHr: _drop, ...w }) => w);

  stats.days = dayInputs.length;
  stats.workouts = workoutInputs.length;
  stats.samples = samples.length;
  stats.ms = Date.now() - t0;

  return { payload: { days: dayInputs, workouts: workoutInputs, samples }, stats };
}
