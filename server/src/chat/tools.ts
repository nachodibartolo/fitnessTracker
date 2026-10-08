import { z } from 'zod';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { HealthMetric } from '../generated/prisma/enums.js';
import { fromDbDate, toDbDate } from '../health/sync.service.js';
import { prisma } from '../lib/prisma.js';

/**
 * Tools de solo lectura que el modelo puede pedir. Cada una es una consulta
 * escrita por nosotros y filtrada por el usuario autenticado: el modelo nunca
 * ve SQL ni la base. Los parámetros se declaran con Zod y de ahí sale el JSON
 * Schema que se le manda al modelo (una sola fuente de verdad).
 */

/** String plano con regex (y no z.iso.date) para que el JSON Schema que ve el modelo sea simple. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

const dateRange = z.object({
  from: isoDate.optional().describe('Inicio del rango (inclusive). Default: 30 días atrás.'),
  to: isoDate.optional().describe('Fin del rango (inclusive). Default: hoy.'),
});

type DateRange = z.infer<typeof dateRange>;

function resolveRange(r: DateRange, defaultDays: number) {
  const to = r.to ? toDbDate(r.to) : new Date();
  const from = r.from ? toDbDate(r.from) : new Date(to.getTime() - defaultDays * 86_400_000);
  return { from, to: new Date(`${fromDbDate(to)}T23:59:59.999Z`) };
}

/** Saca nulls, ids internos y timestamps para que el JSON que ve el modelo sea chico. */
function compact<T extends object>(row: T): Partial<T> {
  const drop = new Set(['id', 'userId', 'importId', 'createdAt', 'updatedAt', 'externalId']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined || drop.has(k)) continue;
    out[k] = typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v;
  }
  return out as Partial<T>;
}

type Tool<S extends z.ZodObject> = {
  description: string;
  params: S;
  run: (userId: string, args: z.infer<S>) => Promise<unknown>;
};

function tool<S extends z.ZodObject>(t: Tool<S>): Tool<S> {
  return t;
}

