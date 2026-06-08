import * as repo from '../repositories/templateRepository';
import * as taskRepo from '../repositories/taskRepository';
import type { Template, TemplateInput, TaskInput } from '../../shared/types';

export function getAllTemplates(): Template[] {
  return repo.getAllTemplates();
}

export function getTemplateById(id: string): Template | null {
  return repo.getTemplateById(id);
}

export function createTemplate(input: TemplateInput): Template {
  return repo.createTemplate(input);
}

export function updateTemplate(id: string, input: TemplateInput): Template {
  return repo.updateTemplate(id, input);
}

export function deleteTemplate(id: string): boolean {
  return repo.deleteTemplate(id);
}

export function createTemplateFromProject(
  name: string,
  description: string,
  projectId: string = 'default'
): Template {
  const tasks = taskRepo.getAllTasks(projectId);
  const taskInputs: TaskInput[] = tasks.map(t => ({
    name: t.name,
    duration: t.duration,
    assignee: t.assignee,
    dependsOn: t.dependsOn,
  }));
  return repo.createTemplateFromProject(name, description, taskInputs);
}

export function applyTemplateToProject(
  templateId: string,
  projectId: string = 'default'
): { tasksCreated: number } {
  const template = repo.getTemplateById(templateId);
  if (!template) throw new Error('Template not found');

  const existingTasks = taskRepo.getAllTasks(projectId);
  const existingIds = new Set(existingTasks.map(t => t.id));
  
  let idCounter = 1;
  const generateId = () => {
    while (existingIds.has(`T${idCounter}`)) {
      idCounter++;
    }
    return `T${idCounter}`;
  };

  const taskIdMap = new Map<string, string>();
  let tasksCreated = 0;

  for (const task of template.tasks) {
    const newId = generateId();
    taskIdMap.set(task.name, newId);
    existingIds.add(newId);

    const newDependsOn = task.dependsOn
      .map(depName => taskIdMap.get(depName) || depName)
      .filter(depId => existingIds.has(depId) || taskIdMap.has(depId));

    taskRepo.createTask({
      id: newId,
      name: task.name,
      duration: task.duration,
      assignee: task.assignee,
      dependsOn: newDependsOn,
      projectId,
    });
    tasksCreated++;
  }

  return { tasksCreated };
}
