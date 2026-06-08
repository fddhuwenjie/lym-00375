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
}

export interface TaskInput {
  id?: string;
  name: string;
  duration: number;
  assignee: string;
  dependsOn: string[];
  manualStart?: number;
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
}

export type ViewMode = 'day' | 'week' | 'month';

export interface CycleError {
  hasCycle: boolean;
  path: string[];
}
