import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const TOKEN_KEY = 'fitness-tracker-token';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      //
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AuthUser = { id: string; email: string | null; name: string | null };

export type AuthResponse = { token: string; user: AuthUser };

export function loginRequest(email: string, password: string) {
   return api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
   });
}

export function registerRequest(email: string, password: string) {
   return api<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
   });
}

export function logoutRequest() {
   return api<void>('/api/auth/logout', { method: 'POST' });
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatResponse = {
  reply: string;
  toolCalls: { name: string; args: string }[];
  model: string;
};


export function sendChat(messages: ChatMessage[]) {
  return api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) });
}

export type DailyHealthSummary = {
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  steps: number | null;
  exerciseMin: number | null;
  restingHeartRate: number | null;
  activeEnergyKcal: number | null;
  basalEnergyKcal: number | null;
  sleepStartedAt: string | null;
  sleepEndedAt: string | null;
  sleepInBedMin: number | null;
  sleepAsleepMin: number | null;
  sleepCoreMin: number | null;
  sleepDeepMin: number | null;
  sleepRemMin: number | null;
  sleepAwakeMin: number | null;
};

export function getHealthDays(from: string, to?: string) {
  const params = new URLSearchParams({ from });
  if (to) params.set('to', to);
  return api<DailyHealthSummary[]>(`/api/health/days?${params}`);
}


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


export function getMeals(date?: string) {
  const params = date ? `?${new URLSearchParams({ date })}` : '';
  return api<MealsDay>(`/api/meals${params}`);
}


export type MealsGroup = { date: string; meals: Meal[] };

export function getRecentMeals(limit = 8) {
  return api<MealsGroup[]>(`/api/meals/recent?limit=${limit}`);
}

export function analyzeMeal(input: { description?: string; image?: string }) {
  return api<Meal>('/api/meals/analyze', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteMeal(id: string) {
  return api<void>(`/api/meals/${id}`, { method: 'DELETE' });
}

export type Me = {
  id: string;
  email: string | null;
  name: string | null;
  heightCm: number | null;
  birthDate: string | null;
  dailyKcalTarget: number | null;
  dailyProteinTarget: number | null;
};

export type MePatch = Partial<Omit<Me, 'id' | 'email'>>;

function normalizeMe(me: Me): Me {
  return { ...me, birthDate: me.birthDate ? me.birthDate.slice(0, 10) : null };
}

export async function getMe() {
  return normalizeMe(await api<Me>('/api/me'));
}

export async function updateMe(patch: MePatch) {
  return normalizeMe(await api<Me>('/api/me', { method: 'PATCH', body: JSON.stringify(patch) }));
}

export type HealthDayPatch = {
   weightKg?: number;
   bodyFatPct?: number;
   sleepAsleepMin?: number;
};

export function updateHealthDay(date: string, patch: HealthDayPatch) {
   return api<DailyHealthSummary>(`/api/health/days/${date}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
   });
}

export type MealInput = {
   name: string;
   calories?: number;
   proteinG?: number;
   carbsG?: number;
   fatG?: number;
};

export function createMeal(input: MealInput) {
   return api<Meal>('/api/meals', { method: 'POST', body: JSON.stringify(input) });
}

export function todayIso() {
   const d = new Date();
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   return `${d.getFullYear()}-${mm}-${dd}`;
}

export type HealthDayInput = {
   date: string;
   steps?: number | null;
   distanceKm?: number | null;
   flightsClimbed?: number | null;
   activeEnergyKcal?: number | null;
   basalEnergyKcal?: number | null;
   activeEnergyGoalKcal?: number | null;
   exerciseMin?: number | null;
   standHours?: number | null;
   restingHeartRate?: number | null;
   avgHeartRate?: number | null;
   minHeartRate?: number | null;
   maxHeartRate?: number | null;
   hrvSdnnMs?: number | null;
   respiratoryRate?: number | null;
   oxygenSaturation?: number | null;
   sleepStartedAt?: Date | null;
   sleepEndedAt?: Date | null;
   sleepInBedMin?: number | null;
   sleepAsleepMin?: number | null;
   sleepCoreMin?: number | null;
   sleepDeepMin?: number | null;
   sleepRemMin?: number | null;
   sleepAwakeMin?: number | null;
   weightKg?: number | null;
   bodyFatPct?: number | null;
   leanBodyMassKg?: number | null;
   workoutCount?: number;
   workoutMin?: number;
};

export type HealthWorkoutInput = {
   type:
      | 'TRADITIONAL_STRENGTH_TRAINING'
      | 'FUNCTIONAL_STRENGTH_TRAINING'
      | 'RUNNING'
      | 'WALKING'
      | 'CYCLING'
      | 'STAIR_CLIMBING'
      | 'SWIMMING'
      | 'HIIT'
      | 'OTHER';
   activityTypeRaw: string | null;
   startedAt: Date;
   endedAt: Date;
   durationMin: number;
   activeEnergyKcal: number | null;
   distanceKm: number | null;
   avgHeartRate: number | null;
   maxHeartRate: number | null;
   isIndoor: boolean | null;
   sourceName: string;
   externalId: string | null;
};

export type HealthSyncResult = { id: string; status: string; daysUpserted: number; workoutsUpserted: number };

export function getLastHealthSync() {
   return api<{ rangeTo: string | null }>('/api/health/last-sync');
}

export function syncHealth(payload: { days: HealthDayInput[]; workouts?: HealthWorkoutInput[] }) {
   return api<HealthSyncResult>('/api/health/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
   });
}
