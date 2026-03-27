# API.md

## 概览
本文档描述第一阶段后端接口契约，供第二阶段开发者在不破坏现有行为的前提下继续扩展系统。统一响应格式：

```json
{
  "code": 200,
  "message": "ok",
  "data": {}
}
```

认证接口以外，所有管理端接口都要求 `Authorization: Bearer <JWT>`。

## 通用约定

### 基础地址
- 本地开发：`http://127.0.0.1:3000`

### 认证头
- `Authorization: Bearer <token>`

### 状态码
- `200` 成功读取或更新
- `201` 成功创建
- `400` 参数错误、问卷结构错误、非法跳题、校验失败
- `401` 未登录或令牌无效
- `404` 资源不存在
- `500` 服务端异常

### 枚举
- `Survey.status`: `draft | published | closed`
- `Response.status`: `in_progress | submitted`
- `Question.type`: `single_choice | multi_choice | text | number`
- `LogicRule.condition`: `eq | gt | lt | includes`

## 数据结构

### User
```json
{
  "id": "string",
  "username": "string",
  "createdAt": "2026-03-27T09:00:00.000Z"
}
```

### Question
```json
{
  "questionId": "q1",
  "type": "single_choice",
  "title": "你是否在职",
  "isRequired": true,
  "order": 1,
  "options": [
    { "optionId": "optA", "text": "是" },
    { "optionId": "optB", "text": "否" }
  ],
  "validation": {},
  "logicRules": [
    { "condition": "eq", "targetValue": "optA", "nextQuestionId": "q2" }
  ],
  "defaultNextQuestionId": "END"
}
```

### Answer
```json
{
  "questionId": "q1",
  "type": "single_choice",
  "value": "optA"
}
```

## 1. 鉴权接口

### POST `/api/auth/register`
请求体：

```json
{
  "username": "alice",
  "password": "password123"
}
```

成功响应：

```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "id": "67e4...",
    "username": "alice",
    "createdAt": "2026-03-27T09:00:00.000Z"
  }
}
```

### POST `/api/auth/login`
请求体：

```json
{
  "username": "alice",
  "password": "password123"
}
```

成功响应：

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "67e4...",
      "username": "alice"
    }
  }
}
```

## 2. 问卷管理接口

### POST `/api/surveys`
创建草稿问卷。

请求体：

```json
{
  "title": "职业调查",
  "description": "第一阶段测试问卷",
  "allowAnonymous": true,
  "deadlineAt": null,
  "questions": [
    {
      "questionId": "q1",
      "type": "single_choice",
      "title": "你是否在职",
      "isRequired": true,
      "order": 1,
      "options": [
        { "optionId": "optA", "text": "是" },
        { "optionId": "optB", "text": "否" }
      ],
      "validation": {},
      "logicRules": [
        { "condition": "eq", "targetValue": "optA", "nextQuestionId": "q2" },
        { "condition": "eq", "targetValue": "optB", "nextQuestionId": "q3" }
      ],
      "defaultNextQuestionId": "END"
    }
  ]
}
```

关键约束：
- `questionId` 全局唯一
- `order` 不能重复
- 跳转目标必须存在或为 `END`
- 不允许自循环与图循环
- 不允许不可达题目

### GET `/api/surveys`
获取当前登录用户的问卷列表。

### GET `/api/surveys/:id`
获取当前登录用户拥有的单份问卷详情。

### PUT `/api/surveys/:id`
全量更新草稿问卷。请求体与创建接口相同。

### POST `/api/surveys/:id/publish`
发布问卷。发布前服务端会再次检查问卷定义完整性。

成功响应：

```json
{
  "code": 200,
  "message": "问卷发布成功",
  "data": {
    "survey": {
      "_id": "67e4...",
      "status": "published"
    },
    "shareLink": "/api/surveys/67e4.../render"
  }
}
```

## 3. 填写端接口

### GET `/api/surveys/:id/render`
返回前端渲染所需的公开问卷定义，不暴露 `ownerId` 等管理字段。

成功响应：

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
    "questions": [
      {
        "questionId": "q1",
        "type": "single_choice",
        "title": "你是否在职",
        "isRequired": true,
        "order": 1,
        "options": [
          { "optionId": "optA", "text": "是" },
          { "optionId": "optB", "text": "否" }
        ],
        "validation": {},
        "logicRules": [
          { "condition": "eq", "targetValue": "optA", "nextQuestionId": "q2" },
          { "condition": "eq", "targetValue": "optB", "nextQuestionId": "q3" }
        ],
        "defaultNextQuestionId": "END"
      }
    ]
  }
}
```

### POST `/api/surveys/:id/submit`
提交答卷。若问卷 `allowAnonymous=false`，必须携带 JWT。

请求体：

```json
{
  "answers": [
    { "questionId": "q1", "type": "single_choice", "value": "optA" },
    { "questionId": "q2", "type": "number", "value": 5 }
  ]
}
```

后端会做：
- DTO 形状校验
- 问卷状态和截止时间校验
- 登录要求校验
- 值合法性校验
- 动态跳转路径重演
- 必答、幽灵答案、死循环、重复答案校验

成功响应：

```json
{
  "code": 201,
  "message": "提交成功",
  "data": {
    "responseId": "67e4...",
    "respondentId": "anon-uuid-or-userid"
  }
}
```

失败示例：

```json
{
  "code": 400,
  "message": "存在非法跳题或幽灵答案: q2",
  "data": null
}
```

## 4. 统计接口

### GET `/api/statistics/surveys/:id`
获取创建者视角的问卷统计。

成功响应：

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
          { "questionId": "q1", "optionId": "optA", "count": 12 },
          { "questionId": "q1", "optionId": "optB", "count": 8 }
        ],
        "average": null,
        "responseCount": 20,
        "textValues": []
      }
    ]
  }
}
```

统计口径：
- `optionCounts`: 选项被选择的次数
- `average`: 数字题平均值
- `responseCount`: 实际作答该题的答卷数
- `textValues`: 文本题原始答案列表

## 第二阶段扩展要求
- 不要修改既有 `questionId`、`optionId` 语义。
- 新增题型时必须同步扩展：
  - DTO 校验
  - 路径重演引擎
  - 统计聚合逻辑
- 若引入草稿答卷，建议新增独立接口，不要改写最终提交接口的行为。
- 建议第二阶段将本文件升级为 OpenAPI 3.1 文档，生成前后端共享类型。
