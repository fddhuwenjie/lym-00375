import { Edit2, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Task } from '@shared/types';

interface TaskTableProps {
  onEditTask: (task: Task) => void;
}

export function TaskTable({ onEditTask }: TaskTableProps) {
  const {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    deleteTask,
    conflicts,
  } = useStore();

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

  const sortedTasks = [...tasks].sort((a, b) => {
    const aStart = a.manualStart !== undefined ? a.manualStart : a.es;
    const bStart = b.manualStart !== undefined ? b.manualStart : b.es;
    return aStart - bStart;
  });

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
              <th className="px-3 py-2.5 font-medium w-20 text-center">工期</th>
              <th className="px-3 py-2.5 font-medium w-24">负责人</th>
              <th className="px-3 py-2.5 font-medium w-28">依赖</th>
              <th className="px-3 py-2.5 font-medium w-20 text-center">时差</th>
              <th className="px-3 py-2.5 font-medium w-24 text-center">开始</th>
              <th className="px-3 py-2.5 font-medium w-24 text-center">结束</th>
              <th className="px-3 py-2.5 font-medium w-20 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task) => {
              const hasConflict = taskConflicts.has(task.id);
              const isSelected = selectedTaskId === task.id;
              const start = task.manualStart !== undefined ? task.manualStart : task.es;
              const end = start + task.duration;

              return (
                <tr
                  key={task.id}
                  onClick={() => handleRowClick(task.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-normal-600/20'
                      : 'hover:bg-primary-700/30'
                  } ${task.isCritical ? 'bg-critical-900/10' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <GripVertical className="w-4 h-4 text-primary-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${
                      task.isCritical
                        ? 'bg-critical-600 text-white'
                        : 'bg-normal-600 text-white'
                    }`}>
                      {task.id}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={task.isCritical ? 'text-critical-300 font-medium' : 'text-white'}>
                        {task.name}
                      </span>
                      {hasConflict && (
                        <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0" />
                      )}
                    </div>
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
                  <td className="px-3 py-2.5 text-center text-primary-200 text-xs">
                    {task.startDate}
                  </td>
                  <td className="px-3 py-2.5 text-center text-primary-200 text-xs">
                    {task.endDate}
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