export const tools = {
  get_daily_health: tool({
    description:
      'Resumen diario de Apple Health: una fila por día con pasos, energía activa, minutos de ejercicio, ' +
      'frecuencia cardíaca (reposo/promedio/máx), HRV, sueño por etapas (minutos) y peso del día. ' +
      'Máximo 120 días por llamada.',
    params: dateRange,
    run: async (userId, args) => {
      const { from, to } = resolveRange(args, 30);
      const rows = await prisma.dailyHealthSummary.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
        take: 121,
      });
      const truncated = rows.length > 120;
      return {
        truncated,
        days: rows.slice(0, 120).map((d) => ({ ...compact(d), date: fromDbDate(d.date) })),
      };
    },
  }),

  get_workouts: tool({
    description:
      'Entrenamientos registrados por el reloj (Apple Watch / Zepp): tipo, inicio, duración, ' +
      'calorías, distancia y frecuencia cardíaca. Máximo 200 por llamada.',
    params: dateRange,
    run: async (userId, args) => {
      const { from, to } = resolveRange(args, 30);
      const rows = await prisma.workout.findMany({
        where: { userId, startedAt: { gte: from, lte: to } },
        orderBy: { startedAt: 'desc' },
        take: 201,
      });
      return { truncated: rows.length > 200, workouts: rows.slice(0, 200).map(compact) };
    },
  }),

  get_measurements: tool({
    description:
      'Mediciones puntuales de una métrica: peso (BODY_MASS, kg), grasa corporal (BODY_FAT_PERCENTAGE, 0..1), ' +
      'masa magra (LEAN_BODY_MASS, kg), FC en reposo (RESTING_HEART_RATE), HRV (HEART_RATE_VARIABILITY_SDNN, ms), ' +
      'VO2 máx (VO2_MAX). Sirve para ver la evolución en el tiempo. Máximo 300 por llamada.',
    params: dateRange.extend({
      metric: z
        .enum([
          'BODY_MASS',
          'BODY_FAT_PERCENTAGE',
          'LEAN_BODY_MASS',
          'BODY_MASS_INDEX',
          'HEIGHT',
          'RESTING_HEART_RATE',
          'HEART_RATE_VARIABILITY_SDNN',
          'VO2_MAX',
        ])
        .describe('Métrica a consultar'),
    }),
    run: async (userId, args) => {
      const { from, to } = resolveRange(args, 365);
      const rows = await prisma.healthSample.findMany({
        where: { userId, metric: args.metric as HealthMetric, measuredAt: { gte: from, lte: to } },
        orderBy: { measuredAt: 'asc' },
        take: 301,
        select: { measuredAt: true, value: true, sourceName: true },
      });
      return { truncated: rows.length > 300, samples: rows.slice(0, 300).map(compact) };
    },
  }),

  get_training_sessions: tool({
    description:
      'Sesiones de gimnasio anotadas por el usuario, con ejercicios y series (peso en kg, reps, RPE). ' +
      'Distinto de get_workouts: acá está lo que se levantó, no lo que midió el reloj. Máximo 30 por llamada.',
    params: dateRange,
    run: async (userId, args) => {
      const { from, to } = resolveRange(args, 30);
      const rows = await prisma.trainingSession.findMany({
        where: { userId, performedAt: { gte: from, lte: to } },
        orderBy: { performedAt: 'desc' },
        take: 30,
        include: {
          programDay: { select: { name: true } },
          exercises: {
            orderBy: { order: 'asc' },
            include: {
              exercise: { select: { name: true } },
              sets: { orderBy: [{ setNumber: 'asc' }, { dropIndex: 'asc' }] },
            },
          },
        },
      });
      return {
        sessions: rows.map((s) => ({
          performedAt: s.performedAt,
          day: s.programDay?.name ?? s.title,
          week: s.weekNumber,
          durationMin: s.durationMin,
          notes: s.notes,
          exercises: s.exercises.map((e) => ({
            name: e.exercise.name,
            notes: e.notes,
            sets: e.sets.map((st) =>
              compact({
                weightKg: st.weightKg,
                reps: st.reps,
                rpe: st.rpe,
                drop: st.dropIndex || null,
                warmup: st.isWarmup || null,
              })
            ),
          })),
        })),
      };
    },
  }),

  get_meals: tool({
    description:
      'Comidas registradas por el usuario (nombre, tipo, calorías, proteína, carbohidratos, grasas, fibra) ' +
      'con sus items. Sirve para calcular ingesta diaria y compararla con los objetivos. Máximo 100 por llamada.',
    params: dateRange,
    run: async (userId, args) => {
      const { from, to } = resolveRange(args, 7);
      const rows = await prisma.meal.findMany({
        where: { userId, eatenAt: { gte: from, lte: to } },
        orderBy: { eatenAt: 'desc' },
        take: 101,
        include: { items: { orderBy: { order: 'asc' }, select: { name: true, quantity: true, unit: true, calories: true } } },
      });
      return {
        truncated: rows.length > 100,
        meals: rows.slice(0, 100).map((m) =>
          compact({
            eatenAt: m.eatenAt,
            name: m.name,
            mealType: m.mealType,
            calories: m.calories,
            proteinG: m.proteinG,
            carbsG: m.carbsG,
            fatG: m.fatG,
            fiberG: m.fiberG,
            items: m.items.map(compact),
          })
        ),
      };
    },
  }),
};

export type ToolName = keyof typeof tools;

/** Lo que se le manda al modelo en cada request (formato OpenAI function calling). */
export const toolDefinitions: ChatCompletionTool[] = Object.entries(tools).map(([name, t]) => {
  const { $schema: _, ...parameters } = z.toJSONSchema(t.params);
  return { type: 'function', function: { name, description: t.description, parameters } };
});

/** Ejecuta una tool pedida por el modelo. Los errores vuelven como resultado para que el modelo pueda reaccionar. */
export async function runTool(userId: string, name: string, rawArgs: string): Promise<unknown> {
  const t = tools[name as ToolName];
  if (!t) return { error: `Tool desconocida: ${name}` };
  try {
    const args = t.params.parse(rawArgs ? JSON.parse(rawArgs) : {});
    return await t.run(userId, args as never);
  } catch (err) {
    if (err instanceof z.ZodError)
      return { error: `Argumentos inválidos: ${z.prettifyError(err)}` };
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
