import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Task, TaskInput } from '@shared/types';

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskEditModal({ task, isOpen, onClose }: TaskEditModalProps) {
  const { tasks, projects, calendars, createTask, updateTask } = useStore();
  const [formData, setFormData] = useState<TaskInput>({
    name: '',
    duration: 1,
    assignee: '',
    dependsOn: [],
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!task;
  const availableDependencies = tasks.filter(t => t.id !== task?.id);

  useEffect(() => {
    if (task) {
      setFormData({
        id: task.id,
        name: task.name,
        duration: task.duration,
        assignee: task.assignee,
        dependsOn: [...task.dependsOn],
        manualStart: task.manualStart,
        progress: task.progress,
        actualStartDate: task.actualStartDate,
        actualEndDate: task.actualEndDate,
        projectId: task.projectId,
        calendarId: task.calendarId,
      });
    } else {
      setFormData({
        name: '',
        duration: 1,
        assignee: '',
        dependsOn: [],
        progress: 0,
        projectId: projects[0]?.id,
      });
    }
    setError(null);
  }, [task, isOpen, projects]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isEditing) {
        await updateTask(task!.id, formData);
      } else {
        await createTask(formData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    }
  };

  const handleDependencyToggle = (depId: string) => {
    setFormData(prev => ({
      ...prev,
      dependsOn: prev.dependsOn.includes(depId)
        ? prev.dependsOn.filter(id => id !== depId)
        : [...prev.dependsOn, depId],
    }));
  };

  const handleClearManualStart = () => {
    setFormData(prev => ({
      ...prev,
      manualStart: undefined,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-primary-800 border border-primary-400/30 rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-400/20 bg-primary-700/50">
          <h3 className="font-display text-xl font-semibold text-white">
            {isEditing ? '编辑任务' : '新增任务'}
          </h3>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-critical-900/30 border border-critical-500/50 rounded text-critical-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                任务 ID
              </label>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value || undefined }))}
                disabled={isEditing}
                placeholder="自动生成"
                className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                工期（工作日）
              </label>
              <input
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 1 }))}
                required
                className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-1.5">
              任务名称
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="请输入任务名称"
              className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-1.5">
              负责人
            </label>
            <input
              type="text"
              value={formData.assignee}
              onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
              required
              placeholder="请输入负责人姓名"
              className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400"
            />
          </div>

          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                手动开始日（工作日索引，0 = 项目开始）
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={formData.manualStart ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      manualStart: val === '' ? undefined : parseInt(val),
                    }));
                  }}
                  placeholder="留空自动计算"
                  className="flex-1 bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400"
                />
                {formData.manualStart !== undefined && (
                  <button
                    type="button"
                    onClick={handleClearManualStart}
                    className="px-3 py-2 bg-primary-700 hover:bg-primary-600 text-white rounded text-sm transition-colors"
                  >
                    自动
                  </button>
                )}
              </div>
              <p className="text-xs text-primary-400 mt-1">
                提示：也可以在甘特图上直接拖拽任务条调整开始时间
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-2">
              前置依赖
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-primary-900/30 rounded border border-primary-400/20">
              {availableDependencies.length === 0 ? (
                <span className="text-primary-500 text-sm">暂无可用前置任务</span>
              ) : (
                availableDependencies.map((dep) => (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={() => handleDependencyToggle(dep.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      formData.dependsOn.includes(dep.id)
                        ? dep.isCritical
                          ? 'bg-critical-600 text-white'
                          : 'bg-normal-600 text-white'
                        : 'bg-primary-700/50 text-primary-300 hover:bg-primary-700'
                    }`}
                  >
                    {dep.id} - {dep.name}
                  </button>
                ))
              )}
            </div>
            <p className="text-xs text-primary-400 mt-1">
              点击选择/取消前置任务，添加时会自动检测循环依赖
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                所属项目
              </label>
              <select
                value={formData.projectId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-400"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                进度 (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, progress: parseInt(e.target.value) }))}
                  className="flex-1 h-2 bg-primary-700 rounded-lg appearance-none cursor-pointer accent-normal-500"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="w-16 bg-primary-900/50 border border-primary-400/30 rounded px-2 py-1 text-white text-center focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                实际开始日期
              </label>
              <input
                type="date"
                value={formData.actualStartDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, actualStartDate: e.target.value || undefined }))}
                className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-1.5">
                实际完成日期
              </label>
              <input
                type="date"
                value={formData.actualEndDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, actualEndDate: e.target.value || undefined }))}
                className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-1.5">
              覆盖日历
            </label>
            <select
              value={formData.calendarId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, calendarId: e.target.value || undefined }))}
              className="w-full bg-primary-900/50 border border-primary-400/30 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-400"
            >
              <option value="">使用项目默认日历</option>
              {calendars.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-600 text-white rounded text-sm font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-normal-600 hover:bg-normal-500 text-white rounded text-sm font-medium transition-colors"
            >
              {isEditing ? '保存修改' : '创建任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
