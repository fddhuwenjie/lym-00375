import { useState } from 'react';
import { Edit2, Trash2, GripVertical, AlertTriangle, ChevronDown } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Task, Project } from '@shared/types';

interface TaskTableProps {
  onEditTask: (task: Task) => void;
}

function isOverdue(task: Task): boolean {
  if ((task.progress ?? 0) >= 100) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(task.endDate);
  endDate.setHours(0, 0, 0, 0);
  return endDate < today;
}

function getProjectById(projects: Project[], projectId?: string): Project | undefined {
  if (!projectId) return undefined;
  return projects.find(p => p.id === projectId);
}

export function TaskTable({ onEditTask }: TaskTableProps) {
  const {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    deleteTask,
    conflicts,
    projects,
    updateTaskProgress,
  } = useStore();

  const [showProgressMenu, setShowProgressMenu] = useState<string | null>(null);

  const taskConflicts = new Map<string, typeof conflicts>();
  for (const c of conflicts) {
    for (const taskId of c.tasks) {
      if (!taskConflicts.has(taskId)) {
        taskConflicts.set(taskId, []);
      }
      taskConflicts.get(taskId)!.push(c);
    }
  }

  const handleRowClick = (taskId: string) => {
    setSelectedTaskId(selectedTaskId === taskId ? null : taskId);
    setShowProgressMenu(null);
  };

  const handleDelete = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个任务吗？')) {
      deleteTask(taskId);
    }
  };

  const handleEdit = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    onEditTask(task);
  };

  const handleProgressMenuClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setShowProgressMenu(showProgressMenu === taskId ? null : taskId);
  };

  const handleQuickProgress = (e: React.MouseEvent, taskId: string, progress: number) => {
    e.stopPropagation();
    updateTaskProgress(taskId, progress);
    setShowProgressMenu(null);
  };

  const handleProgressBarClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = Math.min(100, Math.max(0, Math.round((x / width) * 100)));
    updateTaskProgress(taskId, progress);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aStart = a.manualStart !== undefined ? a.manualStart : a.es;
    const bStart = b.manualStart !== undefined ? b.manualStart : b.es;
    return aStart - bStart;
  });

  const progressOptions = [25, 50, 75, 100];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 bg-primary-800/50 border-b border-primary-400/20">
        <h2 className="font-display text-lg font-semibold text-white">任务列表</h2>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="task-table w-full text-sm">
          <thead className="bg-primary-800/70 sticky top-0">
            <tr className="text-left text-primary-200">
              <th className="px-3 py-2.5 font-medium w-8"></th>
              <th className="px-3 py-2.5 font-medium w-16">ID</th>
              <th className="px-3 py-2.5 font-medium">任务名称</th>
              <th className="px-3 py-2.5 font-medium w-32">项目</th>
              <th className="px-3 py-2.5 font-medium w-20 text-center">工期</th>
              <th className="px-3 py-2.5 font-medium w-24">负责人</th>
              <th className="px-3 py-2.5 font-medium w-28">依赖</th>
              <th className="px-3 py-2.5 font-medium w-20 text-center">时差</th>
              <th className="px-3 py-2.5 font-medium w-32 text-center">进度</th>
              <th className="px-3 py-2.5 font-medium w-24 text-center">开始</th>
              <th className="px-3 py-2.5 font-medium w-24 text-center">结束</th>
              <th className="px-3 py-2.5 font-medium w-20 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task) => {
              const hasConflict = taskConflicts.has(task.id);
              const isSelected = selectedTaskId === task.id;
              const progress = task.progress ?? 0;
              const overdue = isOverdue(task);
              const project = getProjectById(projects, task.projectId);

              return (
                <tr
                  key={task.id}
                  onClick={() => handleRowClick(task.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-normal-600/20'
                      : 'hover:bg-primary-700/30'
                  } ${task.isCritical ? 'bg-critical-900/10' : ''} ${overdue ? 'bg-overdue-900/10' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <GripVertical className="w-4 h-4 text-primary-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${
                      task.isCritical
                        ? 'bg-critical-600 text-white'
                        : overdue
                        ? 'bg-overdue-600 text-white'
                        : 'bg-normal-600 text-white'
                    }`}>
                      {task.id}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`${
                        overdue ? 'text-overdue-400' : task.isCritical ? 'text-critical-300 font-medium' : 'text-white'
                      }`}>
                        {task.name}
                      </span>
                      {hasConflict && (
                        <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {project ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        ></div>
                        <span className="text-primary-200 text-xs truncate">
                          {project.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-primary-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-primary-200">
                    {task.duration} 天
                  </td>
                  <td className="px-3 py-2.5 text-primary-200">
                    <span className="px-2 py-0.5 bg-primary-700/50 rounded text-xs">
                      {task.assignee}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {task.dependsOn.length === 0 ? (
                        <span className="text-primary-500 text-xs">-</span>
                      ) : (
                        task.dependsOn.map((dep) => {
                          const depTask = tasks.find(t => t.id === dep);
                          return (
                            <span
                              key={dep}
                              className={`px-1.5 py-0.5 rounded text-xs ${
                                depTask?.isCritical
                                  ? 'bg-critical-900/50 text-critical-300'
                                  : 'bg-primary-700/50 text-primary-300'
                              }`}
                            >
                              {dep}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-center ${
                    task.slack === 0 ? 'text-critical-400 font-semibold' : 'text-primary-300'
                  }`}>
                    {task.slack}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 h-1.5 bg-primary-700/50 rounded-full overflow-hidden mr-2 cursor-pointer group"
                          onClick={(e) => handleProgressBarClick(e, task.id)}
                        >
                          <div 
                            className={`h-full rounded-full transition-all ${
                              overdue ? 'bg-overdue-500' : progress >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-medium min-w-[36px] text-right ${
                          overdue ? 'text-overdue-400' : progress >= 100 ? 'text-emerald-400' : 'text-primary-200'
                        }`}>
                          {progress}%
                        </span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => handleProgressMenuClick(e, task.id)}
                          className="w-full flex items-center justify-center gap-1 px-2 py-0.5 text-[10px] bg-primary-700/30 hover:bg-primary-600/50 text-primary-300 rounded transition-colors"
                        >
                          完成
                          <ChevronDown className={`w-3 h-3 transition-transform ${
                            showProgressMenu === task.id ? 'rotate-180' : ''
                          }`} />
                        </button>
                        {showProgressMenu === task.id && (
                          <div 
                            className="absolute bottom-full left-0 mb-1 bg-primary-800 border border-primary-600/50 rounded-md shadow-lg z-10 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {progressOptions.map((p) => (
                              <button
                                key={p}
                                onClick={(e) => handleQuickProgress(e, task.id, p)}
                                className={`w-full px-4 py-1.5 text-xs text-left hover:bg-primary-700/50 transition-colors ${
                                  progress === p ? 'bg-primary-700/50 text-emerald-400' : 'text-primary-200'
                                }`}
                              >
                                完成 {p}%
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-primary-200 text-xs">
                    {task.startDate}
                  </td>
                  <td className={`px-3 py-2.5 text-center text-xs ${
                    overdue ? 'text-overdue-400 font-medium' : 'text-primary-200'
                  }`}>
                    {task.endDate}
                    {overdue && (
                      <div className="text-[10px] text-overdue-400 mt-0.5">逾期</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => handleEdit(e, task)}
                        className="p-1.5 text-primary-400 hover:text-white hover:bg-primary-600 rounded transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, task.id)}
                        className="p-1.5 text-primary-400 hover:text-critical-400 hover:bg-critical-900/30 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-primary-400">
            暂无任务，点击"新增任务"开始
          </div>
        )}
      </div>
    </div>
  );
}
