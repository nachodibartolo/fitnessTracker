import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth-context';
import * as React from 'react';
import { TextInput, View } from 'react-native';

export default function LoginScreen() {
   const { login, register } = useAuth();
   const [email, setEmail] = React.useState('');
   const [password, setPassword] = React.useState('');
   const [error, setError] = React.useState<string | null>(null);

   function validar() {
      if (!email || !password) {
         setError('Completá email y contraseña');
         return false;
      }
      return true;
   }

   async function handleLogin() {
      if (!validar()) return;
      setError(await login(email, password));
   }

   async function handleRegister() {
      if (!validar()) return;
      setError(await register(email, password));
   }

   return (
      <View className="flex-1 justify-center gap-4 p-6">
         <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            className="rounded-md border border-border p-3 text-foreground"
         />
         <TextInput
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            className="rounded-md border border-border p-3 text-foreground"
         />
         {error && <Text className="text-destructive">{error}</Text>}
         <Button onPress={handleLogin}><Text>Entrar</Text></Button>
         <Button variant="outline" onPress={handleRegister}><Text>Crear cuenta</Text></Button>
      </View>
   );
}
