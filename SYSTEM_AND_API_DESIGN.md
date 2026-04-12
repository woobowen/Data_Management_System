# SYSTEM_AND_API_DESIGN.md

## 系统说明

本项目实现的是一个前后端分离的动态问卷系统。后端采用 `Node.js + Express + TypeScript + MongoDB`，负责用户认证、问卷管理、结构校验、答卷提交与统计聚合；前端采用 `React + Vite + TypeScript`，负责管理后台与填写端页面交互。

系统整体分为两条职责明确的链路。第一条是管理链路，管理员登录后创建问卷、配置题目、设置跳转规则并发布问卷。第二条是填写链路，填写者通过公开链接进入问卷页面，按题目规则进行作答，最终由后端完成提交校验与结果落库。

本系统的核心原则是前后端职责分离。前端可以为了交互体验进行本地题目切换与路径预演，但不拥有最终裁决权。所有真实提交都以后端校验结果为准，尤其是动态跳转、必答校验、非法答案拦截与统计口径，必须由服务端统一控制。

## 数据库设计

本项目数据库采用 MongoDB，主要包含 `Users`、`QuestionTemplates`、`Surveys`、`Responses` 四个集合。

`Users` 集合用于保存账号信息，对应字段包括用户名称、密码哈希与创建时间。其结构较简单，主要服务于登录认证与问卷归属管理。

```ts
{
  _id: ObjectId,
  username: string,
  passwordHash: string,
  createdAt: Date
}
```

