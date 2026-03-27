# SYSTEM_DESIGN.md

## 1. 系统说明

本项目第一阶段实现了一个基于 `Node.js + Express + TypeScript + MongoDB` 的动态问卷系统，并配套交付了 `React + Vite + Framer Motion` 的填写端。系统的核心思想可以概括为“脑手分离双轨流架构”：

- 后端负责“脑”：
  负责问卷结构校验、发布前合法性检查、提交路径重演、防伪造校验、聚合统计。
- 前端负责“手”：
  负责纸质化视觉呈现、输入采集、轻量本地路径推演、翻页与浮雕交互。

整体运行机制如下：

1. 管理端通过后端接口创建或修改草稿问卷。
2. 发布时，后端重新验证题目唯一性、跳转目标合法性、图是否有环、是否存在不可达题。
3. 填写端访问 `GET /api/surveys/:id/render`，只获取公开问卷定义。
4. 前端用本地 `survey-engine` 做体验级路径推演，但不拥有最终裁决权。
5. 提交时，后端从首题开始重演完整作答路径，只接受真实可达路径上的答案。
6. 统计页通过 MongoDB 聚合管道读取 `Responses` 集合，生成选择题计数、数值平均值和文本收集结果。

因此，前端动画状态与后端真实路径之间是解耦的：前端负责体验，后端负责真实性与安全性。

## 2. 数据库设计

### 2.1 集合结构

#### Users

用于保存系统用户账号。

```ts
{
  _id: ObjectId,
  username: string,
  passwordHash: string,
  createdAt: Date
}
```

#### Surveys

用于保存一份问卷的完整定义。题目、选项、校验规则和跳转规则都嵌套在一条文档中。

```ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  title: string,
  description: string,
  status: 'draft' | 'published' | 'closed',
  allowAnonymous: boolean,
  deadlineAt: Date | null,
  questions: [
    {
      questionId: string,
      type: 'single_choice' | 'multi_choice' | 'text' | 'number',
      title: string,
      isRequired: boolean,
      order: number,
      options: [{ optionId: string, text: string }],
      validation: {
        minSelected?: number,
        maxSelected?: number,
        minLength?: number,
        maxLength?: number,
        min?: number,
        max?: number,
        isInteger?: boolean
      },
      logicRules: [
        {
          condition: 'eq' | 'gt' | 'lt' | 'includes',
          targetValue: unknown,
          nextQuestionId: string
        }
      ],
      defaultNextQuestionId: string
    }
  ]
}
```

#### Responses

用于保存一份已经提交的问卷答卷。答卷中的答案同样以内嵌数组形式存储。

```ts
{
  _id: ObjectId,
  surveyId: ObjectId,
  respondentId: string,
  status: 'in_progress' | 'submitted',
  submittedAt: Date | null,
  answers: [
    {
      questionId: string,
      type: 'single_choice' | 'multi_choice' | 'text' | 'number',
      value: unknown
    }
  ]
}
```

### 2.2 为什么采用文档嵌套结构而不是关系型数据库

本项目选择 MongoDB 文档模型，而不是将问卷拆成大量关系表，原因有三点：

- 问卷天然是聚合根。
  一份问卷的题目、选项、校验规则和跳转规则具有强绑定关系，读取时通常需要整份问卷一次性取出。将其放在同一文档中更符合业务访问模式。
- 结构灵活，适合题型扩展。
  不同题型需要的 `validation` 字段不同，逻辑跳转规则的 `targetValue` 也可能是字符串、数字或数组。MongoDB 的 `Mixed` 和嵌套对象更容易承载这类异构结构。
- 减少 join 成本，简化渲染与校验。
  `/render` 和 `/submit` 都需要整份问卷定义。若使用关系型表，通常需要拼接问卷表、题目表、选项表、规则表。当前设计只需读一条问卷文档即可完成排序、重演和校验。

### 2.3 为什么这种结构特别适合 MongoDB

MongoDB 在本项目中的优势主要体现在：

- `questions`、`options`、`logicRules` 都是天然嵌套数组，和文档模型高度契合。
- `validation` 与 `targetValue` 具备模式可变性，MongoDB 对这种柔性字段支持更自然。
- `Responses.answers` 可以直接被 `$unwind` 展开，再进入 `$group`、`$facet`、`$avg` 等聚合阶段，非常适合统计场景。
- 管理端和填写端读取的都是“完整对象”，不是“表间拼装对象”，因此代码与数据模型更加一致。

