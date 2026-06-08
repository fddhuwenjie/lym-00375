import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'project.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initSql = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#2563eb',
  calendar_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0),
  assignee TEXT NOT NULL,
  manual_start INTEGER,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  actual_start_date TEXT,
  actual_end_date TEXT,
  calendar_id TEXT,
  time_off TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  daily_capacity INTEGER DEFAULT 8 CHECK (daily_capacity > 0),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  total_duration INTEGER NOT NULL,
  project_end_date TEXT NOT NULL,
  critical_paths TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS baseline_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baseline_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  duration INTEGER NOT NULL,
  is_critical INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (baseline_id) REFERENCES baselines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weekend_pattern TEXT DEFAULT '[0,6]',
  holidays TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, date)
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  tasks TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(initSql);

const configCount = db.prepare('SELECT COUNT(*) as cnt FROM project_config').get() as { cnt: number };
if (configCount.cnt === 0) {
  const today = new Date().toISOString().split('T')[0];
  db.prepare('INSERT INTO project_config (key, value) VALUES (?, ?)').run('start_date', today);
}

const calendarCount = db.prepare('SELECT COUNT(*) as cnt FROM calendars').get() as { cnt: number };
if (calendarCount.cnt === 0) {
  const chinaHolidays2025 = [
    '2025-01-01',
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
    '2025-04-04', '2025-04-05', '2025-04-06',
    '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
    '2025-06-01', '2025-06-02',
    '2025-09-06', '2025-09-07', '2025-09-08',
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07',
  ];
  const chinaHolidays2026 = [
    '2026-01-01', '2026-01-02', '2026-01-03',
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', '2026-02-24',
    '2026-04-04', '2026-04-05', '2026-04-06',
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    '2026-06-01', '2026-06-02',
    '2026-09-25', '2026-09-26', '2026-09-27',
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
  ];
  const allHolidays = [...chinaHolidays2025, ...chinaHolidays2026];
  
  db.prepare(
    'INSERT INTO calendars (id, name, weekend_pattern, holidays) VALUES (?, ?, ?, ?)'
  ).run('default', '默认日历', '[0,6]', JSON.stringify(allHolidays));
}

const projectCount = db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number };
if (projectCount.cnt === 0) {
  db.prepare(
    'INSERT INTO projects (id, name, color, calendar_id) VALUES (?, ?, ?, ?)'
  ).run('default', '默认项目', '#2563eb', 'default');
}

const taskCount = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number };
if (taskCount.cnt === 0) {
  const insertTask = db.prepare(
    'INSERT INTO tasks (id, project_id, name, duration, assignee, progress) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertDep = db.prepare(
    'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
  );

  const tx = db.transaction(() => {
    insertTask.run('A', 'default', '需求分析', 3, '张三', 0);
    insertTask.run('B', 'default', '系统设计', 2, '李四', 0);
    insertTask.run('C', 'default', '开发实现', 5, '王五', 0);
    insertTask.run('D', 'default', 'UI设计', 2, '赵六', 0);
    insertTask.run('E', 'default', '测试验收', 3, '张三', 0);

    insertDep.run('B', 'A');
    insertDep.run('D', 'A');
    insertDep.run('C', 'B');
    insertDep.run('C', 'D');
    insertDep.run('E', 'C');
  });

  tx();
}

const resourceCount = db.prepare('SELECT COUNT(*) as cnt FROM resources').get() as { cnt: number };
if (resourceCount.cnt === 0) {
  const insertResource = db.prepare(
    'INSERT INTO resources (name, daily_capacity) VALUES (?, ?)'
  );
  insertResource.run('张三', 8);
  insertResource.run('李四', 8);
  insertResource.run('王五', 8);
  insertResource.run('赵六', 8);
}

