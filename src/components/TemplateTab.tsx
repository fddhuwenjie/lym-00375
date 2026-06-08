import { useState, useRef } from 'react';
import {
  LayoutTemplate,
  Trash2,
  Upload,
  Download,
  Play,
  Save,
  FileText,
  FileSpreadsheet,
  Image,
  FileIcon,
  X,
  Check,
  Layers,
  Rocket,
  Home,
  Heart,
  BookOpen,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Template, ExportFormat, ImportFormat } from '@shared/types';

const DEFAULT_TEMPLATES: { id: string; name: string; description: string; icon: typeof Layers }[] = [
  { id: 'waterfall', name: '瀑布软件项目', description: '传统瀑布式软件开发流程，包含需求分析、设计、开发、测试、部署等阶段', icon: Layers },
  { id: 'agile', name: '敏捷迭代', description: '敏捷开发方法论，包含多个迭代周期，每个迭代包含规划、开发、评审、回顾', icon: Rocket },
  { id: 'decoration', name: '装修工程', description: '家庭装修项目全流程，包含设计、拆改、水电、泥木、油漆、安装、验收', icon: Home },
  { id: 'wedding', name: '婚礼筹备', description: '婚礼筹备完整计划，包含订婚、选日子、订酒店、拍婚纱、发请柬、婚礼当天', icon: Heart },
  { id: 'research', name: '研究论文', description: '学术论文研究与写作流程，包含选题、文献综述、实验、数据分析、撰写、投稿', icon: BookOpen },
  { id: 'product', name: '产品发布', description: '新产品发布项目，包含市场调研、产品设计、开发、测试、营销、发布、运营', icon: Package },
];

interface SaveTemplateFormData {
  name: string;
  description: string;
}

