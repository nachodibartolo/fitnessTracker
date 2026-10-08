import { FONTS, THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import MarkdownDisplay from 'react-native-markdown-display';

/**
 * Renderiza Markdown (negritas, listas, tablas, código) con la tipografía
 * y colores del tema. Pensado para las respuestas de la IA en el chat.
 */
export function Markdown({ children, color }: { children: string; color?: string }) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const fg = color ?? c.foreground;

  const styles = React.useMemo(
    () => ({
      body: { color: fg, fontFamily: FONTS.sans, fontSize: 16, lineHeight: 22 },
      paragraph: { marginTop: 0, marginBottom: 8 },
      strong: { fontFamily: FONTS.sansBold },
      em: { fontStyle: 'italic' as const },
      heading1: { fontFamily: FONTS.headingSemiBold, fontSize: 22, marginBottom: 6 },
      heading2: { fontFamily: FONTS.headingSemiBold, fontSize: 20, marginBottom: 6 },
      heading3: { fontFamily: FONTS.headingSemiBold, fontSize: 18, marginBottom: 4 },
      bullet_list: { marginBottom: 8 },
      ordered_list: { marginBottom: 8 },
      list_item: { marginBottom: 4 },
      bullet_list_icon: { color: fg, fontFamily: FONTS.sans, fontSize: 16, lineHeight: 22 },
      ordered_list_icon: { color: fg, fontFamily: FONTS.sans, fontSize: 16, lineHeight: 22 },
      hr: { backgroundColor: c.border, height: 1, marginVertical: 8 },
      blockquote: {
        backgroundColor: 'transparent',
        borderLeftWidth: 2,
        borderLeftColor: c.border,
        paddingLeft: 10,
        marginLeft: 0,
      },
      code_inline: {
        fontFamily: 'Menlo',
        fontSize: 14,
        backgroundColor: c.background,
        color: fg,
        borderRadius: 4,
        paddingHorizontal: 4,
      },
      fence: {
        fontFamily: 'Menlo',
        fontSize: 13,
        backgroundColor: c.background,
        color: fg,
        borderColor: c.border,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
      },
      code_block: {
        fontFamily: 'Menlo',
        fontSize: 13,
        backgroundColor: c.background,
        color: fg,
        borderColor: c.border,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
      },
      table: { borderColor: c.border, borderRadius: 6, marginBottom: 8 },
      thead: {},
      th: { fontFamily: FONTS.sansSemiBold, padding: 6 },
      tr: { borderColor: c.border },
      td: { padding: 6 },
      link: { color: fg, textDecorationLine: 'underline' as const },
    }),
    [fg, c]
  );

  return <MarkdownDisplay style={styles}>{children}</MarkdownDisplay>;
}
