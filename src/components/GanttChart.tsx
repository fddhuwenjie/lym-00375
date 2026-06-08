import { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import type { Task, ViewMode } from '@shared/types';

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

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
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
  } = useStore();

  const [dragState, setDragState] = useState<{
    taskId: string;
    startX: number;
    originalStart: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
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

  const handleMouseMove = (e: MouseEvent) => {
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
      }).catch(() => {});
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, tasks, dayWidth]);

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

  return (
    <div className="flex flex-col h-full bg-primary-900/30">
      <div className="px-4 py-3 bg-primary-800/50 border-b border-primary-400/20 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-white">甘特图</h2>
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
            <div className="w-0.5 h-4 bg-emerald-500" style={{ borderStyle: 'dashed' }}></div>
            <span className="text-primary-300">今日</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
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
            {sortedTasks.map((task, idx) => (
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
                <span className={`truncate ${
                  task.isCritical ? 'text-critical-300' : 'text-white'
                }`}>
                  {task.name}
                </span>
              </div>
            ))}
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
                    {width > 60 && (
                      <text
                        x={x + 8}
                        y={y + height / 2 + 4}
                        className="fill-white text-[11px] font-medium pointer-events-none"
                      >
                        {task.name} ({task.duration}d)
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
    </div>
  );
}
