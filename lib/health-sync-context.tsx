import * as React from 'react';
import { AppState } from 'react-native';
import { sincronizarAppleHealth } from './healthkit';

type HealthSyncContextValue = {
   syncedAt: number;
   syncing: boolean;
   sync: (forzarTodo?: boolean) => Promise<{ daysUpserted: number; workoutsUpserted: number }>;
};

const HealthSyncContext = React.createContext<HealthSyncContextValue | undefined>(undefined);

export function HealthSyncProvider({ children }: { children: React.ReactNode }) {
   const [syncedAt, setSyncedAt] = React.useState(0);
   const [syncing, setSyncing] = React.useState(false);
   const enCurso = React.useRef(false);

   async function sync(forzarTodo = false) {
      if (enCurso.current) {
         throw new Error('Ya hay una sincronización en curso');
      }
      enCurso.current = true;
      setSyncing(true);
      try {
         const result = await sincronizarAppleHealth(forzarTodo);
         setSyncedAt(Date.now());
         return result;
      } finally {
         enCurso.current = false;
         setSyncing(false);
      }
   }

   React.useEffect(() => {
      function syncSilencioso() {
         sync().catch((e) => console.warn('sync Apple Health', e));
      }

      syncSilencioso();
      const sub = AppState.addEventListener('change', (estado) => {
         if (estado === 'active') syncSilencioso();
      });
      return () => sub.remove();
   }, []);

   return (
      <HealthSyncContext.Provider value={{ syncedAt, syncing, sync }}>{children}</HealthSyncContext.Provider>
   );
}

export function useHealthSync() {
   const ctx = React.useContext(HealthSyncContext);
   if (!ctx) {
      throw new Error('useHealthSync tiene que usarse dentro de <HealthSyncProvider>');
   }
   return ctx;
}
