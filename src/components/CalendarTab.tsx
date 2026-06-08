import { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, CalendarDays, Upload, X, Check, ChevronDown, ChevronUp, Sun, Moon } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Calendar } from '@shared/types';

const CHINA_HOLIDAYS_2025_2026 = [
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
  '2025-04-04', '2025-04-05', '2025-04-06',
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
  '2025-05-31', '2025-06-01', '2025-06-02',
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07',
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', '2026-02-24',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
];

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface CalendarFormData {
  name: string;
  weekendPattern: number[];
  holidays: string[];
}

export function CalendarTab() {
  const { calendars, fetchCalendars, createCalendar, updateCalendar, deleteCalendar, importICS } = useStore();
  const [expandedCalendarId, setExpandedCalendarId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [formData, setFormData] = useState<CalendarFormData>({
    name: '',
    weekendPattern: [0, 6],
    holidays: [],
  });
  const [newHoliday, setNewHoliday] = useState('');
  const [selectedHolidays, setSelectedHolidays] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({ name: '', weekendPattern: [0, 6], holidays: [] });
    setEditingCalendar(null);
    setIsCreating(false);
    setNewHoliday('');
    setSelectedHolidays(new Set());
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleStartEdit = (calendar: Calendar) => {
    setFormData({
      name: calendar.name,
      weekendPattern: [...calendar.weekendPattern],
      holidays: [...calendar.holidays],
    });
    setEditingCalendar(calendar);
    setIsCreating(false);
    setSelectedHolidays(new Set());
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('请输入日历名称');
      return;
    }
    try {
      if (editingCalendar) {
        await updateCalendar(
          editingCalendar.id,
          formData.name,
          formData.weekendPattern,
          formData.holidays
        );
      } else {
        await createCalendar(
          formData.name,
          formData.weekendPattern,
          formData.holidays
        );
      }
      resetForm();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (calendar: Calendar) => {
    if (calendar.id === 'default') {
      alert('默认日历不可删除');
      return;
    }
    if (confirm(`确定要删除日历"${calendar.name}"吗？`)) {
      try {
        await deleteCalendar(calendar.id);
        if (expandedCalendarId === calendar.id) {
          setExpandedCalendarId(null);
        }
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  const handleWeekendToggle = (day: number) => {
    setFormData((prev) => {
      const pattern = prev.weekendPattern.includes(day)
        ? prev.weekendPattern.filter((d) => d !== day)
        : [...prev.weekendPattern, day];
      return { ...prev, weekendPattern: pattern.sort() };
    });
  };

  const handleAddHoliday = () => {
    if (!newHoliday) return;
    if (formData.holidays.includes(newHoliday)) {
      alert('该日期已存在');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      holidays: [...prev.holidays, newHoliday].sort(),
    }));
    setNewHoliday('');
  };

  const handleBulkDeleteHolidays = () => {
    if (selectedHolidays.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedHolidays.size} 个节假日吗？`)) {
      setFormData((prev) => ({
        ...prev,
        holidays: prev.holidays.filter((h) => !selectedHolidays.has(h)),
      }));
      setSelectedHolidays(new Set());
    }
  };

  const handleHolidaySelect = (date: string) => {
    setSelectedHolidays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleAddChinaHolidays = () => {
    const newHolidays = CHINA_HOLIDAYS_2025_2026.filter(
      (h) => !formData.holidays.includes(h)
    );
    setFormData((prev) => ({
      ...prev,
      holidays: [...prev.holidays, ...newHolidays].sort(),
    }));
    alert(`已添加 ${newHolidays.length} 个中国法定节假日`);
  };

  const handleICSImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.ics')) {
      alert('请上传 .ics 格式的文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        if (editingCalendar) {
          await importICS(editingCalendar.id, content);
          alert('ICS 文件导入成功');
          fetchCalendars();
        } else {
          const parsedHolidays = parseICS(content);
          const newHolidays = parsedHolidays.filter(
            (h) => !formData.holidays.includes(h)
          );
          setFormData((prev) => ({
            ...prev,
            holidays: [...prev.holidays, ...newHolidays].sort(),
          }));
          alert(`已解析 ${newHolidays.length} 个节假日`);
        }
      } catch (err) {
        alert('导入失败: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseICS = (content: string): string[] => {
    const holidays: string[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('DTSTART;VALUE=DATE:')) {
        const dateStr = line.split(':')[1];
        if (dateStr && dateStr.length === 8) {
          const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
          holidays.push(formatted);
        }
      } else if (line.startsWith('DTSTART:')) {
        const dateStr = line.split(':')[1];
        if (dateStr && dateStr.length >= 8) {
          const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
          holidays.push(formatted);
        }
      }
    }
    return [...new Set(holidays)].sort();
  };

  const formatWeekendPattern = (pattern: number[]) => {
    if (pattern.length === 0) return '无休息日';
    return pattern.map((d) => WEEKDAY_LABELS[d]).join(', ');
  };

  const toggleExpand = (id: string) => {
    setExpandedCalendarId(expandedCalendarId === id ? null : id);
  };

  const isEditing = isCreating || editingCalendar;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-primary-800/50 border-b border-primary-400/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary-300" />
          <h2 className="font-display text-lg font-semibold text-white">日历管理</h2>
        </div>
        {!isEditing && (
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 bg-normal-600 hover:bg-normal-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增日历
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isEditing && (
          <div className="p-6 border-b border-primary-400/20 bg-primary-800/30">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">
                  {editingCalendar ? '编辑日历' : '新增日历'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-primary-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-200 mb-2">
                  日历名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入日历名称"
                  className="w-full bg-primary-800 border border-primary-400/30 rounded px-3 py-2 text-white placeholder-primary-500 focus:outline-none focus:border-primary-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-200 mb-3">
                  周末模式（勾选表示休息日）
                </label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                        formData.weekendPattern.includes(idx)
                          ? 'bg-primary-600 text-white'
                          : 'bg-primary-800 text-primary-300 hover:bg-primary-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.weekendPattern.includes(idx)}
                        onChange={() => handleWeekendToggle(idx)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-primary-200">
                    节假日管理（共 {formData.holidays.length} 天）
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddChinaHolidays}
                      className="text-xs bg-warning-600/30 text-warning-300 hover:bg-warning-600/50 px-3 py-1.5 rounded transition-colors"
                    >
                      添加中国法定节假日 2025-2026
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs bg-primary-700 text-primary-200 hover:bg-primary-600 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      导入 ICS
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".ics"
                      onChange={handleICSImport}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    type="date"
                    value={newHoliday}
                    onChange={(e) => setNewHoliday(e.target.value)}
                    className="flex-1 bg-primary-800 border border-primary-400/30 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-400"
                  />
                  <button
                    onClick={handleAddHoliday}
                    className="bg-normal-600 hover:bg-normal-500 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    添加
                  </button>
                </div>

                {selectedHolidays.size > 0 && (
                  <button
                    onClick={handleBulkDeleteHolidays}
                    className="mb-3 text-xs bg-critical-600/30 text-critical-300 hover:bg-critical-600/50 px-3 py-1.5 rounded transition-colors"
                  >
                    删除选中的 {selectedHolidays.size} 个节假日
                  </button>
                )}

                <div className="bg-primary-900/50 rounded p-4 max-h-60 overflow-y-auto">
                  {formData.holidays.length === 0 ? (
                    <p className="text-primary-500 text-sm text-center py-4">暂无节假日</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {formData.holidays.map((date) => (
                        <label
                          key={date}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                            selectedHolidays.has(date)
                              ? 'bg-critical-600/30 text-critical-200'
                              : 'bg-primary-800 text-primary-300 hover:bg-primary-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedHolidays.has(date)}
                            onChange={() => handleHolidaySelect(date)}
                            className="w-3 h-3 rounded"
                          />
                          <Sun className="w-3 h-3" />
                          {date}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-primary-300 hover:text-white bg-primary-700 hover:bg-primary-600 rounded text-sm transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-normal-600 hover:bg-normal-500 text-white rounded text-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {editingCalendar ? '保存修改' : '创建日历'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-3">
            {calendars.map((calendar) => (
              <div
                key={calendar.id}
                className="bg-primary-800/50 border border-primary-400/20 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-primary-700/30 transition-colors"
                  onClick={() => toggleExpand(calendar.id)}
                >
                  <div className="flex items-center gap-4">
                    {expandedCalendarId === calendar.id ? (
                      <ChevronUp className="w-5 h-5 text-primary-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-primary-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{calendar.name}</span>
                        {calendar.id === 'default' && (
                          <span className="text-xs bg-primary-600 text-primary-200 px-2 py-0.5 rounded">
                            默认
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-primary-400">
                        <span className="flex items-center gap-1">
                          <Moon className="w-3 h-3" />
                          {formatWeekendPattern(calendar.weekendPattern)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sun className="w-3 h-3" />
                          {calendar.holidays.length} 个节假日
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(calendar);
                      }}
                      className="p-2 text-primary-400 hover:text-white hover:bg-primary-600 rounded transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(calendar);
                      }}
                      className={`p-2 rounded transition-colors ${
                        calendar.id === 'default'
                          ? 'text-primary-700 cursor-not-allowed'
                          : 'text-primary-400 hover:text-critical-400 hover:bg-critical-900/30'
                      }`}
                      title={calendar.id === 'default' ? '默认日历不可删除' : '删除'}
                      disabled={calendar.id === 'default'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedCalendarId === calendar.id && (
                  <div className="border-t border-primary-400/20 p-4 bg-primary-900/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-primary-200 mb-3">周末模式</h4>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAY_LABELS.map((label, idx) => (
                            <span
                              key={idx}
                              className={`px-3 py-1.5 rounded text-xs ${
                                calendar.weekendPattern.includes(idx)
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-primary-800 text-primary-400'
                              }`}
                            >
                              {label}
                              {calendar.weekendPattern.includes(idx) && (
                                <span className="ml-1 text-primary-300">✓</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-primary-200 mb-3">
                          节假日（共 {calendar.holidays.length} 天）
                        </h4>
                        <div className="bg-primary-800/50 rounded p-3 max-h-40 overflow-y-auto">
                          {calendar.holidays.length === 0 ? (
                            <p className="text-primary-500 text-xs text-center py-2">暂无节假日</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-1">
                              {calendar.holidays.slice(0, 15).map((date) => (
                                <span
                                  key={date}
                                  className="text-xs text-primary-300 flex items-center gap-1"
                                >
                                  <Sun className="w-3 h-3 text-warning-400" />
                                  {date}
                                </span>
                              ))}
                              {calendar.holidays.length > 15 && (
                                <span className="text-xs text-primary-500">
                                  等 {calendar.holidays.length} 天...
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {calendars.length === 0 && (
              <div className="text-center py-12 text-primary-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无日历，点击"新增日历"开始创建</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
