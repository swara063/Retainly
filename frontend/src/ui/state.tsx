import React from 'react';
import { API_BASE, fetchJson } from './api';

export type HRTimelineEntry = { step: string; status: string; message: string };
export type DeveloperDiagnostic = { agent: string; status: string; message: string; timestamp?: string };

export type DatasetMapping = {
  target: string;
  sensitive_attributes: string[];
  numeric_features: string[];
  categorical_features: string[];
};

export type AppState = {
  file: File | null;
  datasetId: string;
  columns: string[];
  rows: number | null;
  mapping: DatasetMapping | null;
  mappingConfirmed: boolean;
  hrTimeline: HRTimelineEntry[];
  developerDiagnostics: DeveloperDiagnostic[];
  results: any | null;
  loading: boolean;
  uploadPct: number;
  phase: 'idle' | 'uploading' | 'analyzing';
  error: string;
};

const initialState: AppState = {
  file: null,
  datasetId: '',
  columns: [],
  rows: null,
  mapping: null,
  mappingConfirmed: false,
  hrTimeline: [],
  developerDiagnostics: [],
  results: null,
  loading: false,
  uploadPct: 0,
  phase: 'idle',
  error: '',
};

function loadInitialState(): AppState {
  try {
    const raw = window.localStorage.getItem('retainly_last_run');
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    return {
      ...initialState,
      datasetId: String(saved.datasetId || ''),
      columns: Array.isArray(saved.columns) ? saved.columns : [],
      rows: typeof saved.rows === 'number' ? saved.rows : null,
      hrTimeline: Array.isArray(saved.hrTimeline) ? saved.hrTimeline : [],
      developerDiagnostics: Array.isArray(saved.developerDiagnostics) ? saved.developerDiagnostics : [],
      results: saved.results || null,
    };
  } catch {
    return initialState;
  }
}

export const AppStateContext = React.createContext<AppState>(initialState);
export const AppDispatchContext = React.createContext<React.Dispatch<React.SetStateAction<AppState>>>(() => {});

export function useAppState() {
  return React.useContext(AppStateContext);
}

export function useAppDispatch() {
  return React.useContext(AppDispatchContext);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(() => loadInitialState());

  React.useEffect(() => {
    if (!state.datasetId) return;
    try {
      const compactResults = state.results ? {
        ...state.results,
        employee_risk_records: Array.isArray(state.results.employee_risk_records) ? state.results.employee_risk_records.slice(0, 200) : state.results.employee_risk_records,
        employee_risk: Array.isArray(state.results.employee_risk) ? state.results.employee_risk.slice(0, 200) : state.results.employee_risk,
      } : null;
      window.localStorage.setItem('retainly_last_run', JSON.stringify({
        datasetId: state.datasetId,
        columns: state.columns,
        rows: state.rows,
        hrTimeline: state.hrTimeline,
        developerDiagnostics: state.developerDiagnostics,
        results: compactResults,
      }));
    } catch {
      // Local storage can fill up; the app can still work from in-memory state.
    }
  }, [state.datasetId, state.columns, state.rows, state.hrTimeline, state.developerDiagnostics, state.results]);

  React.useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!state.datasetId || state.results || state.loading) return;
      try {
        const [results, logs] = await Promise.all([
          fetchJson(`${API_BASE}/analysis/${state.datasetId}/results`),
          fetchJson(`${API_BASE}/analysis/${state.datasetId}/logs`).catch(() => ({ hr_timeline: [], developer_diagnostics: [] })),
        ]);
        if (cancelled) return;
        setState((p) => ({
          ...p,
          results,
          hrTimeline: Array.isArray((logs as any).hr_timeline) ? (logs as any).hr_timeline : p.hrTimeline,
          developerDiagnostics: Array.isArray((logs as any).developer_diagnostics) ? (logs as any).developer_diagnostics : p.developerDiagnostics,
        }));
      } catch {
        // No completed run available yet.
      }
    }
    hydrate();
    return () => { cancelled = true; };
  }, [state.datasetId, state.results, state.loading]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={setState}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}
