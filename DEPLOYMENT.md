# 部署到 Vercel 与 Supabase

## 推荐路线

当前项目的数据已经生成在 `src/data/dashboardData.json` 中，因此第一版上线只需要 Vercel，不需要 Supabase。

```text
本地 Excel → analyze-data.mjs → dashboardData.json → React 看板 → Vercel
```

需要让用户在线上传 Excel、长期保存帖子数据或多人协作时，再接入 Supabase：

```text
浏览器上传文件 → Supabase Storage / Database → React 查询 → Vercel 页面
```

## 一、先部署到 Vercel

### 方案 A：GitHub + Vercel（推荐）

1. 在 GitHub 创建一个空仓库，例如 `community-ops-dashboard`。
2. 将本项目推送到 GitHub。
3. 登录 Vercel，选择 **Add New → Project**。
4. 导入刚创建的 GitHub 仓库。
5. Vercel 应自动识别为 Vite；项目也提供了 `vercel.json`：

   - Build Command：`pnpm run build`
   - Output Directory：`dist`

6. 点击 **Deploy**。
7. 部署完成后会得到一个 `https://xxx.vercel.app` 地址。

以后每次推送 GitHub，Vercel 会自动重新构建和发布。

### Windows 中推送 GitHub

先安装 Git for Windows，然后重新打开 PowerShell：

```powershell
cd "D:\社区名侦探demo"
git init
git add .
git commit -m "Initial community dashboard"
git branch -M main
git remote add origin https://github.com/你的用户名/community-ops-dashboard.git
git push -u origin main
```

如果 GitHub 要求登录，按浏览器提示授权即可。

### 方案 B：Vercel CLI

安装 Node.js 后：

```powershell
npm install -g vercel
cd "D:\社区名侦探demo"
vercel
```

首次运行会要求登录和确认项目设置。正式发布：

```powershell
vercel --prod
```

## 二、更新 Excel 数据后重新部署

替换 `data` 目录中的 Excel 文件，然后运行：

```powershell
.\start-dashboard.ps1
```

或者使用 Node/pnpm：

```powershell
pnpm run analyze
```

确认页面数据更新后：

```powershell
git add .
git commit -m "Update dashboard data"
git push
```

Vercel 会自动重新部署。

## 三、什么时候需要 Supabase

以下需求出现时再接 Supabase：

- 在网页中上传 Excel，而不是手工替换本地文件。
- 数据需要保存在云端数据库。
- 多个运营人员共同使用。
- 帖子数据需要定期更新。
- 需要登录、权限控制或历史版本。
- 看板需要直接查询和筛选大量数据。

如果只是展示当前这份分析结果，Supabase 会增加不必要的复杂度。

## 四、Supabase 推荐数据设计

### `posts` 表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text / bigint | 帖子 ID，主键 |
| title | text | 帖子标题 |
| link | text | 帖子链接 |
| author | text | 作者 |
| content | text | 帖子正文 |
| published_at | timestamptz | 发布时间 |
| views | integer | 浏览量 |
| status | text | 数据状态 |
| issue_type | text | 问题类型 |
| sentiment | text | 情感 |
| keywords | text[] | 关键词数组 |
| confidence | numeric | 分类置信度 |
| created_at | timestamptz | 数据写入时间 |

### 可选的 `analysis_runs` 表

用于记录每次分析：

| 字段 | 类型 |
| --- | --- |
| id | uuid |
| source_file | text |
| total_posts | integer |
| valid_posts | integer |
| generated_at | timestamptz |

## 五、React 连接 Supabase

安装：

```powershell
pnpm add @supabase/supabase-js
```

创建 `.env.local`：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

创建 `src/lib/supabase.ts`：

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
```

读取数据：

```ts
const { data, error } = await supabase
  .from("posts")
  .select("*")
  .order("published_at", { ascending: false });
```

不要把 `service_role` 密钥放进 Vite 前端。前端只能使用 Publishable Key，并必须为表配置 Row Level Security。

## 六、在 Vercel 配置 Supabase 环境变量

进入：

```text
Vercel Project → Settings → Environment Variables
```

添加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

添加后重新部署项目。

## 七、建议的实施顺序

1. 先将当前静态看板部署到 Vercel。
2. 确认公开链接、图表和筛选器正常。
3. 再创建 Supabase 项目和 `posts` 表。
4. 将当前 JSON 导入 Supabase。
5. 将前端数据源从本地 JSON 替换为 Supabase 查询。
6. 最后增加 Excel 上传和自动分析功能。

