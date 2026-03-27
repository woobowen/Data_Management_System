# PROJECT.md

## 项目概览
第一阶段目标：落地基于 Node.js + TypeScript + MongoDB 的问卷系统后端，完成注册登录、问卷草稿管理、发布、动态跳转答题、统计聚合与自动化测试闭环。

## 分层架构
- Controller：处理 HTTP 请求与响应格式。
- Service：承载核心业务，包括鉴权、问卷管理、路径重演、统计聚合。
- Model：Mongoose Schema，定义 MongoDB 数据契约。
- Route：按模块挂载路由。
- Middlewares：鉴权、错误处理、请求上下文。

## MongoDB Schema V2 数据契约

### Users
- `_id`: ObjectId
- `username`: String, unique, required
- `passwordHash`: String, required
- `createdAt`: Date, required

### Surveys
- `_id`: ObjectId
- `ownerId`: ObjectId, required
- `title`: String, required
- `description`: String, default `""`
- `status`: `draft | published | closed`, required
- `allowAnonymous`: Boolean, required
- `deadlineAt`: Date, nullable
- `questions`: Question[]

### Surveys.questions
- `questionId`: String（UUID / NanoID，稳定业务 ID）
- `type`: `single_choice | multi_choice | text | number`
- `title`: String
- `isRequired`: Boolean
- `order`: Number
- `options`: `{ optionId: String, text: String }[]`
- `validation`:
  - 单选/多选：`{ minSelected?: Number, maxSelected?: Number }`
  - 文本：`{ minLength?: Number, maxLength?: Number }`
  - 数字：`{ min?: Number, max?: Number, isInteger?: Boolean }`
- `logicRules`: Rule[]
- `defaultNextQuestionId`: String（可为 `END`）

### Surveys.questions.logicRules
- `condition`: `eq | gt | lt | includes`
- `targetValue`: Mixed
- `nextQuestionId`: String（可为 `END`）

### Responses
- `_id`: ObjectId
- `surveyId`: ObjectId, required
- `respondentId`: String, required
- `status`: `in_progress | submitted`, required
- `submittedAt`: Date, nullable
- `answers`: Answer[]

### Responses.answers
- `questionId`: String
- `type`: String
- `value`: Mixed

## 第一阶段关键约束
- `allowAnonymous=false` 时，提交答卷必须携带有效 JWT。
- `allowAnonymous=true` 时，允许匿名提交，后端为答卷生成匿名 `respondentId`。
- 问卷发布后只允许轻量文本修订；结构性变更应通过复制新问卷实现。
- `/submit` 必须以后端路径重演为准，拒绝幽灵答案、非法跳题、死循环、必答漏答与类型不合法输入。

## 测试目标
- 注册/登录
- 创建问卷与发布
- 动态跳转正常路径提交
- 非法输入与非法路径拦截
- 统计接口正确性
