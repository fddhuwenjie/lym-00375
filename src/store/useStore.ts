import { create } from 'zustand';
import type {
  Task,
  TaskInput,
  ScheduleResult,
  ProjectConfig,
  ViewMode,
  Baseline,
  BaselineComparison,
  Resource,
  ResourceAllocation,
  Calendar,
  Template,
  Project,
  ProjectHealth,
  ImportResult,
} from '@shared/types';

interface AppState {
  tasks: Task[];
  criticalPaths: string[][];
  conflicts: ScheduleResult['conflicts'];
  totalDuration: number;
  projectEndDate: string;
  resourceAllocations: ResourceAllocation[];
  overloadedResources: string[];
  config: ProjectConfig;
  selectedTaskId: string | null;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  
  currentProject: Project | null;
  currentProjectId: string;
  projects: Project[];
  baselines: Baseline[];
  selectedBaselineId: string | null;
  baselineComparison: BaselineComparison | null;
  resources: Resource[];
  calendars: Calendar[];
  templates: Template[];
  projectHealth: ProjectHealth | null;
  
  activeTab: 'gantt' | 'baselines' | 'resources' | 'calendars' | 'templates';

  fetchData: () => Promise<void>;
  fetchAll: () => Promise<void>;
  createTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  updateTaskProgress: (id: string, progress: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateConfig: (startDate: string) => Promise<void>;
  setSelectedTaskId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  clearError: () => void;
  clearWarning: () => void;
  
  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  setCurrentProjectId: (projectId: string) => void;
  
  fetchBaselines: () => Promise<void>;
  createBaseline: (name: string) => Promise<void>;
  deleteBaseline: (id: string) => Promise<void>;
  selectBaseline: (id: string | null) => Promise<void>;
  fetchBaselineComparison: (baselineId: string) => Promise<void>;
  
  fetchResources: () => Promise<void>;
  fetchResourceAllocations: () => Promise<void>;
  createResource: (name: string, dailyCapacity?: number) => Promise<void>;
  updateResource: (id: string, name: string, dailyCapacity?: number) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  
  fetchCalendars: () => Promise<void>;
  createCalendar: (name: string, weekendPattern?: number[], holidays?: string[]) => Promise<void>;
  updateCalendar: (id: string, name: string, weekendPattern?: number[], holidays?: string[]) => Promise<void>;
  deleteCalendar: (id: string) => Promise<void>;
  importICS: (calendarId: string, content: string) => Promise<void>;
  
  fetchTemplates: () => Promise<void>;
  createTemplate: (name: string, description: string, tasks: TaskInput[]) => Promise<void>;
  createTemplateFromProject: (name: string, description: string) => Promise<void>;
  applyTemplate: (templateId: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  importProject: (format: 'xml' | 'csv', content: string) => Promise<ImportResult>;
  exportProject: (format: 'png' | 'pdf' | 'csv' | 'xml') => Promise<void>;
  downloadExport: (format: 'csv' | 'xml') => Promise<void>;
  
  fetchProjectHealth: (projectId: string) => Promise<void>;
  
  setActiveTab: (tab: AppState['activeTab']) => void;
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

export const useStore = create<AppState>((set, get) => ({
  tasks: [],
  criticalPaths: [],
  conflicts: [],
  totalDuration: 0,
  projectEndDate: '',
  resourceAllocations: [],
  overloadedResources: [],
  config: { startDate: new Date().toISOString().split('T')[0] },
  selectedTaskId: null,
  viewMode: 'day',
  isLoading: false,
  error: null,
  warning: null,
  
  currentProject: null,
  currentProjectId: 'default',
  projects: [],
  baselines: [],
  selectedBaselineId: null,
  baselineComparison: null,
  resources: [],
  calendars: [],
  templates: [],
  projectHealth: null,
  
  activeTab: 'gantt',

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
        resourceAllocations: schedule.resourceAllocations || [],
        overloadedResources: schedule.overloadedResources || [],
        config,
        isLoading: false,
        warning: (schedule as any).warning || null,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [schedule, config, projects, resources, calendars, templates] = await Promise.all([
        apiRequest<ScheduleResult>('/tasks'),
        apiRequest<ProjectConfig>('/config'),
        apiRequest<Project[]>('/projects'),
        apiRequest<Resource[]>('/resources'),
        apiRequest<Calendar[]>('/calendars'),
        apiRequest<Template[]>('/templates'),
      ]);
      
      const defaultProject = projects.find(p => p.id === 'default') || projects[0] || null;
      
      set({
        tasks: schedule.tasks,
        criticalPaths: schedule.criticalPaths,
        conflicts: schedule.conflicts,
        totalDuration: schedule.totalDuration,
        projectEndDate: schedule.projectEndDate,
        resourceAllocations: schedule.resourceAllocations || [],
        overloadedResources: schedule.overloadedResources || [],
        config,
        projects,
        resources,
        calendars,
        templates,
        currentProject: defaultProject,
        currentProjectId: defaultProject?.id || 'default',
        isLoading: false,
        warning: (schedule as any).warning || null,
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
        resourceAllocations: result.resourceAllocations || [],
        overloadedResources: result.overloadedResources || [],
        isLoading: false,
        warning: (result as any).warning || null,
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
        resourceAllocations: result.resourceAllocations || [],
        overloadedResources: result.overloadedResources || [],
        isLoading: false,
        warning: (result as any).warning || null,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateTaskProgress: async (id, progress) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRequest<ScheduleResult>(`/tasks/${id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ progress }),
      });
      set({
        tasks: result.tasks,
        criticalPaths: result.criticalPaths,
        conflicts: result.conflicts,
        totalDuration: result.totalDuration,
        projectEndDate: result.projectEndDate,
        resourceAllocations: result.resourceAllocations || [],
        overloadedResources: result.overloadedResources || [],
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
        resourceAllocations: result.resourceAllocations || [],
        overloadedResources: result.overloadedResources || [],
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
  clearWarning: () => set({ warning: null }),

  fetchProjects: async () => {
    try {
      const projects = await apiRequest<Project[]>('/projects');
      set({ projects });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  setCurrentProjectId: (projectId) => {
    const { projects, fetchData } = get();
    const project = projects.find(p => p.id === projectId) || null;
    set({ currentProjectId: projectId, currentProject: project });
    fetchData();
  },

  fetchBaselines: async () => {
    try {
      const baselines = await apiRequest<Baseline[]>('/baselines');
      set({ baselines });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createBaseline: async (name) => {
    set({ isLoading: true });
    try {
      const baseline = await apiRequest<Baseline>('/baselines', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      set((state) => ({
        baselines: [baseline, ...state.baselines],
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteBaseline: async (id) => {
    try {
      await apiRequest(`/baselines/${id}`, { method: 'DELETE' });
      set((state) => ({
        baselines: state.baselines.filter(b => b.id !== id),
        selectedBaselineId: state.selectedBaselineId === id ? null : state.selectedBaselineId,
        baselineComparison: state.selectedBaselineId === id ? null : state.baselineComparison,
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  selectBaseline: async (id) => {
    set({ selectedBaselineId: id });
    if (id) {
      await get().fetchBaselineComparison(id);
    } else {
      set({ baselineComparison: null });
    }
  },

  fetchBaselineComparison: async (baselineId) => {
    try {
      const comparison = await apiRequest<BaselineComparison>(`/baselines/${baselineId}/compare`);
      set({ baselineComparison: comparison });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchResources: async () => {
    try {
      const resources = await apiRequest<Resource[]>('/resources');
      set({ resources });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchResourceAllocations: async () => {
    try {
      const result = await apiRequest<{ allocations: ResourceAllocation[]; overloaded: string[] }>('/resources/allocations');
      set({
        resourceAllocations: result.allocations,
        overloadedResources: result.overloaded,
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createResource: async (name, dailyCapacity = 8) => {
    try {
      const resource = await apiRequest<Resource>('/resources', {
        method: 'POST',
        body: JSON.stringify({ name, dailyCapacity }),
      });
      set((state) => ({
        resources: [...state.resources, resource],
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateResource: async (id, name, dailyCapacity = 8) => {
    try {
      const resource = await apiRequest<Resource>(`/resources/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, dailyCapacity }),
      });
      set((state) => ({
        resources: state.resources.map(r => r.id === id ? resource : r),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteResource: async (id) => {
    try {
      await apiRequest(`/resources/${id}`, { method: 'DELETE' });
      set((state) => ({
        resources: state.resources.filter(r => r.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchCalendars: async () => {
    try {
      const calendars = await apiRequest<Calendar[]>('/calendars');
      set({ calendars });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createCalendar: async (name, weekendPattern = [0, 6], holidays = []) => {
    try {
      const calendar = await apiRequest<Calendar>('/calendars', {
        method: 'POST',
        body: JSON.stringify({ name, weekendPattern, holidays }),
      });
      set((state) => ({
        calendars: [...state.calendars, calendar],
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateCalendar: async (id, name, weekendPattern, holidays) => {
    try {
      const calendar = await apiRequest<Calendar>(`/calendars/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, weekendPattern, holidays }),
      });
      set((state) => ({
        calendars: state.calendars.map(c => c.id === id ? calendar : c),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteCalendar: async (id) => {
    try {
      await apiRequest(`/calendars/${id}`, { method: 'DELETE' });
      set((state) => ({
        calendars: state.calendars.filter(c => c.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  importICS: async (calendarId, content) => {
    try {
      const result = await apiRequest<{ success: boolean; calendar: Calendar; message: string }>(`/calendars/${calendarId}/import-ics`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      set((state) => ({
        calendars: state.calendars.map(c => c.id === calendarId ? result.calendar : c),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await apiRequest<Template[]>('/templates');
      set({ templates });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createTemplate: async (name, description, tasks) => {
    try {
      const template = await apiRequest<Template>('/templates', {
        method: 'POST',
        body: JSON.stringify({ name, description, tasks }),
      });
      set((state) => ({
        templates: [...state.templates, template],
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  createTemplateFromProject: async (name, description) => {
    try {
      const template = await apiRequest<Template>('/templates/from-project', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      set((state) => ({
        templates: [...state.templates, template],
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  applyTemplate: async (templateId) => {
    set({ isLoading: true });
    try {
      const result = await apiRequest<{ tasksCreated: number; schedule: ScheduleResult }>(`/templates/${templateId}/apply`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      set({
        tasks: result.schedule.tasks,
        criticalPaths: result.schedule.criticalPaths,
        conflicts: result.schedule.conflicts,
        totalDuration: result.schedule.totalDuration,
        projectEndDate: result.schedule.projectEndDate,
        resourceAllocations: result.schedule.resourceAllocations || [],
        overloadedResources: result.schedule.overloadedResources || [],
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteTemplate: async (id) => {
    try {
      await apiRequest(`/templates/${id}`, { method: 'DELETE' });
      set((state) => ({
        templates: state.templates.filter(t => t.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  importProject: async (format, content) => {
    set({ isLoading: true });
    try {
      const result = await apiRequest<ImportResult & { schedule: ScheduleResult }>('/projects/default/import', {
        method: 'POST',
        body: JSON.stringify({ format, content }),
      });
      
      if (result.success && result.schedule) {
        set({
          tasks: result.schedule.tasks,
          criticalPaths: result.schedule.criticalPaths,
          conflicts: result.schedule.conflicts,
          totalDuration: result.schedule.totalDuration,
          projectEndDate: result.schedule.projectEndDate,
          resourceAllocations: result.schedule.resourceAllocations || [],
          overloadedResources: result.schedule.overloadedResources || [],
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
      
      return result;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  exportProject: async (format) => {
    if (format === 'png' || format === 'pdf') {
      alert(`${format.toUpperCase()} 导出请使用甘特图上的导出按钮`);
      return;
    }
    await get().downloadExport(format);
  },

  downloadExport: async (format) => {
    try {
      const res = await fetch(`${API_BASE}/projects/default/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `项目.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchProjectHealth: async (projectId: string) => {
    try {
      const health = await apiRequest<ProjectHealth>(`/projects/${projectId}/health`);
      set({ projectHealth: health });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
