import { createContext } from 'react';
import type { SyncEngine } from './engine';
export const SyncContext = createContext<SyncEngine | null>(null);
