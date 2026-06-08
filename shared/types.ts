export interface Task {
  id: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  isCritical: boolean;
  startDate: string;
  endDate: string;
  manualStart?: number;
  projectId?: string;
  progress?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  calendarId?: string;
  timeOff?: string[];
}

export interface TaskInput {
  id?: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  manualStart?: number;
  projectId?: string;
  progress?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  calendarId?: string;
  timeOff?: string[];
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  calendarId?: string;
}

export interface ProjectInput {
  id?: string;
  name: string;
  color: string;
  calendarId?: string;
}

export interface Resource {
  id: string;
  name: string;
  dailyCapacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceInput {
  id?: string;
  name: string;
  dailyCapacity?: number;
}

export interface ResourceAllocation {
  assignee: string;
  date: string;
  projects: { projectId: string; projectName: string; taskId: string; taskName: string; hours: number }[];
  totalHours: number;
  isOverloaded: boolean;
}

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  tasks: BaselineTask[];
  totalDuration: number;
  projectEndDate: string;
  criticalPaths: string[][];
}

export interface BaselineTask {
  taskId: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  isCritical: boolean;
}

export interface BaselineComparison {
  baselineId: string;
  baselineName: string;
  projectDurationChange: number;
  projectEndDateChange: number;
  taskComparisons: TaskComparison[];
  criticalPathChanges: {
    toCritical: string[];
    fromCritical: string[];
  };
}

export interface TaskComparison {
  taskId: string;
  taskName: string;
  startDateDiff: number;
  endDateDiff: number;
  durationDiff: number;
  isCriticalChanged: boolean;
  wasCritical: boolean;
  isCritical: boolean;
}

export interface Calendar {
  id: string;
  name: string;
  weekendPattern: number[];
  holidays: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarInput {
  id?: string;
  name: string;
  weekendPattern?: number[];
  holidays?: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  tasks: TaskInput[];
  createdAt: string;
}

export interface TemplateInput {
  id?: string;
  name: string;
  description: string;
  isDefault?: boolean;
  tasks: TaskInput[];
}

export interface ProjectConfig {
  startDate: string;
}

export interface ResourceConflict {
  assignee: string;
  tasks: string[];
  startDay: number;
  endDay: number;
}

export interface ScheduleResult {
  tasks: Task[];
  criticalPaths: string[][];
  conflicts: ResourceConflict[];
  totalDuration: number;
  projectEndDate: string;
  resourceAllocations?: ResourceAllocation[];
  overloadedResources?: string[];
}

export type ViewMode = 'day' | 'week' | 'month';

export interface CycleError {
  hasCycle: boolean;
  path: string[];
}

export interface ProjectHealth {
  projectId: string;
  projectName: string;
  onTimeCompletionRate: number;
  averageDelayDays: number;
  criticalPathCompletion: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  progress: number;
}

export type ExportFormat = 'png' | 'pdf' | 'csv' | 'xml';
export type ImportFormat = 'xml' | 'csv';

export interface ImportResult {
  success: boolean;
  tasksCreated: number;
  dependenciesCreated: number;
  resourcesCreated: number;
  warnings: string[];
  errors: string[];
}