## 3. API 说明

统一响应格式：

```json
{
  "code": 200,
  "message": "ok",
  "data": {}
}
```

### 3.1 `GET /api/surveys/:id/render`

用途：返回填写端渲染所需的公开问卷定义。

请求参数：

- 路径参数：`id` 为问卷 `_id`

成功响应示意：

```json
{
  "code": 200,
  "message": "获取问卷定义成功",
  "data": {
    "surveyId": "67e4...",
    "title": "职业调查",
    "description": "第一阶段测试问卷",
    "status": "published",
    "allowAnonymous": true,
    "deadlineAt": null,
    "questions": []
  }
}
```

关键行为：

- 仅允许 `published` 问卷被渲染。
- 截止时间已过时直接拒绝。
- 不暴露 `ownerId` 等管理字段。

### 3.2 `POST /api/surveys/:id/submit`

用途：提交答卷，并由后端执行路径重演、防伪造校验与必答校验。

请求体：

```json
{
  "answers": [
    {
      "questionId": "q1",
      "type": "single_choice",
      "value": "optA"
    }
  ]
}
```

成功响应：

```json
{
  "code": 201,
  "message": "提交成功",
  "data": {
    "responseId": "67e4...",
    "respondentId": "anon-uuid"
  }
}
```

错误场景：

- 问卷不存在
- 问卷未发布或已截止
- 匿名问卷限制不满足
- 必答题缺失
- 题型与答案不匹配
- 非法选项、长度越界、数值越界
- 幽灵答案、非法跳题、死循环

### 3.3 `GET /api/statistics/surveys/:id`

用途：读取指定问卷的统计结果。

请求参数：

- 路径参数：`id` 为问卷 `_id`
- 请求头：必须带当前 owner 的 JWT

成功响应示意：

```json
{
  "code": 200,
  "message": "获取统计成功",
  "data": {
    "surveyId": "67e4...",
    "questions": [
      {
        "questionId": "q1",
        "type": "single_choice",
        "title": "你是否在职",
        "optionCounts": [
          { "questionId": "q1", "optionId": "optA", "count": 1 }
        ],
        "average": null,
        "responseCount": 1,
        "textValues": []
      }
    ]
  }
}
```

统计实现方式：

- 选择题：`$unwind + $group`
- 多选题：`$unwind answers.value + $group`
- 数字题：`$avg`
- 文本题：`$push`

## 4. 关键逻辑说明

### 4.1 发布前结构校验

后端在创建草稿、更新草稿和发布时都会调用问卷定义校验逻辑，检查：

- `questionId` 是否重复
- `order` 是否重复
- 选项 `optionId` 是否重复
- 校验区间是否自相矛盾
- 跳转目标是否存在或为 `END`
- 默认跳转是否非法
- 跳转图是否有环
- 是否存在不可达题目

这意味着错误问卷无法进入填写阶段。

### 4.2 路径重演验证引擎

提交阶段的核心不是“相信前端传来的路径”，而是“后端自己重演路径”。

核心流程如下：

1. 将提交答案构造成 `answerMap`。
2. 将问卷题目按 `order` 排序，取第一个题目作为入口。
3. 进入循环：
   - 取当前题目。
   - 记录到 `visitedQuestionIds` 与 `visitedSet`。
   - 验证当前题目的答案类型与值是否合法。
   - 按 `logicRules` 顺序匹配首个命中规则。
   - 若无命中规则，则走 `defaultNextQuestionId`。
4. 如果某个提交答案不在 `visitedSet` 中，则判为幽灵答案或非法跳题。
5. 最终只按 `visitedQuestionIds` 顺序落库存储答案。

### 4.3 为什么它能防止幽灵答案

例如：

- `q1=optA` 时真实路径应为 `q1 -> q2`
- 但用户伪造提交 `q3` 的答案

后端重演后，`visitedSet` 中不会出现 `q3`。因此在最终校验阶段，`q3` 会触发：

```txt
存在非法跳题或幽灵答案
```

### 4.4 前后端双重重演

前端也实现了一个 `replayFromStart`，但职责不同：

- 前端重演：用于交互体验、即时翻页、路径剪枝提示
- 后端重演：用于最终真实性裁决

因此即使前端状态被篡改，后端仍能以服务端规则拒绝非法提交。
