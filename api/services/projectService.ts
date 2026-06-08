import * as repo from '../repositories/projectRepository';
import type { Project, ProjectInput } from '../../shared/types';

export function getAllProjects(): Project[] {
  return repo.getAllProjects();
}

export function getProjectById(id: string): Project | null {
  return repo.getProjectById(id);
}

export function createProject(input: ProjectInput): Project {
  return repo.createProject(input);
}

export function updateProject(id: string, input: ProjectInput): Project {
  return repo.updateProject(id, input);
}

export function deleteProject(id: string): boolean {
  return repo.deleteProject(id);
}