`Surveys` 集合用于保存一份问卷的完整定义。问卷标题、描述、发布状态、匿名策略、截止时间以及题目数组都内嵌在同一条文档中。题目数组内部继续包含选项、校验规则和跳转规则，因此一份问卷可以作为一个完整聚合根被一次性读取和更新。

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
      description?: string,
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
      defaultNextQuestionId: string,
      questionTemplateId?: string,
      questionTemplateVersion?: number
    }
  ]
}
```

`QuestionTemplates` 集合用于保存可复用题目。每条记录代表一个可选入题库的题目版本，便于后续跨问卷复用、共享和版本管理。

```ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  rootTemplateId: string,
  version: number,
  previousTemplateId: ObjectId | null,
  title: string,
  description: string,
  type: 'single_choice' | 'multi_choice' | 'text' | 'number',
  isRequired: boolean,
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
  sharedWithUserIds: ObjectId[]
}
```

`Responses` 集合用于保存已经提交的答卷。每一条答卷都关联问卷 ID，并记录答卷人身份、提交状态、提交时间和答案数组。答案数组中的每项都使用稳定的 `questionId` 标识所属题目，避免依赖数组下标表达业务身份。

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

采用 MongoDB 文档结构而不是多表拆分，主要基于三点考虑。第一，问卷天然属于整体读取对象，渲染与提交时都需要拿到完整定义。第二，不同题型的 `validation` 字段和跳转规则中的 `targetValue` 具有明显异构性，文档模型更适合承载。第三，答卷统计阶段需要对答案数组进行展开与聚合，MongoDB 的 `$unwind`、`$group`、`$avg`、`$push` 等操作可以直接服务这一场景。

## API说明

系统接口统一采用如下响应格式：

```json
{
  "code": 200,
  "message": "ok",
  "data": {}
}
```

核心接口如下。

`POST /api/auth/register`

用于注册用户。请求体包含 `username` 与 `password`，成功后返回用户基本信息。

`POST /api/auth/login`

用于登录。请求体包含 `username` 与 `password`，成功后返回 JWT 令牌与用户信息。除公开填写接口外，管理端接口均要求携带 `Authorization: Bearer <token>`。

`POST /api/surveys`

用于创建问卷草稿。请求体中包含问卷标题、说明、匿名配置、截止时间以及完整题目数组。服务端会先对问卷结构进行合法性校验，再保存草稿。

`POST /api/questions`

用于将单个题目保存到题库。请求体包含题目标题、题型、校验规则与选项（若为选择题），并支持 `versionRemark`（版本备注）。

`GET /api/questions`

用于获取当前用户可见的题库题目列表（本人创建 + 已共享给本人），且**每个题目版本链只返回当前最新版本**用于预览与复用。

`GET /api/questions/:id`

用于获取单个题库题目详情，便于在题库页面进行预览与编辑回显。

`PUT /api/questions/:id`

用于基于当前题目创建新版本（保留旧版本不变），仅题目拥有者可操作；请求体支持 `versionRemark` 记录本次更新说明。该设计用于保证已使用旧版本的问卷内容不被后续改题破坏。

`GET /api/questions/:id/versions`

用于查看某个题目的版本历史链路（含各版本备注与时间），仅题目拥有者可查看。

`POST /api/questions/:id/restore`

用于将**当前最新版本回退到指定历史版本内容**并生成新的最新版本（不覆盖原版本），仅题目拥有者可操作；请求体支持 `versionRemark` 记录回退说明。若指定版本本身已是最新版本则会拒绝执行。

`DELETE /api/questions/:id`

用于删除题库题目，仅题目拥有者可删除；删除时会移除该题目的整条版本链。

`GET /api/questions/:id/shares`

用于读取某个题库题目的共享用户名列表，仅题目拥有者可查看。

`PUT /api/questions/:id/shares`

用于更新某个题库题目的共享用户名列表（可批量覆盖），仅题目拥有者可操作。

`GET /api/questions/:id/usages`

用于查看该题目版本链被哪些问卷题目引用（返回问卷与题目级引用明细），仅题目拥有者可查看。接口同时兼容历史数据：对缺少 `questionTemplateId` 的旧问卷题目，会按“题目标题 + 题型”进行推断匹配并标注来源模式。

`GET /api/surveys`

用于获取当前登录用户拥有的问卷列表。

`GET /api/surveys/:id`

用于获取当前登录用户拥有的单份问卷详情，供编辑器回显。

`PUT /api/surveys/:id`

用于全量更新草稿问卷。该接口仅允许草稿态问卷修改结构，发布态问卷禁止结构性修改。

`POST /api/surveys/:id/publish`

用于发布问卷。发布前服务端会重新检查题目 ID、跳转目标、可达性与是否存在循环，只有通过全部校验后才允许进入发布态。

`POST /api/surveys/:id/close`

用于关闭已发布问卷。关闭后问卷不可继续填写。

`GET /api/surveys/:id/render`

用于填写端获取公开问卷定义。接口只返回渲染所需的公开字段，不暴露 `ownerId` 等管理信息，同时会检查问卷是否处于已发布状态、是否超过截止时间。

`POST /api/surveys/:id/submit`

用于提交答卷。请求体为答案数组。服务端在此接口中执行 DTO 形状校验、题型校验、必答校验、匿名权限校验、动态跳转路径重演以及幽灵答案拦截，最后将合法答卷写入数据库。

`GET /api/statistics/surveys/:id`

用于读取统计结果。该接口仅允许问卷拥有者访问，返回每道题的选项次数、数值平均值、文本收集结果和作答次数。

## 关键逻辑说明

本项目最核心的业务逻辑是“全量路径重演验证”。其目标不是相信前端传来的答案顺序，而是由后端从入口题重新计算一遍真实作答路径，再判断提交内容是否可信。

具体过程如下。首先，服务端读取目标问卷并按 `order` 对题目排序，确定入口题。随后建立 `questionId -> question` 的映射，并将客户端提交的答案整理成 `questionId -> answer` 的映射，若出现重复题目答案则直接报错。

接着，后端从第一题开始顺序执行路径重演。每进入一道题，先检查题目是否存在、是否已经访问过，以此防止跳转目标丢失和死循环。然后根据题目类型执行值合法性检查，包括单选是否合法、多选个数是否越界、文本长度是否合理、数字范围与整数约束是否满足。若题目为必答题但答案缺失，也会立即拒绝提交。

在完成当前题校验后，服务端不会盲信客户端的下一题，而是根据该题的 `logicRules` 与 `defaultNextQuestionId` 重新解析下一跳。只有命中规则或默认路径所得到的下一个题目，才被视为真实可达节点。系统会持续执行这一过程，直到路径到达 `END` 为止。

最后，后端会反向检查客户端提交的全部答案。如果某个答案对应的 `questionId` 并不在此次重演得到的访问集合中，则说明客户端额外提交了理论上不应出现的题目答案，这类数据会被判定为幽灵答案或非法跳题，并直接拒绝。

这一机制的意义在于，即使前端页面存在状态残留、用户恶意构造请求，或者某些题目的旧答案没有被及时清理，后端仍然可以依靠问卷定义本身恢复真实路径，只接收合法可达路径上的答案，从而保证答卷数据、统计结果和问卷逻辑的一致性。
