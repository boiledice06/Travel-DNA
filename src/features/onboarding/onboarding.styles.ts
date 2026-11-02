import { StyleSheet } from 'react-native';
import { theme as t } from '../../theme';
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.background },
  hero: {
    height: 370,
    overflow: 'hidden',
    backgroundColor: '#DDE9EE',
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
  },
  heroPhoto: { width: '100%', height: '100%', opacity: 0.85 },
  heroShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: '#174A7E99',
    padding: 28,
    justifyContent: 'flex-end',
  },
  heroTitle: { fontSize: 44, fontWeight: '700', color: '#fff', letterSpacing: -2 },
  logo: {
    position: 'absolute',
    top: 25,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#ffffffea',
  },
  content: { padding: 28, gap: 20 },
});