const templateCount = db.prepare('SELECT COUNT(*) as cnt FROM templates').get() as { cnt: number };
if (templateCount.cnt === 0) {
  const insertTemplate = db.prepare(
    'INSERT INTO templates (id, name, description, is_default, tasks) VALUES (?, ?, ?, ?, ?)'
  );

  const waterfallTemplate = {
    id: 'waterfall',
    name: '瀑布软件项目',
    description: '经典瀑布开发流程，适用于需求明确的软件项目',
    isDefault: true,
    tasks: JSON.stringify([
      { name: '需求调研与分析', duration: 5, assignee: '产品经理', dependsOn: [] },
      { name: '系统架构设计', duration: 3, assignee: '架构师', dependsOn: ['需求调研与分析'] },
      { name: 'UI/UX 设计', duration: 5, assignee: '设计师', dependsOn: ['需求调研与分析'] },
      { name: '前端开发', duration: 10, assignee: '前端工程师', dependsOn: ['系统架构设计', 'UI/UX 设计'] },
      { name: '后端开发', duration: 10, assignee: '后端工程师', dependsOn: ['系统架构设计'] },
      { name: '集成测试', duration: 5, assignee: '测试工程师', dependsOn: ['前端开发', '后端开发'] },
      { name: '部署上线', duration: 2, assignee: '运维工程师', dependsOn: ['集成测试'] },
    ]),
  };

  const agileTemplate = {
    id: 'agile',
    name: '敏捷迭代',
    description: '两周迭代的敏捷开发流程',
    isDefault: true,
    tasks: JSON.stringify([
      { name: 'Sprint 规划会议', duration: 1, assignee: 'Scrum Master', dependsOn: [] },
      { name: '需求细化', duration: 2, assignee: '产品经理', dependsOn: ['Sprint 规划会议'] },
      { name: '开发实现', duration: 7, assignee: '开发团队', dependsOn: ['需求细化'] },
      { name: '代码评审', duration: 1, assignee: '技术负责人', dependsOn: ['开发实现'] },
      { name: '测试验证', duration: 2, assignee: '测试工程师', dependsOn: ['代码评审'] },
      { name: 'Sprint 评审', duration: 1, assignee: 'Scrum Master', dependsOn: ['测试验证'] },
      { name: 'Sprint 回顾', duration: 1, assignee: 'Scrum Master', dependsOn: ['Sprint 评审'] },
    ]),
  };

  const decorationTemplate = {
    id: 'decoration',
    name: '装修工程',
    description: '家庭装修项目完整流程',
    isDefault: true,
    tasks: JSON.stringify([
      { name: '设计方案确认', duration: 3, assignee: '设计师', dependsOn: [] },
      { name: '拆改工程', duration: 5, assignee: '拆改队', dependsOn: ['设计方案确认'] },
      { name: '水电改造', duration: 7, assignee: '水电工', dependsOn: ['拆改工程'] },
      { name: '泥瓦工程', duration: 10, assignee: '泥瓦工', dependsOn: ['水电改造'] },
      { name: '木工制作', duration: 10, assignee: '木工', dependsOn: ['泥瓦工程'] },
      { name: '油漆工程', duration: 7, assignee: '油漆工', dependsOn: ['木工制作'] },
      { name: '安装工程', duration: 5, assignee: '安装队', dependsOn: ['油漆工程'] },
      { name: '清洁开荒', duration: 2, assignee: '清洁队', dependsOn: ['安装工程'] },
      { name: '竣工验收', duration: 1, assignee: '业主', dependsOn: ['清洁开荒'] },
    ]),
  };

  const weddingTemplate = {
    id: 'wedding',
    name: '婚礼筹备',
    description: '婚礼筹备完整时间表',
    isDefault: true,
    tasks: JSON.stringify([
      { name: '确定婚期与预算', duration: 3, assignee: '新人', dependsOn: [] },
      { name: '预订婚宴酒店', duration: 5, assignee: '新人', dependsOn: ['确定婚期与预算'] },
      { name: '选择婚庆公司', duration: 3, assignee: '新人', dependsOn: ['确定婚期与预算'] },
      { name: '拍摄婚纱照', duration: 7, assignee: '新人', dependsOn: ['选择婚庆公司'] },
      { name: '选购婚纱礼服', duration: 5, assignee: '新人', dependsOn: ['确定婚期与预算'] },
      { name: '发送请柬', duration: 3, assignee: '新人', dependsOn: ['预订婚宴酒店'] },
      { name: '婚车预订', duration: 2, assignee: '新人', dependsOn: ['确定婚期与预算'] },
      { name: '婚礼彩排', duration: 1, assignee: '新人', dependsOn: ['选择婚庆公司', '预订婚宴酒店'] },
      { name: '婚礼当天', duration: 1, assignee: '新人', dependsOn: ['婚礼彩排'] },
    ]),
  };

  const researchTemplate = {
    id: 'research',
    name: '研究论文',
    description: '学术论文研究与撰写流程',
    isDefault: true,
    tasks: JSON.stringify([
      { name: '文献调研', duration: 10, assignee: '研究者', dependsOn: [] },
      { name: '确定研究方向', duration: 3, assignee: '研究者', dependsOn: ['文献调研'] },
      { name: '实验设计', duration: 5, assignee: '研究者', dependsOn: ['确定研究方向'] },
      { name: '数据采集', duration: 15, assignee: '研究者', dependsOn: ['实验设计'] },
      { name: '数据分析', duration: 10, assignee: '研究者', dependsOn: ['数据采集'] },
      { name: '论文撰写', duration: 15, assignee: '研究者', dependsOn: ['数据分析'] },
      { name: '导师评审', duration: 7, assignee: '导师', dependsOn: ['论文撰写'] },
      { name: '修改完善', duration: 7, assignee: '研究者', dependsOn: ['导师评审'] },
      { name: '投稿', duration: 2, assignee: '研究者', dependsOn: ['修改完善'] },
    ]),
  };

  const launchTemplate = {
    id: 'product-launch',
    name: '产品发布',
    description: '新产品上市发布全流程',
    isDefault: true,
    tasks: JSON.stringify([
      { name: '市场调研', duration: 10, assignee: '市场部', dependsOn: [] },
      { name: '产品定位', duration: 5, assignee: '产品部', dependsOn: ['市场调研'] },
      { name: '营销方案制定', duration: 7, assignee: '市场部', dependsOn: ['产品定位'] },
      { name: '宣传物料制作', duration: 10, assignee: '设计部', dependsOn: ['营销方案制定'] },
      { name: '媒体渠道洽谈', duration: 7, assignee: '市场部', dependsOn: ['营销方案制定'] },
      { name: '发布会筹备', duration: 15, assignee: '市场部', dependsOn: ['宣传物料制作', '媒体渠道洽谈'] },
      { name: '发布会彩排', duration: 2, assignee: '市场部', dependsOn: ['发布会筹备'] },
      { name: '产品发布会', duration: 1, assignee: '市场部', dependsOn: ['发布会彩排'] },
      { name: '后续推广', duration: 10, assignee: '市场部', dependsOn: ['产品发布会'] },
    ]),
  };

  insertTemplate.run(waterfallTemplate.id, waterfallTemplate.name, waterfallTemplate.description, 1, waterfallTemplate.tasks);
  insertTemplate.run(agileTemplate.id, agileTemplate.name, agileTemplate.description, 1, agileTemplate.tasks);
  insertTemplate.run(decorationTemplate.id, decorationTemplate.name, decorationTemplate.description, 1, decorationTemplate.tasks);
  insertTemplate.run(weddingTemplate.id, weddingTemplate.name, weddingTemplate.description, 1, weddingTemplate.tasks);
  insertTemplate.run(researchTemplate.id, researchTemplate.name, researchTemplate.description, 1, researchTemplate.tasks);
  insertTemplate.run(launchTemplate.id, launchTemplate.name, launchTemplate.description, 1, launchTemplate.tasks);
}

export default db;
