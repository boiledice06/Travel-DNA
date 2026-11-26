import { StyleSheet } from 'react-native';
import { theme } from '../../theme';
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  image: { width: '100%', aspectRatio: 1.35 },
  noImage: {
    height: 200,
    backgroundColor: theme.colors.pale,
  },
  back: { position: 'absolute', left: 20 },
  photoCredit: { borderLeftWidth: 2, borderColor: theme.colors.line, paddingLeft: 12, gap: 3 },
  photoLink: { color: theme.colors.primary, textDecorationLine: 'underline' },
  body: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    gap: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  score: { fontSize: 40, fontWeight: '700', color: theme.colors.primary, letterSpacing: -2 },
  reason: {
    padding: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.pale,
    gap: 10,
  },
  feature: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
