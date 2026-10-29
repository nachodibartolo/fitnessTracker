import * as React from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe, loginRequest, logoutRequest, registerRequest, TOKEN_KEY, type AuthUser } from './api';

type AuthContextValue = {
   user: AuthUser | null;
   isHydrated: boolean;
   login: (email: string, password: string) => Promise<string | null>;
   register: (email: string, password: string) => Promise<string | null>;
   logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
   const [user, setUser] = React.useState<AuthUser | null>(null);
   const [isHydrated, setIsHydrated] = React.useState(false);

   React.useEffect(() => {
      async function restoreSession() {
         try {
            const token = await SecureStore.getItemAsync(TOKEN_KEY);
            if (token) {
               const me = await getMe();
               setUser({ id: me.id, email: me.email, name: me.name });
            }
         } catch {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
         } finally {
            setIsHydrated(true);
         }
      }
      restoreSession();
   }, []);

   async function startSession(request: Promise<{ token: string; user: AuthUser }>) {
      try {
         const { token, user } = await request;
         await SecureStore.setItemAsync(TOKEN_KEY, token);
         setUser(user);
         return null;
      } catch (e) {
         return (e as Error).message;
      }
   }

   function login(email: string, password: string) {
      return startSession(loginRequest(email, password));
   }

   function register(email: string, password: string) {
      return startSession(registerRequest(email, password));
   }

   async function logout() {
      try {
         await logoutRequest();
      } catch {}
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setUser(null);
   }

   const value = React.useMemo(
      () => ({ user, isHydrated, login, register, logout }),
      [user, isHydrated],
   );

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
   const ctx = React.useContext(AuthContext);
   if (!ctx) {
      throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
   }
   return ctx;
}
