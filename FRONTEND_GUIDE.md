# FRONTEND_GUIDE.md

## 面向 Google Stitch 的前后端协作建议

### 1. 前端只消费 `GET /render` 返回的公开问卷定义
- 不要在前端硬编码题型结构。
- 以前端问卷渲染器为核心，根据 `questions`、`validation`、`logicRules` 动态生成页面。
- 后端仍是最终裁决者，前端的跳转与校验只负责体验提升。

### 2. 前端建议拆成四层
- `api-client`
  负责调用后端接口，统一处理 token、错误码、基础请求封装。
- `survey-renderer`
  根据题型渲染单选、多选、文本、数字题组件。
- `survey-engine`
  在浏览器里做本地路径推演和即时校验，逻辑语义必须与后端一致。
- `state-store`
  管理当前答案、当前题目、已访问路径、提交状态。

### 3. Stitch 提示词建议
- 明确要求“不要把跳转逻辑写死在组件里，必须从后端返回的 `logicRules` 和 `defaultNextQuestionId` 动态解释”。
- 明确要求“单题组件只负责展示和采集，路径决策统一由 survey-engine 完成”。
- 明确要求“错误提示分为字段级和提交级，字段级来自本地校验，提交级来自后端返回 message”。

### 4. 前端状态模型建议
```ts
type AnswerMap = Record<string, {
  questionId: string;
  type: 'single_choice' | 'multi_choice' | 'text' | 'number';
  value: unknown;
}>;
```

建议至少维护：
- `survey`
- `answerMap`
- `currentQuestionId`
- `visitedQuestionIds`
- `isSubmitting`
- `submitError`

### 5. 与后端对齐的关键点
- 题目顺序以 `order` 为准，不要依赖数组顺序。
- 选项提交值使用 `optionId`，不要提交选项文本。
- 匿名问卷也要按后端约束提交，不能假设一定无需 token。
- 前端推演路径仅用于体验，提交时必须把已回答题目按 `{ questionId, type, value }[]` 发给后端。

### 6. 第二阶段前端扩展建议
- 如果新增题型，优先扩展题型注册表，不要到处写 `switch`。
- 如果新增分页、保存草稿、回退上一步，保持 `survey-engine` 为唯一跳转来源。
- 如果要做统计页，可直接消费 `/api/statistics/surveys/:id`，不要在前端自己重算统计。
