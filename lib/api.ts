/**
 * Cliente mínimo de la API. La URL y el usuario salen de variables EXPO_PUBLIC_*
 * (ver .env.example). El usuario es provisorio: hasta que haya login, la app
 * manda un UUID fijo en el header `x-user-id`.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const USER_ID = process.env.EXPO_PUBLIC_USER_ID ?? '';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': USER_ID,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // sin body JSON: queda el status
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatResponse = {
  reply: string;
  toolCalls: { name: string; args: string }[];
  model: string;
};

/** Manda el historial completo; el server corre el agente y devuelve la respuesta final. */
export function sendChat(messages: ChatMessage[]) {
  return api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) });
}

/** Subconjunto de la fila de DailyHealthSummary que usa el dashboard. */
export type DailyHealthSummary = {
  date: string;
  weightKg: number | null;
  steps: number | null;
  sleepAsleepMin: number | null;
  activeEnergyKcal: number | null;
};

export function getHealthDays(from: string, to?: string) {
  const params = new URLSearchParams({ from });
  if (to) params.set('to', to);
  return api<DailyHealthSummary[]>(`/api/health/days?${params}`);
}

// ---------------------------------------------------------------------
// Comida
// ---------------------------------------------------------------------

export type MealItem = {
  id: string;
  order: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export type Meal = {
  id: string;
  eatenAt: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | null;
  name: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  source: 'MANUAL' | 'AI_IMAGE' | 'AI_TEXT';
  aiConfidence: number | null;
  notes: string | null;
  items: MealItem[];
};

export type MealTotals = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type MealsDay = { date: string; meals: Meal[]; totals: MealTotals };

/** Comidas de un día (en la zona horaria del usuario). Sin fecha: hoy. */
export function getMeals(date?: string) {
  const params = date ? `?${new URLSearchParams({ date })}` : '';
  return api<MealsDay>(`/api/meals${params}`);
}

/**
 * Manda foto (data URL) y/o descripción; el server corre el agente que estima
 * macros y guarda la comida. Devuelve la comida ya creada.
 */
export function analyzeMeal(input: { description?: string; image?: string }) {
  return api<Meal>('/api/meals/analyze', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteMeal(id: string) {
  return api<void>(`/api/meals/${id}`, { method: 'DELETE' });
}
