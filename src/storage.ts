import { Preferences } from '@capacitor/preferences';
import { sampleData, validateAppData, type AppData } from './model';

const KEY = 'naekivo-trips-v1';
export async function loadData(): Promise<AppData> {
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return structuredClone(sampleData);
  const parsed: unknown = JSON.parse(value);
  if (!validateAppData(parsed)) throw new Error('Your saved data could not be read. Export or restore a backup before continuing.');
  return parsed as AppData;
}
let saveQueue: Promise<void> = Promise.resolve();
export function saveData(data: AppData): Promise<void> {
  const value = JSON.stringify(data);
  saveQueue = saveQueue.catch(() => {}).then(() => Preferences.set({ key: KEY, value }));
  return saveQueue;
}
