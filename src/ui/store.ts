import { useSyncExternalStore } from 'react';
import { SaveStore, type SaveData } from '../save/save';

const store = new SaveStore();

export function useSave(): SaveData {
  return useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => store.data,
  );
}

export function updateSave(fn: (d: SaveData) => void): void {
  store.update(fn);
}

export function saveStore(): SaveStore {
  return store;
}
