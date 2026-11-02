import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from '../../types';
import { decodeData, initialData } from './schema';
const KEY = '@travel-dna/v1';
export async function readData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? initialData : decodeData(raw);
}
// Single ordered queue: a slower earlier write cannot overwrite a later state.
let writes: Promise<void> = Promise.resolve();
export function writeData(data: AppData): Promise<void> {
  const raw = JSON.stringify(data);
  writes = writes.catch(() => undefined).then(() => AsyncStorage.setItem(KEY, raw));
  return writes;
}
