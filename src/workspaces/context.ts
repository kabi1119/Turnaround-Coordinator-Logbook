import { createContext, useContext } from 'react';
import { guestStore } from './store';
export const WorkspaceContext = createContext(guestStore);
export const useWorkspaceStore = () => useContext(WorkspaceContext);
