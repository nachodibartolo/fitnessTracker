import { HealthSyncProvider } from '@/lib/health-sync-context';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <HealthSyncProvider>
      <NativeTabs>
        <NativeTabs.Trigger name="salud">
          <NativeTabs.Trigger.Label>Salud</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="heart.fill" md="favorite" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="sueno">
          <NativeTabs.Trigger.Label>Sueño</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="bed.double.fill" md="bedtime" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="comida">
          <NativeTabs.Trigger.Label>Comida</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" md="chat" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </HealthSyncProvider>
  );
}
