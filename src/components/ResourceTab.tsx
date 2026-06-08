import { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, Users, Clock, AlertTriangle, X, UserPlus, Calendar as CalendarIcon, Timer } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Resource } from '@shared/types';

export function ResourceTab() {
  const {
    resources,
    resourceAllocations,
    overloadedResources,
    conflicts,
    fetchResources,
    fetchResourceAllocations,
    createResource,
    updateResource,
    deleteResource,
    isLoading,
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDailyCapacity, setFormDailyCapacity] = useState(8);

  useEffect(() => {
    fetchResources();
    fetchResourceAllocations();
  }, [fetchResources, fetchResourceAllocations]);

  const dates = useMemo(() => {
    const dateSet = new Set<string>();
    resourceAllocations.forEach((a) => dateSet.add(a.date));
    return Array.from(dateSet).sort();
  }, [resourceAllocations]);

  const getResourceAllocation = (assignee: string, date: string) => {
    return resourceAllocations.find((a) => a.assignee === assignee && a.date === date);
  };

  const getResourceDailyStats = (assignee: string) => {
    const allocations = resourceAllocations.filter((a) => a.assignee === assignee);
    const totalHours = allocations.reduce((sum, a) => sum + a.totalHours, 0);
    const avgHours = allocations.length > 0 ? totalHours / allocations.length : 0;
    const overloadedDays = allocations.filter((a) => a.isOverloaded).length;
    return { totalHours, avgHours, overloadedDays, totalDays: allocations.length };
  };

  const handleOpenAddModal = () => {
    setEditingResource(null);
    setFormName('');
    setFormDailyCapacity(8);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setFormName(resource.name);
    setFormDailyCapacity(resource.dailyCapacity);
    setShowAddModal(true);
  };

  const handleSaveResource = async () => {
    if (!formName.trim()) return;
    try {
      if (editingResource) {
        await updateResource(editingResource.id, formName.trim(), formDailyCapacity);
      } else {
        await createResource(formName.trim(), formDailyCapacity);
      }
      setShowAddModal(false);
      setEditingResource(null);
      setFormName('');
      setFormDailyCapacity(8);
    } catch {
      // Error handled in store
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      await deleteResource(id);
      setDeleteConfirmId(null);
    } catch {
      // Error handled in store
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      full: date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      weekday: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
    };
  };

  const isWeekend = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6;
  };

  const getResourceConflicts = (assignee: string) => {
    return conflicts.filter((c) => c.assignee === assignee);
  };

  return (
    <div className="flex flex-col h-full bg-primary-900/50">
      <div className="px-6 py-4 bg-primary-800/50 border-b border-primary-400/20 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">资源管理</h2>
          <p className="text-sm text-primary-300 mt-0.5">管理团队成员与工时分配</p>
        </div>
        <div className="flex items-center gap-3">
          {conflicts.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-warning-400 bg-warning-900/30 px-3 py-1.5 rounded">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{conflicts.length} 个资源冲突</span>
            </div>
          )}
          {overloadedResources.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-critical-400 bg-critical-900/30 px-3 py-1.5 rounded">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{overloadedResources.length} 人超载</span>
            </div>
          )}
          <button
            onClick={handleOpenAddModal}
            disabled={isLoading}
            className="flex items-center gap-2 bg-normal-600 hover:bg-normal-500 disabled:bg-primary-700 disabled:text-primary-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            添加资源
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="px-6 py-3 bg-warning-900/20 border-b border-warning-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-warning-300 text-sm font-medium">资源冲突警告：</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {conflicts.map((c, idx) => (
                  <span key={idx} className="text-xs bg-warning-900/40 px-2 py-1 rounded text-warning-200">
                    {c.assignee} 在第 {c.startDay}-{c.endDay} 工作日同时负责 {c.tasks.join(', ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
              <div className="flex items-center gap-2 text-primary-300 text-sm mb-1">
                <Users className="w-4 h-4" />
                <span>总资源数</span>
              </div>
              <div className="text-3xl font-bold text-white">{resources.length}</div>
            </div>
            <div className="bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
              <div className="flex items-center gap-2 text-primary-300 text-sm mb-1">
                <AlertTriangle className="w-4 h-4 text-warning-400" />
                <span>资源冲突</span>
              </div>
              <div className={`text-3xl font-bold ${conflicts.length > 0 ? 'text-warning-400' : 'text-white'}`}>
                {conflicts.length}
              </div>
            </div>
            <div className="bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
              <div className="flex items-center gap-2 text-primary-300 text-sm mb-1">
                <Timer className="w-4 h-4 text-critical-400" />
                <span>超载人员</span>
              </div>
              <div className={`text-3xl font-bold ${overloadedResources.length > 0 ? 'text-critical-400' : 'text-white'}`}>
                {overloadedResources.length}
              </div>
            </div>
            <div className="bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
              <div className="flex items-center gap-2 text-primary-300 text-sm mb-1">
                <CalendarIcon className="w-4 h-4" />
                <span>时间跨度</span>
              </div>
              <div className="text-3xl font-bold text-white">{dates.length} 天</div>
            </div>
          </div>

          <div className="bg-primary-800/50 rounded-lg border border-primary-400/20 overflow-hidden">
            <div className="p-4 border-b border-primary-400/20">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-normal-400" />
                资源名册
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary-800 sticky top-0">
                  <tr className="text-left text-primary-200">
                    <th className="px-4 py-3 font-medium">成员</th>
                    <th className="px-4 py-3 font-medium text-center">日工时容量</th>
                    <th className="px-4 py-3 font-medium text-center">总工时</th>
                    <th className="px-4 py-3 font-medium text-center">日均工时</th>
                    <th className="px-4 py-3 font-medium text-center">超载天数</th>
                    <th className="px-4 py-3 font-medium text-center">冲突数</th>
                    <th className="px-4 py-3 font-medium text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((resource) => {
                    const stats = getResourceDailyStats(resource.name);
                    const resourceConflicts = getResourceConflicts(resource.name);
                    const isOverloaded = overloadedResources.includes(resource.name);
                    return (
                      <tr
                        key={resource.id}
                        className={`border-t border-primary-400/10 hover:bg-primary-700/30 transition-colors ${
                          isOverloaded ? 'bg-critical-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                              isOverloaded ? 'bg-critical-600' : 'bg-normal-600'
                            }`}>
                              {resource.name.charAt(0)}
                            </div>
                            <span className="text-white font-medium">{resource.name}</span>
                            {isOverloaded && (
                              <span className="px-1.5 py-0.5 bg-critical-600/30 text-critical-300 text-xs rounded">
                                超载
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-primary-200">
                          {resource.dailyCapacity} h
                        </td>
                        <td className="px-4 py-3 text-center text-white font-medium">
                          {stats.totalHours.toFixed(1)} h
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={stats.avgHours > resource.dailyCapacity ? 'text-critical-400' : 'text-primary-200'}>
                            {stats.avgHours.toFixed(1)} h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={stats.overloadedDays > 0 ? 'text-critical-400' : 'text-primary-200'}>
                            {stats.overloadedDays} 天
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={resourceConflicts.length > 0 ? 'text-warning-400' : 'text-primary-200'}>
                            {resourceConflicts.length}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(resource)}
                              className="p-1.5 text-primary-400 hover:text-white hover:bg-primary-600 rounded transition-colors"
                              title="编辑"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(resource.id)}
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
                  {resources.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-primary-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>暂无资源</p>
                        <p className="text-sm mt-1">点击"添加资源"开始</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {dates.length > 0 && resources.length > 0 && (
            <div className="mt-6 bg-primary-800/50 rounded-lg border border-primary-400/20 overflow-hidden">
              <div className="p-4 border-b border-primary-400/20 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-normal-400" />
                  资源时间轴
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-normal-600"></div>
                    <span className="text-primary-300">正常</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-critical-600"></div>
                    <span className="text-primary-300">超载</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-primary-700"></div>
                    <span className="text-primary-300">周末</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  <div className="flex border-b border-primary-400/20">
                    <div className="w-32 flex-shrink-0 p-2 bg-primary-800 sticky left-0 z-10">
                      <span className="text-xs text-primary-300">成员 / 日期</span>
                    </div>
                    {dates.map((date) => {
                      const dateInfo = formatDate(date);
                      const weekend = isWeekend(date);
                      return (
                        <div
                          key={date}
                          className={`w-28 flex-shrink-0 p-2 text-center border-l border-primary-400/10 ${
                            weekend ? 'bg-primary-700/50' : 'bg-primary-800'
                          }`}
                        >
                          <div className="text-xs text-white font-medium">{dateInfo.full}</div>
                          <div className={`text-xs ${weekend ? 'text-primary-400' : 'text-primary-300'}`}>
                            {dateInfo.weekday}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {resources.map((resource) => (
                    <div key={resource.id} className="flex border-b border-primary-400/10 last:border-b-0">
                      <div className="w-32 flex-shrink-0 p-2 bg-primary-800/80 sticky left-0 z-10 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                          overloadedResources.includes(resource.name) ? 'bg-critical-600' : 'bg-normal-600'
                        }`}>
                          {resource.name.charAt(0)}
                        </div>
                        <span className="text-xs text-white truncate">{resource.name}</span>
                      </div>
                      {dates.map((date) => {
                        const allocation = getResourceAllocation(resource.name, date);
                        const weekend = isWeekend(date);
                        const isOverloaded = allocation?.isOverloaded;
                        return (
                          <div
                            key={date}
                            className={`w-28 flex-shrink-0 p-2 border-l border-primary-400/10 min-h-16 ${
                              weekend
                                ? 'bg-primary-700/30'
                                : isOverloaded
                                ? 'bg-critical-900/20'
                                : 'bg-primary-900/30'
                            }`}
                          >
                            {allocation && allocation.projects.length > 0 ? (
                              <div className="space-y-1">
                                {allocation.projects.map((p, idx) => (
                                  <div
                                    key={idx}
                                    className={`text-xs p-1 rounded truncate ${
                                      isOverloaded
                                        ? 'bg-critical-600/30 text-critical-200'
                                        : 'bg-normal-600/30 text-normal-200'
                                    }`}
                                    title={`${p.projectName} - ${p.taskName} (${p.hours}h)`}
                                  >
                                    <div className="font-medium truncate">{p.taskName}</div>
                                    <div className="text-[10px] opacity-80">{p.hours}h</div>
                                  </div>
                                ))}
                                <div className={`text-[10px] text-center font-medium ${
                                  isOverloaded ? 'text-critical-400' : 'text-primary-300'
                                }`}>
                                  总计: {allocation.totalHours.toFixed(1)}h
                                </div>
                              </div>
                            ) : weekend ? (
                              <div className="h-full flex items-center justify-center">
                                <span className="text-[10px] text-primary-500">周末</span>
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center">
                                <span className="text-[10px] text-primary-500">无分配</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-primary-800 border border-primary-400/30 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-primary-400/20">
              <h3 className="font-semibold text-white text-lg">
                {editingResource ? '编辑资源' : '添加资源'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-primary-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-primary-200 mb-2">成员姓名</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：张三"
                  className="w-full bg-primary-900 border border-primary-400/30 rounded-lg px-4 py-2.5 text-white placeholder-primary-500 focus:outline-none focus:border-normal-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveResource();
                  }}
                />
              </div>
              <div>
                <label className="block text-sm text-primary-200 mb-2">
                  每日可用工时
                  <span className="text-primary-400 text-xs ml-2">(小时)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formDailyCapacity}
                  onChange={(e) => setFormDailyCapacity(Math.max(1, Math.min(24, parseInt(e.target.value) || 8)))}
                  className="w-full bg-primary-900 border border-primary-400/30 rounded-lg px-4 py-2.5 text-white placeholder-primary-500 focus:outline-none focus:border-normal-500"
                />
                <p className="text-xs text-primary-400 mt-1">
                  默认 8 小时，超出此工时将标记为超载
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-primary-400/20">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-primary-300 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveResource}
                disabled={!formName.trim() || isLoading}
                className="px-4 py-2 text-sm bg-normal-600 hover:bg-normal-500 disabled:bg-primary-700 disabled:text-primary-400 text-white rounded-lg font-medium transition-colors"
              >
                {editingResource ? '保存修改' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-primary-800 border border-critical-500/30 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-critical-900/50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-critical-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">确认删除</h3>
                  <p className="text-sm text-primary-300">删除后无法恢复</p>
                </div>
              </div>
              <p className="text-primary-200 mb-6">
                确定要删除该资源吗？相关的任务分配信息也会受到影响。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-sm text-primary-300 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDeleteResource(deleteConfirmId)}
                  className="px-4 py-2 text-sm bg-critical-600 hover:bg-critical-500 text-white rounded-lg font-medium transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
