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

export type AnalysisProgress = { dataset_id?: string; status?: string; percent?: number; current_agent?: string; current_step?: string; elapsed_seconds?: number; estimated_total_seconds?: number; estimated_remaining_seconds?: number; steps?: Array<{ name: string; status: string; percent: number }> };

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
  modelTrust: any | null;
  loading: boolean;
  uploadPct: number;
  phase: 'idle' | 'uploaded' | 'uploading' | 'analyzing' | 'completed' | 'failed';
  error: string;
  progress: AnalysisProgress | null;
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
  modelTrust: null,
  loading: false,
  uploadPct: 0,
  phase: 'idle',
  error: '',
  progress: null,
};

export const AppStateContext = React.createContext<AppState>(initialState);
export const AppDispatchContext = React.createContext<React.Dispatch<React.SetStateAction<AppState>>>(() => {});

export function useAppState() {
  return React.useContext(AppStateContext);
}

export function useAppDispatch() {
  return React.useContext(AppDispatchContext);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(initialState);

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
        const hasValidEmployeeRisk = Array.isArray((results as any)?.employee_risk);
        setState((p) => ({
          ...p,
          results,
          modelTrust: (results as any)?.model_trust || p.modelTrust,
          hrTimeline: Array.isArray((logs as any).hr_timeline) ? (logs as any).hr_timeline : p.hrTimeline,
          developerDiagnostics: Array.isArray((logs as any).developer_diagnostics) ? (logs as any).developer_diagnostics : p.developerDiagnostics,
          phase: (results as any)?.status === 'completed' ? 'completed' : p.phase,
          error: hasValidEmployeeRisk || (results as any)?.status !== 'completed' ? p.error : 'Analysis completed but employee risk results are missing. Please check backend output.',
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
