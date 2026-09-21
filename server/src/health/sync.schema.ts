import { z } from 'zod';
import { HealthMetric, WorkoutType } from '../generated/prisma/enums.js';

/**
 * Contrato de ingesta de salud. Lo produce hoy el importer del export.xml
 * (en el servidor) y a futuro la app leyendo HealthKit. El backend no
 * distingue de dónde vino.
 */
const isoDate = z.iso.date(); // "YYYY-MM-DD" en la timezone del usuario
const num = z.number().finite();
const int = z.number().int();

export const dayInput = z.object({
  date: isoDate,

  steps: int.nullish(),
  distanceKm: num.nullish(),
  flightsClimbed: int.nullish(),
  activeEnergyKcal: num.nullish(),
  basalEnergyKcal: num.nullish(),
  activeEnergyGoalKcal: num.nullish(),
  exerciseMin: int.nullish(),
  standHours: int.nullish(),

  restingHeartRate: int.nullish(),
  avgHeartRate: num.nullish(),
  minHeartRate: int.nullish(),
  maxHeartRate: int.nullish(),
  hrvSdnnMs: num.nullish(),
  respiratoryRate: num.nullish(),
  oxygenSaturation: num.nullish(),

  sleepStartedAt: z.coerce.date().nullish(),
  sleepEndedAt: z.coerce.date().nullish(),
  sleepInBedMin: int.nullish(),
  sleepAsleepMin: int.nullish(),
  sleepCoreMin: int.nullish(),
  sleepDeepMin: int.nullish(),
  sleepRemMin: int.nullish(),
  sleepAwakeMin: int.nullish(),

  weightKg: num.nullish(),
  bodyFatPct: num.nullish(),
  leanBodyMassKg: num.nullish(),

  workoutCount: int.optional(),
  workoutMin: int.optional(),
});

export const workoutInput = z.object({
  type: z.enum(WorkoutType),
  activityTypeRaw: z.string().nullish(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  durationMin: num,
  activeEnergyKcal: num.nullish(),
  distanceKm: num.nullish(),
  avgHeartRate: num.nullish(),
  maxHeartRate: int.nullish(),
  isIndoor: z.boolean().nullish(),
  sourceName: z.string().min(1),
  externalId: z.string().nullish(),
});

export const sampleInput = z.object({
  metric: z.enum(HealthMetric),
  value: num,
  measuredAt: z.coerce.date(),
  sourceName: z.string().min(1),
  externalId: z.string().nullish(),
});

export const healthSyncPayload = z.object({
  days: z.array(dayInput),
  workouts: z.array(workoutInput).default([]),
  samples: z.array(sampleInput).default([]),
});

export type DayInput = z.infer<typeof dayInput>;
export type WorkoutInput = z.infer<typeof workoutInput>;
export type SampleInput = z.infer<typeof sampleInput>;
export type HealthSyncPayload = z.infer<typeof healthSyncPayload>;
