import { useState, useEffect } from 'react';
import { Save, Trash2, GitCompare, Clock, Calendar as CalendarIcon, AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function BaselineTab() {
  const {
    baselines,
    selectedBaselineId,
    baselineComparison,
    fetchBaselines,
    createBaseline,
    deleteBaseline,
    selectBaseline,
    isLoading,
  } = useStore();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [baselineName, setBaselineName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchBaselines();
  }, [fetchBaselines]);

  const handleSaveBaseline = async () => {
    if (!baselineName.trim()) return;
    try {
      await createBaseline(baselineName.trim());
      setBaselineName('');
      setShowSaveModal(false);
    } catch {
      // Error handled in store
    }
  };

  const handleCompare = (baselineId: string) => {
    if (selectedBaselineId === baselineId) {
      selectBaseline(null);
    } else {
      selectBaseline(baselineId);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBaseline(id);
      setDeleteConfirmId(null);
    } catch {
      // Error handled in store
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDiff = (diff: number, unit: string = '天') => {
    if (diff === 0) return <span className="text-primary-300">0 {unit}</span>;
    const prefix = diff > 0 ? '+' : '';
    const colorClass = diff > 0 ? 'text-critical-400' : 'text-green-400';
    return <span className={colorClass}>{prefix}{diff} {unit}</span>;
  };

  const getCriticalChangeText = (wasCritical: boolean, isCritical: boolean) => {
    if (wasCritical && !isCritical) {
      return <span className="text-yellow-400">从关键变非关键</span>;
    }
    if (!wasCritical && isCritical) {
      return <span className="text-critical-400">从非关键变关键</span>;
    }
    return <span className="text-primary-400">-</span>;
  };

  return (
    <div className="flex flex-col h-full bg-primary-900/50">
      <div className="px-6 py-4 bg-primary-800/50 border-b border-primary-400/20 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">基线管理</h2>
          <p className="text-sm text-primary-300 mt-0.5">保存项目快照，跟踪进度变化</p>
        </div>
        <div className="flex items-center gap-3">
          {baselines.length >= 5 && (
            <div className="flex items-center gap-1.5 text-xs text-warning-400 bg-warning-900/30 px-3 py-1.5 rounded">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>最多保留 5 份基线</span>
            </div>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={isLoading || baselines.length >= 5}
            className="flex items-center gap-2 bg-normal-600 hover:bg-normal-500 disabled:bg-primary-700 disabled:text-primary-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            保存基线
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="grid gap-4">
            {baselines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-primary-400">
                <Save className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg">暂无基线</p>
                <p className="text-sm mt-1">点击"保存基线"创建项目快照</p>
              </div>
            ) : (
              baselines.map((baseline) => {
                const isSelected = selectedBaselineId === baseline.id;
                return (
                  <div
                    key={baseline.id}
                    className={`bg-primary-800/50 border rounded-lg overflow-hidden transition-all ${
                      isSelected ? 'border-normal-500 shadow-lg shadow-normal-500/10' : 'border-primary-400/20 hover:border-primary-400/40'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white text-lg">{baseline.name}</h3>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-normal-600/30 text-normal-300 text-xs rounded">
                                对比中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-6 mt-3 text-sm">
                            <div className="flex items-center gap-1.5 text-primary-300">
                              <Clock className="w-4 h-4" />
                              <span>总工期: <span className="text-white font-medium">{baseline.totalDuration} 天</span></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-primary-300">
                              <CalendarIcon className="w-4 h-4" />
                              <span>结束日期: <span className="text-white font-medium">{formatDate(baseline.projectEndDate)}</span></span>
                            </div>
                            <div className="text-primary-400">
                              创建于 {formatDateTime(baseline.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleCompare(baseline.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-normal-600 text-white'
                                : 'bg-primary-700/50 text-primary-200 hover:bg-primary-700 hover:text-white'
                            }`}
                          >
                            <GitCompare className="w-4 h-4" />
                            {isSelected ? '取消对比' : '对比'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(baseline.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-primary-700/50 text-primary-200 hover:bg-critical-900/30 hover:text-critical-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            删除
                          </button>
                        </div>
                      </div>
                    </div>

                    {isSelected && baselineComparison && (
                      <div className="border-t border-primary-400/20 p-4 bg-primary-900/50">
                        <div className="mb-4">
                          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                            <GitCompare className="w-5 h-5 text-normal-400" />
                            与当前计划对比
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
                              <div className="text-sm text-primary-300 mb-1">项目工期变化</div>
                              <div className="text-2xl font-bold">
                                {formatDiff(baselineComparison.projectDurationChange)}
                              </div>
                              <div className="text-xs text-primary-400 mt-1">
                                基线 {baseline.totalDuration} 天 → 当前 {baseline.totalDuration + baselineComparison.projectDurationChange} 天
                              </div>
                            </div>
                            <div className="bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
                              <div className="text-sm text-primary-300 mb-1">项目结束日期变化</div>
                              <div className="text-2xl font-bold">
                                {formatDiff(baselineComparison.projectEndDateChange)}
                              </div>
                              <div className="text-xs text-primary-400 mt-1">
                                基线 {formatDate(baseline.projectEndDate)} → 当前 {formatDate(baselineComparison.baselineName ? '' : '')}
                              </div>
                            </div>
                          </div>

                          {(baselineComparison.criticalPathChanges.toCritical.length > 0 ||
                            baselineComparison.criticalPathChanges.fromCritical.length > 0) && (
                            <div className="mt-4 bg-primary-800/50 rounded-lg p-4 border border-primary-400/20">
                              <div className="text-sm text-primary-300 mb-2">关键路径变更</div>
                              <div className="flex flex-wrap gap-3">
                                {baselineComparison.criticalPathChanges.toCritical.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <XCircle className="w-4 h-4 text-critical-400" />
                                    <span className="text-critical-300 text-sm">
                                      变为关键: {baselineComparison.criticalPathChanges.toCritical.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {baselineComparison.criticalPathChanges.fromCritical.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                                    <span className="text-yellow-300 text-sm">
                                      变为非关键: {baselineComparison.criticalPathChanges.fromCritical.join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <h5 className="font-semibold text-white mb-3">任务对比详情</h5>
                          <div className="overflow-auto max-h-96 rounded-lg border border-primary-400/20">
                            <table className="w-full text-sm">
                              <thead className="bg-primary-800 sticky top-0">
                                <tr className="text-left text-primary-200">
                                  <th className="px-4 py-2.5 font-medium">任务名称</th>
                                  <th className="px-4 py-2.5 font-medium text-center">开始偏差</th>
                                  <th className="px-4 py-2.5 font-medium text-center">结束偏差</th>
                                  <th className="px-4 py-2.5 font-medium text-center">工期偏差</th>
                                  <th className="px-4 py-2.5 font-medium text-center">关键路径变化</th>
                                </tr>
                              </thead>
                              <tbody>
                                {baselineComparison.taskComparisons.map((tc) => (
                                  <tr
                                    key={tc.taskId}
                                    className="border-t border-primary-400/10 hover:bg-primary-700/30 transition-colors"
                                  >
                                    <td className="px-4 py-3 text-white">{tc.taskName}</td>
                                    <td className="px-4 py-3 text-center font-medium">
                                      {formatDiff(tc.startDateDiff)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">
                                      {formatDiff(tc.endDateDiff)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">
                                      {formatDiff(tc.durationDiff)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {tc.isCriticalChanged
                                        ? getCriticalChangeText(tc.wasCritical, tc.isCritical)
                                        : <span className="text-primary-400">-</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                                {baselineComparison.taskComparisons.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-primary-400">
                                      无变化
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-primary-800 border border-primary-400/30 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-primary-400/20">
              <h3 className="font-semibold text-white text-lg">保存基线</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-primary-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm text-primary-200 mb-2">基线名称</label>
              <input
                type="text"
                value={baselineName}
                onChange={(e) => setBaselineName(e.target.value)}
                placeholder="例如：版本 1.0 初始计划"
                className="w-full bg-primary-900 border border-primary-400/30 rounded-lg px-4 py-2.5 text-white placeholder-primary-500 focus:outline-none focus:border-normal-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveBaseline();
                }}
              />
              <p className="text-xs text-primary-400 mt-2">
                系统最多保留 5 份基线，超出后将无法创建新的基线。
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-primary-400/20">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm text-primary-300 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveBaseline}
                disabled={!baselineName.trim() || isLoading}
                className="px-4 py-2 text-sm bg-normal-600 hover:bg-normal-500 disabled:bg-primary-700 disabled:text-primary-400 text-white rounded-lg font-medium transition-colors"
              >
                确认保存
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
                确定要删除这条基线吗？此操作不可撤销。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-sm text-primary-300 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
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
