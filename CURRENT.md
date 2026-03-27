# CURRENT.md

## Operation Genesis 当前实施板
1. 创建工程目录与三份核心文档。
2. 初始化 `package.json`、`tsconfig.json`、Jest 配置与脚本。
3. 安装运行依赖：Express、Mongoose、Zod、JWT、bcrypt、dotenv、uuid。
4. 安装开发依赖：TypeScript、ts-node、Jest、ts-jest、supertest、mongodb-memory-server、类型定义。
5. 建立目录结构：
   - `src/controllers`
   - `src/services`
   - `src/models`
   - `src/routes`
   - `src/middlewares`
   - `src/lib`
   - `src/types`
   - `tests`
6. 实现配置层：环境变量读取、MongoDB 连接、应用入口、错误处理中间件。
7. 实现 Auth 模块：注册、登录、JWT 鉴权。
8. 实现 Survey 管理模块：草稿创建、查询、更新、发布。
9. 实现 Survey Engine：
   - `/render` 返回问卷定义
   - `/submit` 使用 Zod 做 DTO 校验
   - 自研路径重演引擎，校验动态跳转、值合法性、必答与幽灵答案
10. 实现 Statistics 模块：使用 `$match`、`$unwind`、`$group` 聚合统计。
11. 编写集成测试覆盖主路径与异常路径。
12. 执行 `npm test`，根据报错自驱修复直到全部通过。
