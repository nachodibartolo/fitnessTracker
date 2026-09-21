import { prisma } from '../lib/prisma.js';
import type { HealthImportChannel } from '../generated/prisma/enums.js';
import type { HealthSyncPayload } from './sync.schema.js';

/** Columna `date` (@db.Date): Prisma toma la parte UTC del Date. */
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function fromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/**
 * Upsertea el payload de salud de un usuario y deja registro en HealthImport.
 *
 * - APPLE_HEALTH_XML: reemplaza. Se borran los imports anteriores de ese canal
 *   (cascade → sus HealthSample) antes de insertar los nuevos.
 * - HEALTHKIT: incremental, solo upsertea lo que vino.
 * Días y workouts siempre se upsertean por clave natural, así los ids (y el
 * vínculo Workout ↔ TrainingSession) sobreviven a un re-import.
 */
export async function syncHealth(
  userId: string,
  channel: HealthImportChannel,
  payload: HealthSyncPayload,
  meta: { fileName?: string } = {},
) {
  const imp = await prisma.healthImport.create({
    data: { userId, channel, status: 'PROCESSING', fileName: meta.fileName ?? null },
  });

  try {
    if (channel === 'APPLE_HEALTH_XML') {
      await prisma.healthImport.deleteMany({ where: { userId, channel, id: { not: imp.id } } });
    }

    await inChunks(payload.days, 20, (d) => {
      const { date, ...fields } = d;
      const data = { ...fields, importId: imp.id };
      return prisma.dailyHealthSummary.upsert({
        where: { userId_date: { userId, date: toDbDate(date) } },
        create: { userId, date: toDbDate(date), ...data },
        update: data,
      });
    });

    await inChunks(payload.workouts, 20, (w) => {
      const data = { ...w, importId: imp.id };
      return prisma.workout.upsert({
        where: { userId_sourceName_startedAt: { userId, sourceName: w.sourceName, startedAt: w.startedAt } },
        create: { userId, ...data },
        update: data,
      });
    });

    const samples = await prisma.healthSample.createMany({
      data: payload.samples.map((s) => ({ userId, importId: imp.id, ...s })),
      skipDuplicates: true,
    });

    const dates = payload.days.map((d) => d.date).sort();
    const done = await prisma.healthImport.update({
      where: { id: imp.id },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
        rangeFrom: dates.length ? toDbDate(dates[0]!) : null,
        rangeTo: dates.length ? toDbDate(dates[dates.length - 1]!) : null,
        daysUpserted: payload.days.length,
        workoutsUpserted: payload.workouts.length,
        samplesInserted: samples.count,
      },
    });
    return done;
  } catch (err) {
    await prisma.healthImport.update({
      where: { id: imp.id },
      data: { status: 'FAILED', finishedAt: new Date(), error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}
