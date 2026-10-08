import OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionTool } from 'openai/resources/chat/completions';
import { z } from 'zod';
import type { MealType } from '../generated/prisma/enums.js';
import { prisma } from '../lib/prisma.js';
import { todayInTz } from '../lib/dates.js';

/**
 * Agente de comida: recibe una foto y/o una descripción, estima los macros y
 * registra la comida en la base llamando a la tool `log_meal`. La tool es la
 * única forma de persistir: el modelo no puede escribir nada que no pase por
 * el schema de Zod.
 */
function openrouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY en server/.env');
  return new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey });
}

/** El modelo tiene que soportar imágenes + tools. Por defecto el mismo del chat. */
const MODEL =
  process.env.OPENROUTER_VISION_MODEL ?? process.env.OPENROUTER_MODEL ?? 'google/gemini-3.1-flash-lite';

const grams = z.number().min(0).max(5000);

const mealItem = z.object({
  name: z.string().min(1).describe('Alimento o preparación, ej. "Pechuga de pollo a la plancha"'),
  quantity: z.number().min(0).optional().describe('Cantidad estimada'),
  unit: z.string().optional().describe('Unidad de la cantidad: "g", "ml", "unidad", "taza", "cda"'),
  calories: z.number().min(0).max(10000),
  proteinG: grams,
  carbsG: grams,
  fatG: grams,
  fiberG: grams.optional(),
});

export const logMealParams = z.object({
  name: z.string().min(1).max(80).describe('Nombre corto de la comida completa, ej. "Milanesa con puré"'),
  mealType: z
    .enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])
    .optional()
    .describe('Tipo de comida. Inferilo del horario o de la descripción; si no se puede, omitilo.'),
  items: z.array(mealItem).min(1).max(20).describe('Un item por alimento identificable, con sus macros estimados.'),
  calories: z.number().min(0).max(20000).describe('Total de la comida (suma de los items).'),
  proteinG: grams.describe('Total de proteína en gramos.'),
  carbsG: grams.describe('Total de carbohidratos en gramos.'),
  fatG: grams.describe('Total de grasas en gramos.'),
  fiberG: grams.optional().describe('Total de fibra en gramos, si se puede estimar.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Qué tan segura es la estimación (0..1). Foto borrosa o porciones ambiguas → bajo.'),
  notes: z
    .string()
    .max(300)
    .optional()
    .describe('Supuestos que tomaste (porción, método de cocción) en una o dos frases.'),
});

export type LogMealArgs = z.infer<typeof logMealParams>;

const logMealTool: ChatCompletionTool = (() => {
  const { $schema: _, ...parameters } = z.toJSONSchema(logMealParams);
  return {
    type: 'function',
    function: {
      name: 'log_meal',
      description: 'Registra la comida con sus macros estimados. Llamala exactamente una vez.',
      parameters,
    },
  };
})();

const SYSTEM = [
  'Sos un nutricionista que estima calorías y macronutrientes de comidas a partir de una foto y/o una descripción.',
  'Identificá cada alimento, estimá la porción en gramos o unidades y calculá calorías, proteína, carbohidratos y grasas.',
  'Si la descripción trae cantidades o marcas, priorizala sobre lo que ves en la foto.',
  'Usá valores de tablas nutricionales estándar (USDA / argentinas). Sé realista con las porciones: un plato hogareño, no de restaurante.',
  'Nombres y notas en español rioplatense. Respondé únicamente llamando a la tool log_meal.',
].join('\n');

export type MealInput = {
  description?: string;
  /** Data URL (data:image/jpeg;base64,...) o URL pública. */
  image?: string;
  /** Instante en que se comió; default ahora. */
  eatenAt?: Date;
};

export async function analyzeAndLogMeal(userId: string, input: MealInput) {
  if (!input.description && !input.image) throw new Error('Mandá una descripción, una foto, o ambas');

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const eatenAt = input.eatenAt ?? new Date();
  const hora = new Intl.DateTimeFormat('es-AR', {
    timeZone: user.timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(eatenAt);

  const content: ChatCompletionContentPart[] = [];
  content.push({
    type: 'text',
    text: [
      `Hoy es ${todayInTz(user.timezone)}, son las ${hora}.`,
      input.description ? `Descripción del usuario: ${input.description}` : 'El usuario no escribió descripción.',
      input.image ? 'Adjunto la foto de la comida.' : 'No hay foto.',
    ].join('\n'),
  });
  if (input.image) content.push({ type: 'image_url', image_url: { url: input.image } });

  const client = openrouter();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content },
    ],
    tools: [logMealTool],
    tool_choice: { type: 'function', function: { name: 'log_meal' } },
  });

  const reply = completion.choices[0]?.message;
  const call = reply?.tool_calls?.find((c) => c.type === 'function' && c.function.name === 'log_meal');
  if (!call || call.type !== 'function') {
    throw new Error(reply?.content?.trim() || 'El modelo no registró la comida');
  }

  const parsed = logMealParams.safeParse(JSON.parse(call.function.arguments));
  if (!parsed.success) {
    throw new Error(`El modelo devolvió datos inválidos: ${z.prettifyError(parsed.error)}`);
  }
  const args = parsed.data;

  return prisma.meal.create({
    data: {
      userId,
      eatenAt,
      name: args.name,
      mealType: (args.mealType ?? null) as MealType | null,
      calories: args.calories,
      proteinG: args.proteinG,
      carbsG: args.carbsG,
      fatG: args.fatG,
      fiberG: args.fiberG ?? null,
      source: input.image ? 'AI_IMAGE' : 'AI_TEXT',
      aiModel: completion.model,
      aiConfidence: args.confidence,
      aiRaw: args,
      notes: [input.description, args.notes].filter(Boolean).join('\n') || null,
      items: {
        create: args.items.map((it, i) => ({
          order: i,
          name: it.name,
          quantity: it.quantity ?? null,
          unit: it.unit ?? null,
          calories: it.calories,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatG: it.fatG,
          fiberG: it.fiberG ?? null,
        })),
      },
    },
    include: { items: { orderBy: { order: 'asc' } } },
  });
}
