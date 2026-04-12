# Data_Management_System

基于 `MongoDB + Express + React + TypeScript` 的在线问卷系统课程项目，按《大作业一.docx》完成两阶段迭代开发。

## 功能概览

- 阶段一：账号注册登录、问卷创建/编辑/发布/关闭、动态跳转、提交校验、统计查询。
- 阶段二：题库管理、题目复用、共享、版本链、历史回退、使用关系追踪、版本备注。

## 环境要求

- Node.js：建议 `22.x`
- MongoDB：可连接实例（默认 `mongodb://127.0.0.1:27017/survey_system_v1`）

## 环境变量

从 `.env.example` 复制为 `.env`，至少包含：

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/survey_system_v1
JWT_SECRET=survey-system-secret
JWT_EXPIRES_IN=7d
```

## 启动方式

后端（仓库根目录）：

```bash
npm install
npm run dev
```

前端（`frontend/`）：

```bash
npm install
npm run dev
```

常用命令：

```bash
npm test
npm run build
```

## 提交文档与评分项映射

| 提交要求（大作业一） | 对应文件 |
| --- | --- |
| 系统说明 / 数据库设计 / API说明 / 关键逻辑 | `SYSTEM_AND_API_DESIGN.md` |
| 测试用例（步骤、输入、输出、结果） | `TEST_CASES.md` |
| 项目完成报告（目标、设计、AI、测试、问题与解决） | `PROJECT_REPORT_AND_TESTS.md` |
| AI 使用日志明细 | `AI_USAGE_LOG.md` |
| 协作交接材料 | `HANDOVER.md` |

## 仓库

- GitHub: https://github.com/woobowen/Data_Management_System
