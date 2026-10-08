import { Icon } from '@/components/ui/icon';
import { Markdown } from '@/components/ui/markdown';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { sendChat, type ChatMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SendHorizontal } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Bubble = ChatMessage & { id: string; error?: boolean; toolCalls?: string[] };

// Alto aproximado del tab bar nativo flotante: con el teclado cerrado, la barra
// de input se levanta esa distancia para que no quede tapada.
const TAB_BAR_HEIGHT = 60;

const SUGERENCIAS = [
  '¿Cómo vengo durmiendo esta semana?',
  '¿Cuántos entrenamientos hice este mes?',
  '¿Cómo evolucionó mi peso este año?',
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const listRef = React.useRef<FlatList<Bubble>>(null);
  const [messages, setMessages] = React.useState<Bubble[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;

    const next: Bubble[] = [...messages, { id: `u-${Date.now()}`, role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      // Al modelo le va solo el texto de la conversación, sin los mensajes de error.
      const history = next.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
      const res = await sendChat(history);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          toolCalls: res.toolCalls.map((t) => t.name),
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Error desconocido',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Chat" />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerClassName="gap-3 px-4 py-4"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View className="gap-2 pt-6">
            <Text variant="muted" className="mb-2">
              Preguntale sobre tus datos de salud y entrenamiento.
            </Text>
            {SUGERENCIAS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                className="rounded-xl border border-border bg-card px-4 py-3 active:bg-accent">
                <Text>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        ListFooterComponent={
          sending ? (
            <View className="flex-row items-center gap-2 self-start rounded-2xl bg-muted px-4 py-3">
              <ActivityIndicator size="small" />
              <Text variant="muted">Consultando tus datos…</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-3',
              item.role === 'user' ? 'self-end bg-primary' : 'self-start bg-muted',
              item.error && 'bg-destructive/15'
            )}>
            {item.role === 'assistant' && !item.error ? (
              <Markdown>{item.content}</Markdown>
            ) : (
              <Text
                className={cn(
                  item.role === 'user' && 'text-primary-foreground',
                  item.error && 'text-destructive'
                )}>
                {item.content}
              </Text>
            )}
            {item.toolCalls && item.toolCalls.length > 0 ? (
              <Text variant="muted" className="mt-2 text-xs">
                tools: {item.toolCalls.join(', ')}
              </Text>
            ) : null}
          </View>
        )}
      />

      <View
        className="flex-row items-end gap-2 border-t border-border px-3 pt-2"
        style={{
          paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT,
        }}>
        <TextInput
          className="max-h-32 flex-1 rounded-2xl border border-input bg-background px-4 py-2.5 font-sans text-base text-foreground placeholder:text-muted-foreground"
          placeholder="Escribí tu pregunta…"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
          onSubmitEditing={() => send(input)}
          submitBehavior="blurAndSubmit"
          returnKeyType="send"
        />
        <Pressable
          onPress={() => send(input)}
          disabled={sending || input.trim().length === 0}
          className="h-11 w-11 items-center justify-center rounded-full bg-primary active:bg-primary/90 disabled:opacity-50">
          <Icon as={SendHorizontal} size={18} className="text-primary-foreground" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
