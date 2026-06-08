import { useState, useEffect } from 'react';
import { Plus, Calendar, AlertTriangle, ChevronDown, Heart, TrendingUp, CheckCircle2, FolderKanban } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { ViewMode } from '@shared/types';

interface ToolbarProps {
  onAddTask: () => void;
}

export function Toolbar({ onAddTask }: ToolbarProps) {
  const {
    config,
    updateConfig,
    viewMode,
    setViewMode,
    conflicts,
    totalDuration,
    projectEndDate,
    criticalPaths,
    projects,
    currentProjectId,
    setCurrentProjectId,
    projectHealth,
    fetchProjectHealth,
  } = useStore();

  useEffect(() => {
    if (currentProjectId) {
      fetchProjectHealth(currentProjectId);
    }
  }, [currentProjectId, fetchProjectHealth]);

  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showConflictInfo, setShowConflictInfo] = useState(false);

  const viewModes: { value: ViewMode; label: string }[] = [
    { value: 'day', label: '日视图' },
    { value: 'week', label: '周视图' },
    { value: 'month', label: '月视图' },
  ];

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig(e.target.value);
  };

  const currentViewLabel = viewModes.find(m => m.value === viewMode)?.label || '日视图';

  const [showHealthInfo, setShowHealthInfo] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const getHealthColor = (health: typeof projectHealth) => {
    if (!health || health.onTimeCompletionRate == null) return 'text-primary-400';
    const score = health.onTimeCompletionRate;
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-warning-400';
    return 'text-critical-400';
  };

  const getHealthBg = (health: typeof projectHealth) => {
    if (!health || health.onTimeCompletionRate == null) return 'bg-primary-600/30';
    const score = health.onTimeCompletionRate;
    if (score >= 80) return 'bg-green-600/30';
    if (score >= 50) return 'bg-warning-600/30';
    return 'bg-critical-600/30';
  };

  return (
    <div className="bg-primary-700/80 backdrop-blur-sm border-b border-primary-400/30 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            项目管理工具
          </h1>
          
          <div className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex items-center gap-2 bg-primary-800 border border-primary-400/30 rounded px-3 py-1.5 text-sm text-white hover:bg-primary-700 transition-colors"
            >
              <FolderKanban className="w-4 h-4" style={{ color: currentProject?.color }} />
              <span>{currentProject?.name || '选择项目'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showProjectDropdown && (
              <div className="absolute left-0 mt-1 w-56 bg-primary-800 border border-primary-400/30 rounded shadow-lg z-30 overflow-hidden">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setCurrentProjectId(project.id);
                      setShowProjectDropdown(false);
                    }}
                    className={`flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-primary-700 transition-colors ${
                      currentProjectId === project.id ? 'text-white bg-primary-700/50' : 'text-primary-200'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                    <span>{project.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-primary-200">
            <span className="px-2 py-1 bg-primary-600/50 rounded">
              总工期: <span className="text-white font-semibold">{totalDuration}</span> 工作日
            </span>
            <span className="px-2 py-1 bg-primary-600/50 rounded">
              结束日期: <span className="text-white font-semibold">{projectEndDate}</span>
            </span>
            <span className="px-2 py-1 bg-critical-600/30 rounded">
              关键路径: <span className="text-white font-semibold">{criticalPaths.length}</span> 条
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {projectHealth && (
            <div className="relative">
              <button
                onClick={() => setShowHealthInfo(!showHealthInfo)}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${getHealthBg(projectHealth)} border border-primary-400/30`}
              >
                <Heart className={`w-4 h-4 ${getHealthColor(projectHealth)}`} />
                <span className={getHealthColor(projectHealth)}>
                  健康度: {projectHealth.onTimeCompletionRate != null ? `${projectHealth.onTimeCompletionRate.toFixed(0)}%` : 'N/A'}
                </span>
              </button>
              {showHealthInfo && (
                <div className="absolute right-0 mt-1 w-72 bg-primary-800 border border-primary-400/30 rounded shadow-lg z-30 p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">项目健康度</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-primary-300 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        按时完成率
                      </span>
                      <span className="text-white font-semibold">{projectHealth.onTimeCompletionRate != null ? `${projectHealth.onTimeCompletionRate.toFixed(1)}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-primary-300 text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-warning-400" />
                        平均延期
                      </span>
                      <span className="text-white font-semibold">{projectHealth.averageDelayDays != null ? `${projectHealth.averageDelayDays.toFixed(1)} 天` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-primary-300 text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4 text-critical-400" />
                        关键路径完成度
                      </span>
                      <span className="text-white font-semibold">{projectHealth.criticalPathCompletion != null ? `${projectHealth.criticalPathCompletion.toFixed(1)}%` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-300" />
            <span className="text-sm text-primary-200">项目起始:</span>
            <input
              type="date"
              value={config.startDate}
              onChange={handleDateChange}
              className="bg-primary-800 border border-primary-400/30 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-400"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowViewDropdown(!showViewDropdown)}
              className="flex items-center gap-2 bg-primary-800 border border-primary-400/30 rounded px-3 py-1.5 text-sm text-white hover:bg-primary-700 transition-colors"
            >
              {currentViewLabel}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showViewDropdown && (
              <div className="absolute right-0 mt-1 bg-primary-800 border border-primary-400/30 rounded shadow-lg z-20 overflow-hidden">
                {viewModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setViewMode(mode.value);
                      setShowViewDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-primary-700 transition-colors ${
                      viewMode === mode.value ? 'text-primary-300 bg-primary-700/50' : 'text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowConflictInfo(!showConflictInfo)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${
                conflicts.length > 0
                  ? 'bg-warning-600/30 text-warning-100 border border-warning-500/50 hover:bg-warning-600/50'
                  : 'bg-primary-800 text-primary-300 border border-primary-400/30'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {conflicts.length > 0 && (
                <span className="bg-warning-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {conflicts.length}
                </span>
              )}
              <span>资源冲突</span>
            </button>
            {showConflictInfo && conflicts.length > 0 && (
              <div className="absolute right-0 mt-1 w-80 bg-primary-800 border border-warning-500/50 rounded shadow-lg z-20 p-3">
                <h4 className="text-sm font-semibold text-warning-400 mb-2">资源冲突告警</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {conflicts.map((c, idx) => (
                    <div key={idx} className="text-xs bg-warning-900/30 p-2 rounded">
                      <span className="text-warning-300 font-medium">{c.assignee}</span>
                      <span className="text-primary-300"> 在第 {c.startDay}-{c.endDay} 工作日同时负责 </span>
                      <span className="text-warning-300 font-medium">{c.tasks.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onAddTask}
            className="flex items-center gap-2 bg-normal-600 hover:bg-normal-500 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增任务
          </button>
        </div>
      </div>
    </div>
  );
}
