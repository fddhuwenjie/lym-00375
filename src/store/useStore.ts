import { create } from 'zustand';
import type { Task, TaskInput, ScheduleResult, ProjectConfig, ViewMode } from '@shared/types';

interface AppState {
  tasks: Task[];
  criticalPaths: string[][];
  conflicts: ScheduleResult['conflicts'];
  totalDuration: number;
  projectEndDate: string;
  config: ProjectConfig;
  selectedTaskId: string | null;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string | null;

  fetchData: () => Promise<void>;
  createTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateConfig: (startDate: string) => Promise<void>;
  setSelectedTaskId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  clearError: () => void;
}

const API_BASE = '/api';

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

export const useStore = create<AppState>((set) => ({
  tasks: [],
  criticalPaths: [],
  conflicts: [],
  totalDuration: 0,
  projectEndDate: '',
  config: { startDate: new Date().toISOString().split('T')[0] },
  selectedTaskId: null,
  viewMode: 'day',
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [schedule, config] = await Promise.all([
        apiRequest<ScheduleResult>('/tasks'),
        apiRequest<ProjectConfig>('/config'),
      ]);
      set({
        tasks: schedule.tasks,
        criticalPaths: schedule.criticalPaths,
        conflicts: schedule.conflicts,
        totalDuration: schedule.totalDuration,
        projectEndDate: schedule.projectEndDate,
        config,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createTask: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRequest<ScheduleResult>('/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      set({
        tasks: result.tasks,
        criticalPaths: result.criticalPaths,
        conflicts: result.conflicts,
        totalDuration: result.totalDuration,
        projectEndDate: result.projectEndDate,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateTask: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRequest<ScheduleResult>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      set({
        tasks: result.tasks,
        criticalPaths: result.criticalPaths,
        conflicts: result.conflicts,
        totalDuration: result.totalDuration,
        projectEndDate: result.projectEndDate,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRequest<ScheduleResult>(`/tasks/${id}`, {
        method: 'DELETE',
      });
      set({
        tasks: result.tasks,
        criticalPaths: result.criticalPaths,
        conflicts: result.conflicts,
        totalDuration: result.totalDuration,
        projectEndDate: result.projectEndDate,
        selectedTaskId: null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateConfig: async (startDate) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRequest<ScheduleResult>('/config', {
        method: 'PUT',
        body: JSON.stringify({ startDate }),
      });
      set({
        tasks: result.tasks,
        criticalPaths: result.criticalPaths,
        conflicts: result.conflicts,
        totalDuration: result.totalDuration,
        projectEndDate: result.projectEndDate,
        config: { startDate },
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  clearError: () => set({ error: null }),
}));
