import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { Toolbar } from '@/components/Toolbar';
import { TaskTable } from '@/components/TaskTable';
import { GanttChart } from '@/components/GanttChart';
import { TaskEditModal } from '@/components/TaskEditModal';
import { useStore } from '@/store/useStore';
import type { Task } from '@shared/types';

export default function Home() {
  const { fetchData, isLoading, error, clearError, tasks, criticalPaths } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar onAddTask={handleAddTask} />
      
      {error && (
        <div className="flex items-center justify-between px-6 py-3 bg-critical-900/50 border-b border-critical-500/30 text-critical-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-critical-400 hover:text-critical-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {criticalPaths.length > 0 && (
        <div className="px-6 py-2 bg-critical-900/20 border-b border-critical-500/20">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-critical-300 font-medium">关键路径:</span>
            {criticalPaths.map((path, idx) => (
              <span key={idx} className="text-critical-200">
                {path.join(' → ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading && tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-primary-300">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>加载中...</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="w-full lg:w-1/2 lg:min-w-[500px] border-r border-primary-400/20 overflow-hidden flex flex-col">
            <TaskTable onEditTask={handleEditTask} />
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <GanttChart onEditTask={handleEditTask} />
          </div>
        </div>
      )}

      <TaskEditModal
        task={editingTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
