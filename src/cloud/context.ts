import { createContext } from 'react';
import type { AccountEngine } from './engine';
export const AccountCloudContext = createContext<AccountEngine | null>(null);
