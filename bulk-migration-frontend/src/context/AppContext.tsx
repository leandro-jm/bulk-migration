import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { Connection, Migration, Stats, MigrationRule } from '../types';
type ViewType = string;

interface AppState {
  currentView: ViewType;
  connections: Connection[];
  migrations: Migration[];
  stats: Stats;
  selectedCollections: string[];
  globalRule: MigrationRule;
  error: string | null;
  loading: boolean;
}

type AppAction =
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SET_CONNECTIONS'; payload: Connection[] }
  | { type: 'ADD_CONNECTION'; payload: Connection }
  | { type: 'REMOVE_CONNECTION'; payload: string }
  | { type: 'SET_MIGRATIONS'; payload: Migration[] }
  | { type: 'SET_STATS'; payload: Stats }
  | { type: 'SET_SELECTED_COLLECTIONS'; payload: string[] }
  | { type: 'TOGGLE_COLLECTION'; payload: string }
  | { type: 'SET_GLOBAL_RULE'; payload: MigrationRule }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: AppState = {
  currentView: 'dashboard',
  connections: [],
  migrations: [],
  stats: { total: 0, completed: 0, failed: 0, running: 0 },
  selectedCollections: [],
  globalRule: 'overwrite',
  error: null,
  loading: false
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.payload };
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.payload] };
    case 'REMOVE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter(c => c.id !== action.payload)
      };
    case 'SET_MIGRATIONS':
      return { ...state, migrations: action.payload };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_SELECTED_COLLECTIONS':
      return { ...state, selectedCollections: action.payload };
    case 'TOGGLE_COLLECTION':
      return {
        ...state,
        selectedCollections: state.selectedCollections.includes(action.payload)
          ? state.selectedCollections.filter(c => c !== action.payload)
          : [...state.selectedCollections, action.payload]
      };
    case 'SET_GLOBAL_RULE':
      return { ...state, globalRule: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}