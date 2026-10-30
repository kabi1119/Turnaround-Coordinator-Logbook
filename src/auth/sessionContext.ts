import { createContext } from 'react';
/** UI status only. Every upload still independently verifies its account/token in transport. */
export const SessionVerificationContext = createContext(true);
