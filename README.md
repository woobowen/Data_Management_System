# README.md

## 环境要求

- Node.js：建议使用 Node.js 22 LTS
- MongoDB：需要一个可连接的 MongoDB 实例，本地默认地址为 `mongodb://127.0.0.1:27017/survey_system_v1`

## .env 配置说明

后端使用项目根目录下的 `.env` 文件，可直接由 `.env.example` 复制得到。至少需要以下配置项：

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/survey_system_v1
JWT_SECRET=survey-system-secret
JWT_EXPIRES_IN=7d
```

初始化方式如下：

```bash
cp .env.example .env
```

## 启动指令

后端在项目根目录执行：

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run build
npm test
```

前端在 `frontend/` 目录执行：

```bash
npm install
npm run dev
```