export function TemplateTab() {
  const {
    templates,
    tasks,
    applyTemplate,
    createTemplateFromProject,
    deleteTemplate,
    importProject,
    exportProject,
  } = useStore();

  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFormData, setSaveFormData] = useState<SaveTemplateFormData>({
    name: '',
    description: '',
  });
  const [importFormat, setImportFormat] = useState<ImportFormat>('xml');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTemplates = [...DEFAULT_TEMPLATES.map(t => ({ ...t, isDefault: true })), ...templates];

  const handleApplyTemplate = async (template: Template) => {
    if (tasks.length > 0 && !confirm('应用模板将覆盖当前项目的所有任务，确定继续吗？')) {
      return;
    }
    try {
      await applyTemplate(template.id);
      alert(`已成功应用模板"${template.name}"，创建了新的任务`);
    } catch (err) {
      alert('应用模板失败: ' + (err as Error).message);
    }
  };

  const handleShowSaveModal = () => {
    if (tasks.length === 0) {
      alert('当前项目没有任务，无法保存为模板');
      return;
    }
    setSaveFormData({ name: '', description: '' });
    setShowSaveModal(true);
  };

  const handleSaveAsTemplate = async () => {
    if (!saveFormData.name.trim()) {
      alert('请输入模板名称');
      return;
    }
    try {
      await createTemplateFromProject(saveFormData.name, saveFormData.description);
      alert('模板保存成功');
      setShowSaveModal(false);
    } catch (err) {
      alert('保存模板失败: ' + (err as Error).message);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (template.isDefault) {
      alert('内置模板不可删除');
      return;
    }
    if (confirm(`确定要删除模板"${template.name}"吗？`)) {
      try {
        await deleteTemplate(template.id);
        if (expandedTemplateId === template.id) {
          setExpandedTemplateId(null);
        }
      } catch (err) {
        alert('删除模板失败: ' + (err as Error).message);
      }
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = importFormat === 'xml' ? ['.xml'] : ['.csv'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      alert(`请上传 ${importFormat.toUpperCase()} 格式的文件`);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setIsImporting(true);
      try {
        const result = await importProject(importFormat, content);
        if (result.success) {
          alert(
            `导入成功！\n创建任务: ${result.tasksCreated} 个\n` +
            `创建依赖: ${result.dependenciesCreated} 个\n` +
            `创建资源: ${result.resourcesCreated} 个` +
            (result.warnings.length > 0 ? `\n警告: ${result.warnings.length} 条` : '')
          );
        } else {
          alert(`导入失败: ${result.errors.join(', ')}`);
        }
      } catch (err) {
        alert('导入失败: ' + (err as Error).message);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportProject(format);
    } catch (err) {
      alert('导出失败: ' + (err as Error).message);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTemplateId(expandedTemplateId === id ? null : id);
  };

  const getTemplateIcon = (template: Template | typeof DEFAULT_TEMPLATES[0]) => {
    if ('icon' in template) return template.icon;
    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.id === template.id);
    return defaultTemplate?.icon || LayoutTemplate;
  };

  const exportOptions: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
    { format: 'csv', label: '导出 CSV', icon: FileSpreadsheet },
    { format: 'xml', label: '导出 XML', icon: FileText },
    { format: 'png', label: '导出 PNG', icon: Image },
    { format: 'pdf', label: '导出 PDF', icon: FileIcon },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-primary-800/50 border-b border-primary-400/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="w-5 h-5 text-primary-300" />
          <h2 className="font-display text-lg font-semibold text-white">模板库与导入导出</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-primary-800 rounded p-1">
            <button
              onClick={() => setImportFormat('xml')}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                importFormat === 'xml'
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-300 hover:text-white'
              }`}
            >
              MS Project XML
            </button>
            <button
              onClick={() => setImportFormat('csv')}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                importFormat === 'csv'
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-300 hover:text-white'
              }`}
            >
              CSV
            </button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 bg-primary-700 hover:bg-primary-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? '导入中...' : `导入 ${importFormat.toUpperCase()}`}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={importFormat === 'xml' ? '.xml' : '.csv'}
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={handleShowSaveModal}
            className="flex items-center gap-2 bg-warning-600/80 hover:bg-warning-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            另存为模板
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {exportOptions.map((option) => (
                <button
                  key={option.format}
                  onClick={() => handleExport(option.format)}
                  className="flex flex-col items-center gap-3 p-6 bg-primary-800/50 border border-primary-400/20 rounded-lg hover:bg-primary-700/50 hover:border-primary-400/40 transition-all group"
                >
                  <option.icon className="w-8 h-8 text-primary-400 group-hover:text-white transition-colors" />
                  <span className="text-sm font-medium text-primary-200 group-hover:text-white transition-colors">
                    {option.label}
                  </span>
                  <Download className="w-4 h-4 text-primary-500 group-hover:text-primary-300 transition-colors" />
                </button>
              ))}
            </div>

            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-primary-300" />
              模板列表
            </h3>

            <div className="space-y-3">
              {allTemplates.map((template) => {
                const Icon = getTemplateIcon(template);
                const isDefault = 'isDefault' in template ? template.isDefault : false;
                const templateId = template.id;

                return (
                  <div
                    key={templateId}
                    className="bg-primary-800/50 border border-primary-400/20 rounded-lg overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-primary-700/30 transition-colors"
                      onClick={() => toggleExpand(templateId)}
                    >
                      <div className="flex items-center gap-4">
                        {expandedTemplateId === templateId ? (
                          <ChevronUp className="w-5 h-5 text-primary-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-primary-400 flex-shrink-0" />
                        )}
                        <div className="w-10 h-10 rounded-lg bg-primary-700 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-primary-300" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{template.name}</span>
                            {isDefault && (
                              <span className="text-xs bg-normal-600/30 text-normal-300 px-2 py-0.5 rounded">
                                内置
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-primary-400 mt-0.5 max-w-xl line-clamp-1">
                            {template.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary-500 mr-2">
                          {'tasks' in template ? `${template.tasks.length} 个任务` : ''}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyTemplate(template as Template);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-normal-600 hover:bg-normal-500 text-white rounded text-xs transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          应用模板
                        </button>
                        {!isDefault && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template as Template);
                            }}
                            className="p-2 text-primary-400 hover:text-critical-400 hover:bg-critical-900/30 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {expandedTemplateId === templateId && (
                      <div className="border-t border-primary-400/20 p-4 bg-primary-900/30">
                        <h4 className="text-sm font-medium text-primary-200 mb-3">模板描述</h4>
                        <p className="text-sm text-primary-300 mb-4">{template.description}</p>
                        {'tasks' in template && template.tasks.length > 0 && (
                          <>
                            <h4 className="text-sm font-medium text-primary-200 mb-3">
                              包含任务（共 {template.tasks.length} 个）
                            </h4>
                            <div className="bg-primary-800/50 rounded p-3 max-h-60 overflow-y-auto">
                              <div className="space-y-2">
                                {template.tasks.map((task, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between py-2 px-3 bg-primary-900/30 rounded"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="w-6 h-6 rounded bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
                                        {idx + 1}
                                      </span>
                                      <span className="text-sm text-white">{task.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-primary-400">
                                      <span>{task.duration} 天</span>
                                      <span className="text-primary-500">|</span>
                                      <span>{task.assignee}</span>
                                      {task.dependsOn.length > 0 && (
                                        <>
                                          <span className="text-primary-500">|</span>
                                          <span>依赖: {task.dependsOn.join(', ')}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {allTemplates.length === 0 && (
                <div className="text-center py-12 text-primary-400">
                  <LayoutTemplate className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无模板，点击"另存为模板"将当前项目保存为模板</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-primary-800 border border-primary-400/30 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-white text-lg">另存为模板</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-primary-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-200 mb-2">
                  模板名称
                </label>
                <input
                  type="text"
                  value={saveFormData.name}
                  onChange={(e) => setSaveFormData({ ...saveFormData, name: e.target.value })}
                  placeholder="请输入模板名称"
                  className="w-full bg-primary-900 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-200 mb-2">
                  模板描述
                </label>
                <textarea
                  value={saveFormData.description}
                  onChange={(e) => setSaveFormData({ ...saveFormData, description: e.target.value })}
                  placeholder="请输入模板描述"
                  rows={3}
                  className="w-full bg-primary-900 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400 resize-none"
                />
              </div>

              <div className="bg-primary-900/50 rounded p-3">
                <p className="text-xs text-primary-300">
                  将保存当前项目的 <span className="text-white font-medium">{tasks.length}</span> 个任务作为模板
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-primary-300 hover:text-white bg-primary-700 hover:bg-primary-600 rounded text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveAsTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-normal-600 hover:bg-normal-500 text-white rounded text-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
