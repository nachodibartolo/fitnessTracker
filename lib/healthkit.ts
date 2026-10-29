import {
   isHealthDataAvailable,
   queryActivitySummary,
   queryCategorySamples,
   queryQuantitySamples,
   queryStatisticsForQuantity,
   queryWorkoutSamples,
   requestAuthorization,
   type ActivitySummary,
   type QuantityTypeIdentifier,
   type StatisticsOptions,
} from '@kingstinct/react-native-healthkit';
import { getLastHealthSync, syncHealth, type HealthDayInput, type HealthWorkoutInput } from '@/lib/api';

const PERMISOS = [
   'HKQuantityTypeIdentifierStepCount',
   'HKQuantityTypeIdentifierDistanceWalkingRunning',
   'HKQuantityTypeIdentifierFlightsClimbed',
   'HKQuantityTypeIdentifierActiveEnergyBurned',
   'HKQuantityTypeIdentifierBasalEnergyBurned',
   'HKQuantityTypeIdentifierHeartRate',
   'HKQuantityTypeIdentifierRestingHeartRate',
   'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
   'HKQuantityTypeIdentifierRespiratoryRate',
   'HKQuantityTypeIdentifierOxygenSaturation',
   'HKQuantityTypeIdentifierBodyMass',
   'HKQuantityTypeIdentifierBodyFatPercentage',
   'HKQuantityTypeIdentifierLeanBodyMass',
   'HKCategoryTypeIdentifierSleepAnalysis',
   'HKActivitySummaryTypeIdentifier',
   'HKWorkoutTypeIdentifier',
] as const;

const SUENO = { inBed: 0, asleepUnspecified: 1, awake: 2, core: 3, deep: 4, rem: 5 };

const TIPO_WORKOUT: Record<number, HealthWorkoutInput['type']> = {
   50: 'TRADITIONAL_STRENGTH_TRAINING',
   20: 'FUNCTIONAL_STRENGTH_TRAINING',
   37: 'RUNNING',
   52: 'WALKING',
   13: 'CYCLING',
   44: 'STAIR_CLIMBING',
   46: 'SWIMMING',
   63: 'HIIT',
};

function inicioDelDia(diasAtras: number) {
   const d = new Date();
   d.setDate(d.getDate() - diasAtras);
   d.setHours(0, 0, 0, 0);
   return d;
}

function masHoras(d: Date, horas: number) {
   return new Date(d.getTime() + horas * 60 * 60 * 1000);
}

function fechaIso(d: Date) {
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   return `${d.getFullYear()}-${mm}-${dd}`;
}

function minutosEntre(a: Date, b: Date) {
   return (b.getTime() - a.getTime()) / 60000;
}

function diasEntre(desde: Date, hasta: Date) {
   return Math.round((hasta.getTime() - desde.getTime()) / 86400000);
}

async function primerDiaConDatos() {
   const muestras = await queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      limit: 1,
      ascending: true,
   });
   if (muestras.length === 0) return inicioDelDia(0);
   const d = new Date(muestras[0].startDate);
   d.setHours(0, 0, 0, 0);
   return d;
}

async function fechaDesde(forzarTodo: boolean) {
   if (forzarTodo) return primerDiaConDatos();

   const ultimo = await getLastHealthSync();
   if (ultimo.rangeTo === null) return primerDiaConDatos();

   const d = new Date(`${ultimo.rangeTo}T00:00:00`);
   d.setDate(d.getDate() - 1);
   return d;
}

async function estadistica(
   id: QuantityTypeIdentifier,
   tipo: StatisticsOptions,
   desde: Date,
   hasta: Date,
   unit: string,
): Promise<number | null> {
   const filter = { date: { startDate: desde, endDate: hasta } };
   const r = await queryStatisticsForQuantity(id, [tipo], { filter, unit });
   if (tipo === 'cumulativeSum') return r.sumQuantity?.quantity ?? null;
   if (tipo === 'discreteAverage') return r.averageQuantity?.quantity ?? null;
   if (tipo === 'discreteMin') return r.minimumQuantity?.quantity ?? null;
   if (tipo === 'discreteMax') return r.maximumQuantity?.quantity ?? null;
   return r.mostRecentQuantity?.quantity ?? null;
}

function redondear(v: number | null) {
   return v === null ? null : Math.round(v);
}

async function leerSueno(dia: Date) {
   const desde = masHoras(dia, -6);
   const hasta = masHoras(dia, 14);
   const muestras = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate: desde, endDate: hasta } },
      limit: 0,
      ascending: true,
   });
   if (muestras.length === 0) return {};

   const min = { inBed: 0, core: 0, deep: 0, rem: 0, awake: 0, otro: 0 };
   for (const m of muestras) {
      const dur = minutosEntre(m.startDate, m.endDate);
      if (m.value === SUENO.inBed) min.inBed += dur;
      else if (m.value === SUENO.core) min.core += dur;
      else if (m.value === SUENO.deep) min.deep += dur;
      else if (m.value === SUENO.rem) min.rem += dur;
      else if (m.value === SUENO.awake) min.awake += dur;
      else min.otro += dur;
   }

   const dormido = min.core + min.deep + min.rem + min.otro;
   return {
      sleepStartedAt: muestras[0].startDate,
      sleepEndedAt: muestras[muestras.length - 1].endDate,
      sleepInBedMin: Math.round(min.inBed || dormido + min.awake),
      sleepAsleepMin: Math.round(dormido),
      sleepCoreMin: Math.round(min.core),
      sleepDeepMin: Math.round(min.deep),
      sleepRemMin: Math.round(min.rem),
      sleepAwakeMin: Math.round(min.awake),
   };
}

