import { StyleSheet } from 'react-native';
import { theme } from '../../theme';
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  image: { width: '100%', height: 330 },
  back: { position: 'absolute', left: 20 },
  imageCaption: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    backgroundColor: '#ffffffd9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  body: {
    backgroundColor: theme.colors.background,
    padding: 24,
    marginTop: -10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    gap: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  score: { fontSize: 40, fontWeight: '700', color: theme.colors.primary, letterSpacing: -2 },
  reason: { padding: 20, borderRadius: 22, backgroundColor: '#EAF4F6', gap: 10 },
  feature: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
