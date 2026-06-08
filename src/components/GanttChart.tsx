import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { FileImage, FileText, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Task, ViewMode, Project } from '@shared/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface GanttChartProps {
  onEditTask: (task: Task) => void;
}

const ROW_HEIGHT = 44;
const TASK_LABEL_WIDTH = 120;
const TIMELINE_HEIGHT = 48;
const DAY_WIDTHS: Record<ViewMode, number> = {
  day: 60,
  week: 20,
  month: 6,
};

function addWorkdaysSkipWeekends(startDate: Date, workdays: number): Date {
  const date = new Date(startDate);
  let remaining = workdays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }
  return date;
}

function getWorkdayDate(startDateStr: string, workdayIndex: number): Date {
  const start = new Date(startDateStr);
  if (workdayIndex <= 0) return start;
  return addWorkdaysSkipWeekends(start, workdayIndex);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
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

export function GanttChart({ onEditTask }: GanttChartProps) {
  const {
    tasks,
    totalDuration,
    config,
    viewMode,
    selectedTaskId,
    setSelectedTaskId,
    criticalPaths,
    updateTask,
    updateTaskProgress,
    projects,
    baselines,
    selectedBaselineId,
    baselineComparison,
    resources,
    currentProject,
  } = useStore();

  const [dragState, setDragState] = useState<{
    taskId: string;
    startX: number;
    originalStart: number;
  } | null>(null);

  const [showBaselinePanel, setShowBaselinePanel] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const dayWidth = DAY_WIDTHS[viewMode];
  const totalWidth = Math.max(totalDuration + 5, 20) * dayWidth;
  const chartHeight = tasks.length * ROW_HEIGHT + TIMELINE_HEIGHT + 40;

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aStart = a.manualStart !== undefined ? a.manualStart : a.es;
      const bStart = b.manualStart !== undefined ? b.manualStart : b.es;
      return aStart - bStart;
    });
  }, [tasks]);

  const criticalTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const path of criticalPaths) {
      for (const id of path) {
        ids.add(id);
      }
    }
    return ids;
  }, [criticalPaths]);

  const todayPosition = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const projectStart = new Date(config.startDate);
    projectStart.setHours(0, 0, 0, 0);
    
    let workdayCount = 0;
    const current = new Date(projectStart);
    while (current < today) {
      if (!isWeekend(current)) {
        workdayCount++;
      }
      current.setDate(current.getDate() + 1);
    }
    return workdayCount * dayWidth;
  }, [config.startDate, dayWidth]);

  const timelineTicks = useMemo(() => {
    const ticks: { x: number; label: string; major: boolean }[] = [];
    const totalDays = Math.max(totalDuration + 5, 20);

    for (let i = 0; i <= totalDays; i++) {
      const date = getWorkdayDate(config.startDate, i);
      const x = i * dayWidth;
      
      if (viewMode === 'day') {
        const isMonday = date.getDay() === 1;
        ticks.push({
          x,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          major: isMonday || i === 0,
        });
      } else if (viewMode === 'week') {
        const isMonday = date.getDay() === 1;
        if (isMonday || i === 0) {
          ticks.push({
            x,
            label: `W${Math.floor(i / 5) + 1}`,
            major: true,
          });
        }
      } else {
        const dayOfMonth = date.getDate();
        if (dayOfMonth === 1 || i === 0) {
          ticks.push({
            x,
            label: `${date.getMonth() + 1}月`,
            major: true,
          });
        }
      }
    }
    return ticks;
  }, [config.startDate, totalDuration, viewMode, dayWidth]);

  const selectedBaseline = useMemo(() => {
    return baselines.find(b => b.id === selectedBaselineId);
  }, [baselines, selectedBaselineId]);

  const handleMouseDown = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setSelectedTaskId(task.id);
    
    const start = task.manualStart !== undefined ? task.manualStart : task.es;
    setDragState({
      taskId: task.id,
      startX: e.clientX,
      originalStart: start,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !svgRef.current) return;
    
    const dx = e.clientX - dragState.startX;
    const deltaDays = Math.round(dx / dayWidth);
    let newStart = Math.max(0, dragState.originalStart + deltaDays);
    
    const task = tasks.find(t => t.id === dragState.taskId);
    if (task) {
      let minStart = 0;
      for (const depId of task.dependsOn) {
        const dep = tasks.find(t => t.id === depId);
        if (dep) {
          const depStart = dep.manualStart !== undefined ? dep.manualStart : dep.es;
          const depEnd = depStart + dep.duration;
          if (depEnd > minStart) minStart = depEnd;
        }
      }
      newStart = Math.max(newStart, minStart);
    }

    if (task && newStart !== task.manualStart) {
      updateTask(task.id, {
        name: task.name,
        duration: task.duration,
        assignee: task.assignee,
        dependsOn: task.dependsOn,
        manualStart: newStart,
        progress: task.progress,
        projectId: task.projectId,
      }).catch(() => {});
    }
  }, [dragState, tasks, dayWidth, updateTask]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const getDependencyPath = (fromTask: Task, toTask: Task): string => {
    const fromIdx = sortedTasks.findIndex(t => t.id === fromTask.id);
    const toIdx = sortedTasks.findIndex(t => t.id === toTask.id);
    
    const fromStart = fromTask.manualStart !== undefined ? fromTask.manualStart : fromTask.es;
    const fromEnd = fromStart + fromTask.duration;
    const toStart = toTask.manualStart !== undefined ? toTask.manualStart : toTask.es;
    
    const x1 = fromEnd * dayWidth;
    const y1 = TIMELINE_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const x2 = toStart * dayWidth;
    const y2 = TIMELINE_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    
    const midX = (x1 + x2) / 2;
    
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  };

  const handleProgressClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = Math.min(100, Math.max(0, Math.round((x / width) * 100)));
    updateTaskProgress(taskId, progress);
  };

  const exportPNG = async () => {
    if (!svgRef.current || !chartContainerRef.current) return;
    
    setIsExporting(true);
    try {
      const svgElement = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = svgElement.clientWidth * scale;
        canvas.height = svgElement.clientHeight * scale;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `甘特图_${new Date().toISOString().split('T')[0]}.png`;
          link.href = pngUrl;
          link.click();
        }
        
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setIsExporting(false);
        alert('导出失败，请重试');
      };
      
      img.src = url;
    } catch (error) {
      console.error('导出PNG失败:', error);
      setIsExporting(false);
      alert('导出失败，请重试');
    }
  };

  const exportPDF = async () => {
    if (!chartContainerRef.current) return;
    
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(currentProject?.name || '项目甘特图', margin, yPos);
      yPos += 8;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`生成日期: ${new Date().toLocaleDateString('zh-CN')}`, margin, yPos);
      yPos += 10;
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('一、任务列表', margin, yPos);
      yPos += 8;
      
      const tableHeaders = ['ID', '任务名称', '负责人', '工期', '开始', '结束', '进度', '状态'];
      const colWidths = [12, 50, 25, 12, 22, 22, 15, 18];
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      tableHeaders.forEach((header, i) => {
        const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        pdf.text(header, x, yPos);
      });
      yPos += 6;
      
      pdf.setFont('helvetica', 'normal');
      sortedTasks.forEach((task) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        
        const project = getProjectById(projects, task.projectId);
        const progress = task.progress ?? 0;
        const status = isOverdue(task) ? '逾期' : progress >= 100 ? '完成' : progress > 0 ? '进行中' : '未开始';
        
        const row = [
          task.id,
          task.name.substring(0, 20),
          task.assignee.substring(0, 8),
          `${task.duration}d`,
          task.startDate.substring(5),
          task.endDate.substring(5),
          `${progress}%`,
          status,
        ];
        
        row.forEach((cell, i) => {
          const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          pdf.text(cell, x, yPos);
        });
        
        if (project) {
          pdf.setFillColor(200, 200, 200);
          pdf.rect(margin + 62, yPos - 3, 2, 4, 'F');
        }
        
        yPos += 6;
      });
      
      yPos += 4;
      
      if (yPos > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('二、关键路径', margin, yPos);
      yPos += 8;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      if (criticalPaths.length > 0) {
        criticalPaths.forEach((path, idx) => {
          const pathTasks = path.map(id => {
            const t = tasks.find(task => task.id === id);
            return t ? `${id}(${t.name})` : id;
          }).join(' → ');
          pdf.text(`路径 ${idx + 1}: ${pathTasks}`, margin, yPos);
          yPos += 6;
          
          if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }
        });
      } else {
        pdf.text('暂无关键路径数据', margin, yPos);
        yPos += 6;
      }
      
      yPos += 4;
      
      if (yPos > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('三、资源列表', margin, yPos);
      yPos += 8;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      if (resources.length > 0) {
        resources.forEach((resource) => {
          pdf.text(`• ${resource.name} (日产能: ${resource.dailyCapacity}小时)`, margin, yPos);
          yPos += 6;
          
          if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }
        });
      } else {
        pdf.text('暂无资源数据', margin, yPos);
        yPos += 6;
      }
      
      if (baselineComparison && selectedBaseline) {
        yPos += 4;
        
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(`四、基线对比 (vs ${selectedBaseline.name})`, margin, yPos);
        yPos += 8;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(`项目工期变化: ${baselineComparison.projectDurationChange >= 0 ? '+' : ''}${baselineComparison.projectDurationChange} 天`, margin, yPos);
        yPos += 6;
        pdf.text(`项目结束日期变化: ${baselineComparison.projectEndDateChange >= 0 ? '+' : ''}${baselineComparison.projectEndDateChange} 天`, margin, yPos);
        yPos += 6;
        
        if (baselineComparison.criticalPathChanges.toCritical.length > 0) {
          pdf.text(`新关键任务: ${baselineComparison.criticalPathChanges.toCritical.join(', ')}`, margin, yPos);
          yPos += 6;
        }
        if (baselineComparison.criticalPathChanges.fromCritical.length > 0) {
          pdf.text(`移出关键路径: ${baselineComparison.criticalPathChanges.fromCritical.join(', ')}`, margin, yPos);
          yPos += 6;
        }
        
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('任务变化详情:', margin, yPos);
        yPos += 6;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        baselineComparison.taskComparisons.forEach((tc) => {
          if (tc.startDateDiff !== 0 || tc.endDateDiff !== 0 || tc.durationDiff !== 0 || tc.isCriticalChanged) {
            const changes: string[] = [];
            if (tc.startDateDiff !== 0) changes.push(`开始${tc.startDateDiff >= 0 ? '+' : ''}${tc.startDateDiff}d`);
            if (tc.endDateDiff !== 0) changes.push(`结束${tc.endDateDiff >= 0 ? '+' : ''}${tc.endDateDiff}d`);
            if (tc.durationDiff !== 0) changes.push(`工期${tc.durationDiff >= 0 ? '+' : ''}${tc.durationDiff}d`);
            if (tc.isCriticalChanged) changes.push(tc.isCritical ? '变为关键' : '移出关键');
            
            if (changes.length > 0) {
              pdf.text(`  ${tc.taskId} ${tc.taskName}: ${changes.join(', ')}`, margin, yPos);
              yPos += 5;
              
              if (yPos > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
              }
            }
          }
        });
      }
      
      yPos += 10;
      
      if (yPos + 80 < pageHeight - margin) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('五、甘特图预览', margin, yPos);
        yPos += 6;
        
        const canvas = await html2canvas(chartContainerRef.current, {
          scale: 2,
          backgroundColor: '#0f172a',
          logging: false,
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, pageHeight - margin - yPos));
      }
      
      pdf.save(`项目报告_${new Date().toISOString().split('T')[0]}.pdf`);
      setIsExporting(false);
    } catch (error) {
      console.error('导出PDF失败:', error);
      setIsExporting(false);
      alert('导出失败，请重试');
    }
  };

  return (
    <div className="flex flex-col h-full bg-primary-900/30 relative">
      <div className="px-4 py-3 bg-primary-800/50 border-b border-primary-400/20 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-white">甘特图</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-critical-600"></div>
              <span className="text-primary-300">关键路径</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-normal-600"></div>
              <span className="text-primary-300">普通任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-overdue-600"></div>
              <span className="text-primary-300">逾期任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-0.5 h-4 bg-emerald-500" style={{ borderStyle: 'dashed' }}></div>
              <span className="text-primary-300">今日</span>
            </div>
          </div>
          <div className="w-px h-6 bg-primary-600/30"></div>
          <button
            onClick={exportPNG}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-700/50 hover:bg-primary-600/50 text-primary-200 rounded-md transition-colors disabled:opacity-50"
          >
            <FileImage className="w-3.5 h-3.5" />
            导出 PNG
          </button>
          <button
            onClick={exportPDF}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-700/50 hover:bg-primary-600/50 text-primary-200 rounded-md transition-colors disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            导出 PDF
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto" ref={chartContainerRef}>
        <div className="flex min-w-max">
          <div 
            className="flex-shrink-0 bg-primary-800/50 border-r border-primary-400/20"
            style={{ width: TASK_LABEL_WIDTH }}
          >
            <div 
              className="bg-primary-700/50 border-b border-primary-400/20 px-3 flex items-center text-xs text-primary-300"
              style={{ height: TIMELINE_HEIGHT }}
            >
              任务
            </div>
            {sortedTasks.map((task) => {
              const project = getProjectById(projects, task.projectId);
              const overdue = isOverdue(task);
              
              return (
                <div
                  key={task.id}
                  className={`px-3 flex items-center text-sm border-b border-primary-400/10 cursor-pointer transition-colors ${
                    selectedTaskId === task.id ? 'bg-normal-600/20' : 'hover:bg-primary-700/20'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                  onDoubleClick={() => onEditTask(task)}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold mr-2 ${
                    task.isCritical ? 'bg-critical-600 text-white' : 'bg-normal-600 text-white'
                  }`}>
                    {task.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`truncate block ${
                      overdue ? 'text-overdue-400' : task.isCritical ? 'text-critical-300' : 'text-white'
                    }`}>
                      {task.name}
                    </span>
                    {project && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        ></div>
                        <span className="text-[10px] text-primary-400 truncate">
                          {project.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative flex-1">
            <svg
              ref={svgRef}
              width={totalWidth}
              height={chartHeight}
              className="select-none"
              onClick={() => setSelectedTaskId(null)}
            >
              <defs>
                <linearGradient id="criticalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <linearGradient id="normalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="weekendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(251, 191, 36, 0.08)" />
                  <stop offset="100%" stopColor="rgba(251, 191, 36, 0.02)" />
                </linearGradient>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <pattern id="overduePattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                  <rect width="4" height="8" fill="rgba(239, 68, 68, 0.3)" />
                </pattern>
              </defs>

              {Array.from({ length: Math.max(totalDuration + 5, 20) }).map((_, i) => {
                const date = getWorkdayDate(config.startDate, i);
                if (isWeekend(date)) {
                  const x = i * dayWidth;
                  return (
                    <rect
                      key={`weekend-${i}`}
                      x={x}
                      y={0}
                      width={dayWidth}
                      height={chartHeight}
                      fill="url(#weekendGradient)"
                    />
                  );
                }
                return null;
              })}

              {timelineTicks.map((tick, i) => (
                <g key={`tick-${i}`}>
                  <line
                    x1={tick.x}
                    y1={TIMELINE_HEIGHT}
                    x2={tick.x}
                    y2={chartHeight}
                    className={tick.major ? 'gantt-axis-line' : 'gantt-grid-line'}
                  />
                  {tick.major && (
                    <text
                      x={tick.x + 2}
                      y={TIMELINE_HEIGHT - 12}
                      className="fill-primary-400 text-[10px] font-medium"
                    >
                      {tick.label}
                    </text>
                  )}
                </g>
              ))}

              <line
                x1={0}
                y1={TIMELINE_HEIGHT}
                x2={totalWidth}
                y2={TIMELINE_HEIGHT}
                className="gantt-axis-line"
              />

              {todayPosition > 0 && todayPosition < totalWidth && (
                <line
                  x1={todayPosition}
                  y1={0}
                  x2={todayPosition}
                  y2={chartHeight}
                  className="gantt-today-line"
                />
              )}

              {sortedTasks.map((task, idx) => (
                <line
                  key={`row-line-${task.id}`}
                  x1={0}
                  y1={TIMELINE_HEIGHT + (idx + 1) * ROW_HEIGHT}
                  x2={totalWidth}
                  y2={TIMELINE_HEIGHT + (idx + 1) * ROW_HEIGHT}
                  className="gantt-grid-line"
                />
              ))}

              {sortedTasks.map((toTask) =>
                toTask.dependsOn.map((depId) => {
                  const fromTask = tasks.find(t => t.id === depId);
                  if (!fromTask) return null;
                  const isCritical = criticalTaskIds.has(fromTask.id) && criticalTaskIds.has(toTask.id);
                  return (
                    <path
                      key={`dep-${fromTask.id}-${toTask.id}`}
                      d={getDependencyPath(fromTask, toTask)}
                      className={`gantt-dependency-line ${isCritical ? 'critical' : ''}`}
                      markerEnd={isCritical ? 'url(#arrowhead-critical)' : 'url(#arrowhead)'}
                    />
                  );
                })
              )}

              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="4"
                  refX="5"
                  refY="2"
                  orient="auto"
                >
                  <polygon points="0 0, 6 2, 0 4" fill="rgba(79, 126, 171, 0.5)" />
                </marker>
                <marker
                  id="arrowhead-critical"
                  markerWidth="6"
                  markerHeight="4"
                  refX="5"
                  refY="2"
                  orient="auto"
                >
                  <polygon points="0 0, 6 2, 0 4" fill="#dc2626" />
                </marker>
              </defs>

              {sortedTasks.map((task, idx) => {
                const start = task.manualStart !== undefined ? task.manualStart : task.es;
                const x = start * dayWidth;
                const y = TIMELINE_HEIGHT + idx * ROW_HEIGHT + 8;
                const width = task.duration * dayWidth - 4;
                const height = ROW_HEIGHT - 16;
                const isSelected = selectedTaskId === task.id;
                const isDragging = dragState?.taskId === task.id;
                const progress = task.progress ?? 0;
                const overdue = isOverdue(task);
                const progressWidth = (progress / 100) * width;

                return (
                  <g
                    key={task.id}
                    className={`gantt-bar ${isDragging ? 'dragging' : ''}`}
                    onMouseDown={(e) => handleMouseDown(e, task)}
                    onDoubleClick={() => onEditTask(task)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx={4}
                      fill={task.isCritical ? 'url(#criticalGradient)' : 'url(#normalGradient)'}
                      stroke={isSelected ? '#fbbf24' : 'transparent'}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                    
                    {progress > 0 && (
                      <rect
                        x={x}
                        y={y}
                        width={progressWidth}
                        height={height}
                        rx={4}
                        fill="url(#progressGradient)"
                        opacity={0.8}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => handleProgressClick(e, task.id)}
                      />
                    )}
                    
                    {overdue && (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={4}
                        fill="url(#overduePattern)"
                      />
                    )}
                    
                    {width > 60 && (
                      <>
                        <text
                          x={x + 8}
                          y={y + height / 2 + 4}
                          className="fill-white text-[11px] font-medium pointer-events-none"
                        >
                          {task.name} ({task.duration}d)
                        </text>
                        {progress > 0 && (
                          <text
                            x={x + width - 8}
                            y={y + height / 2 + 4}
                            textAnchor="end"
                            className="fill-white/90 text-[10px] font-bold pointer-events-none"
                          >
                            {progress}%
                          </text>
                        )}
                      </>
                    )}
                    
                    {width <= 60 && progress > 0 && (
                      <text
                        x={x + width / 2}
                        y={y + height / 2 + 4}
                        textAnchor="middle"
                        className="fill-white text-[10px] font-bold pointer-events-none"
                      >
                        {progress}%
                      </text>
                    )}
                    
                    {task.slack > 0 && (
                      <>
                        <rect
                          x={x + width}
                          y={y + height / 2 - 2}
                          width={task.slack * dayWidth - 2}
                          height={4}
                          rx={2}
                          fill={task.isCritical ? '#dc2626' : '#2563eb'}
                          opacity={0.3}
                        />
                        <line
                          x1={x + width}
                          y1={y + height / 2}
                          x2={x + width + task.slack * dayWidth}
                          y2={y + height / 2}
                          stroke={task.isCritical ? '#dc2626' : '#2563eb'}
                          strokeWidth={1}
                          strokeDasharray="3,3"
                          opacity={0.5}
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {selectedBaseline && (
        <div className={`absolute bottom-4 right-4 bg-primary-800/95 backdrop-blur-sm border border-primary-400/30 rounded-lg shadow-xl transition-all ${
          showBaselinePanel ? 'w-80' : 'w-auto'
        }`}>
          <div 
            className="px-4 py-2 border-b border-primary-400/20 flex items-center justify-between cursor-pointer"
            onClick={() => setShowBaselinePanel(!showBaselinePanel)}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">vs {selectedBaseline.name}</span>
            </div>
            {showBaselinePanel ? (
              <ChevronDown className="w-4 h-4 text-primary-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-primary-400" />
            )}
          </div>
          
          {showBaselinePanel && baselineComparison && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary-700/30 rounded-md p-2">
                  <div className="text-xs text-primary-400 mb-1">工期变化</div>
                  <div className={`text-lg font-bold flex items-center gap-1 ${
                    baselineComparison.projectDurationChange > 0 ? 'text-overdue-400' :
                    baselineComparison.projectDurationChange < 0 ? 'text-emerald-400' : 'text-primary-200'
                  }`}>
                    {baselineComparison.projectDurationChange > 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : baselineComparison.projectDurationChange < 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                    {baselineComparison.projectDurationChange >= 0 ? '+' : ''}
                    {baselineComparison.projectDurationChange}d
                  </div>
                </div>
                <div className="bg-primary-700/30 rounded-md p-2">
                  <div className="text-xs text-primary-400 mb-1">结束日期</div>
                  <div className={`text-lg font-bold flex items-center gap-1 ${
                    baselineComparison.projectEndDateChange > 0 ? 'text-overdue-400' :
                    baselineComparison.projectEndDateChange < 0 ? 'text-emerald-400' : 'text-primary-200'
                  }`}>
                    {baselineComparison.projectEndDateChange > 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : baselineComparison.projectEndDateChange < 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                    {baselineComparison.projectEndDateChange >= 0 ? '+' : ''}
                    {baselineComparison.projectEndDateChange}d
                  </div>
                </div>
              </div>
              
              {baselineComparison.criticalPathChanges.toCritical.length > 0 && (
                <div>
                  <div className="text-xs text-primary-400 mb-1">新关键任务</div>
                  <div className="flex flex-wrap gap-1">
                    {baselineComparison.criticalPathChanges.toCritical.map((taskId) => (
                      <span key={taskId} className="px-1.5 py-0.5 bg-critical-900/50 text-critical-300 text-xs rounded">
                        {taskId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {baselineComparison.criticalPathChanges.fromCritical.length > 0 && (
                <div>
                  <div className="text-xs text-primary-400 mb-1">移出关键路径</div>
                  <div className="flex flex-wrap gap-1">
                    {baselineComparison.criticalPathChanges.fromCritical.map((taskId) => (
                      <span key={taskId} className="px-1.5 py-0.5 bg-primary-700/50 text-primary-300 text-xs rounded">
                        {taskId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <div className="text-xs text-primary-400 mb-1">
                  有变化的任务 ({baselineComparison.taskComparisons.filter(
                    tc => tc.startDateDiff !== 0 || tc.endDateDiff !== 0 || tc.durationDiff !== 0 || tc.isCriticalChanged
                  ).length})
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {baselineComparison.taskComparisons.filter(
                    tc => tc.startDateDiff !== 0 || tc.endDateDiff !== 0 || tc.durationDiff !== 0 || tc.isCriticalChanged
                  ).slice(0, 5).map((tc) => (
                    <div key={tc.taskId} className="flex items-center justify-between text-xs bg-primary-700/20 rounded px-2 py-1">
                      <span className="text-primary-200 truncate flex-1">{tc.taskId} {tc.taskName}</span>
                      <div className="flex items-center gap-1 ml-2">
                        {tc.startDateDiff !== 0 && (
                          <span className={tc.startDateDiff > 0 ? 'text-overdue-400' : 'text-emerald-400'}>
                            S{tc.startDateDiff > 0 ? '+' : ''}{tc.startDateDiff}d
                          </span>
                        )}
                        {tc.durationDiff !== 0 && (
                          <span className={tc.durationDiff > 0 ? 'text-overdue-400' : 'text-emerald-400'}>
                            D{tc.durationDiff > 0 ? '+' : ''}{tc.durationDiff}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {baselineComparison.taskComparisons.filter(
                    tc => tc.startDateDiff !== 0 || tc.endDateDiff !== 0 || tc.durationDiff !== 0 || tc.isCriticalChanged
                  ).length > 5 && (
                    <div className="text-xs text-primary-500 text-center py-1">
                      还有 {baselineComparison.taskComparisons.filter(
                        tc => tc.startDateDiff !== 0 || tc.endDateDiff !== 0 || tc.durationDiff !== 0 || tc.isCriticalChanged
                      ).length - 5} 个变更...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