function buscarAnillos(resumenes: readonly ActivitySummary[], dia: Date) {
   return resumenes.find(
      (r) =>
         r.dateComponents.year === dia.getFullYear() &&
         r.dateComponents.month === dia.getMonth() + 1 &&
         r.dateComponents.day === dia.getDate(),
   );
}

async function leerDia(dia: Date, anillos: ActivitySummary | undefined, workouts: HealthWorkoutInput[]): Promise<HealthDayInput> {
   const fin = masHoras(dia, 24);
   const stat = (id: QuantityTypeIdentifier, tipo: StatisticsOptions, unit: string) =>
      estadistica(id, tipo, dia, fin, unit);

   const distanciaM = await stat('HKQuantityTypeIdentifierDistanceWalkingRunning', 'cumulativeSum', 'm');
   const delDia = workouts.filter((w) => w.startedAt >= dia && w.startedAt < fin);

   return {
      date: fechaIso(dia),

      steps: redondear(await stat('HKQuantityTypeIdentifierStepCount', 'cumulativeSum', 'count')),
      distanceKm: distanciaM === null ? null : distanciaM / 1000,
      flightsClimbed: redondear(await stat('HKQuantityTypeIdentifierFlightsClimbed', 'cumulativeSum', 'count')),
      activeEnergyKcal: await stat('HKQuantityTypeIdentifierActiveEnergyBurned', 'cumulativeSum', 'kcal'),
      basalEnergyKcal: await stat('HKQuantityTypeIdentifierBasalEnergyBurned', 'cumulativeSum', 'kcal'),
      activeEnergyGoalKcal: anillos?.activeEnergyBurnedGoal.quantity ?? null,
      exerciseMin: anillos ? Math.round(anillos.appleExerciseTime.quantity) : null,
      standHours: anillos ? Math.round(anillos.appleStandHours.quantity) : null,

      restingHeartRate: redondear(await stat('HKQuantityTypeIdentifierRestingHeartRate', 'discreteAverage', 'count/min')),
      avgHeartRate: await stat('HKQuantityTypeIdentifierHeartRate', 'discreteAverage', 'count/min'),
      minHeartRate: redondear(await stat('HKQuantityTypeIdentifierHeartRate', 'discreteMin', 'count/min')),
      maxHeartRate: redondear(await stat('HKQuantityTypeIdentifierHeartRate', 'discreteMax', 'count/min')),
      hrvSdnnMs: await stat('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'discreteAverage', 'ms'),
      respiratoryRate: await stat('HKQuantityTypeIdentifierRespiratoryRate', 'discreteAverage', 'count/min'),
      oxygenSaturation: await stat('HKQuantityTypeIdentifierOxygenSaturation', 'discreteAverage', '%'),

      ...(await leerSueno(dia)),

      weightKg: await stat('HKQuantityTypeIdentifierBodyMass', 'mostRecent', 'kg'),
      bodyFatPct: await stat('HKQuantityTypeIdentifierBodyFatPercentage', 'mostRecent', '%'),
      leanBodyMassKg: await stat('HKQuantityTypeIdentifierLeanBodyMass', 'mostRecent', 'kg'),

      workoutCount: delDia.length,
      workoutMin: Math.round(delDia.reduce((total, w) => total + w.durationMin, 0)),
   };
}

async function leerWorkouts(desde: Date): Promise<HealthWorkoutInput[]> {
   const lista = await queryWorkoutSamples({
      filter: { date: { startDate: desde, endDate: new Date() } },
      limit: 0,
      ascending: true,
   });

   const resultado: HealthWorkoutInput[] = [];
   for (const w of lista) {
      const tipo = Number(w.workoutActivityType);
      const segundos = w.duration.unit === 's' ? w.duration.quantity : w.duration.quantity * 60;
      const fc = await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');

      resultado.push({
         type: TIPO_WORKOUT[tipo] ?? 'OTHER',
         activityTypeRaw: String(tipo),
         startedAt: w.startDate,
         endedAt: w.endDate,
         durationMin: segundos / 60,
         activeEnergyKcal: w.totalEnergyBurned?.quantity ?? null,
         distanceKm: w.totalDistance ? w.totalDistance.quantity / 1000 : null,
         avgHeartRate: fc?.averageQuantity?.quantity ?? null,
         maxHeartRate: redondear(fc?.maximumQuantity?.quantity ?? null),
         isIndoor: typeof w.metadata?.HKIndoorWorkout === 'boolean' ? w.metadata.HKIndoorWorkout : null,
         sourceName: w.sourceRevision.source.name,
         externalId: w.uuid,
      });
   }
   return resultado;
}

const DIAS_POR_TANDA = 60;

export async function sincronizarAppleHealth(forzarTodo = false) {
   if (!isHealthDataAvailable()) {
      throw new Error('Apple Health no está disponible en este dispositivo');
   }

   const autorizado = await requestAuthorization({ toRead: PERMISOS });
   if (!autorizado) {
      throw new Error('No se pudo pedir permiso a Apple Health');
   }

   const desde = await fechaDesde(forzarTodo);
   const dias = diasEntre(desde, inicioDelDia(0)) + 1;
   const workouts = await leerWorkouts(desde);
   const anillos = await queryActivitySummary({ date: { startDate: desde, endDate: new Date() } });

   let daysUpserted = 0;
   let days: HealthDayInput[] = [];
   for (let i = dias - 1; i >= 0; i--) {
      const dia = inicioDelDia(i);
      days.push(await leerDia(dia, buscarAnillos(anillos, dia), workouts));

      if (days.length === DIAS_POR_TANDA) {
         await syncHealth({ days, workouts: [] });
         daysUpserted += days.length;
         days = [];
      }
   }

   const result = await syncHealth({ days, workouts });
   return { ...result, daysUpserted: daysUpserted + result.daysUpserted };
}
