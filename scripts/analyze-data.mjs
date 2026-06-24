import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const inputPath = path.resolve(process.argv[2] || "data/情感分析.xlsx");
const outputPath = path.resolve("src/data/dashboardData.json");
const reportPath = path.resolve("analysis-report.md");

const aliases = {
  title: ["帖子标题", "标题", "主题", "问题标题", "post title"],
  link: ["帖子链接", "链接", "详情链接", "url", "post url"],
  id: ["帖子id", "帖子ID", "id", "编号", "post id"],
  author: ["作者", "用户名", "发布人", "用户昵称", "author"],
  authorLink: ["作者个人页链接", "作者链接", "个人主页", "用户主页"],
  content: ["帖子内容（文本）", "帖子内容", "内容", "正文", "问题描述", "文本"],
  publishedAt: ["发布时间", "发布日期", "创建时间", "发帖时间", "时间", "date"],
  views: ["浏览量", "阅读量", "访问量", "查看数", "views"],
  status: ["数据状态", "状态", "有效性", "内容状态"],
  issueType: ["问题类型", "问题分类", "类型", "分类", "主题分类"],
  sentiment: ["情感", "情绪", "情感倾向", "sentiment"],
  keywords: ["关键词", "关键字", "标签", "主题词", "keywords"],
  confidence: ["置信度", "可信度", "分类置信度", "confidence"],
};

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_（）()【】[\]：:·\-]/g, "");

function detectHeaderRow(rows) {
  let best = { index: 0, score: -1 };
  rows.slice(0, 10).forEach((row, index) => {
    const values = row.map(normalizeHeader).filter(Boolean);
    const aliasHits = Object.values(aliases).filter((group) =>
      group.some((alias) => values.includes(normalizeHeader(alias))),
    ).length;
    const score = aliasHits * 10 + values.length;
    if (score > best.score) best = { index, score };
  });
  return best.index;
}

function mapFields(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  for (const [field, names] of Object.entries(aliases)) {
    const targets = names.map(normalizeHeader);
    let index = normalized.findIndex((header) => targets.includes(header));
    if (index < 0) {
      index = normalized.findIndex((header) =>
        targets.some(
          (target) =>
            header.length >= 3 &&
            target.length >= 3 &&
            (header.includes(target) || target.includes(header)),
        ),
      );
    }
    if (index >= 0) mapping[field] = index;
  }
  return mapping;
}

const text = (value) => String(value ?? "").replace(/\u00a0/g, " ").trim();

function parseViews(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value).replace(/,/g, "").toLowerCase();
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(万|千|w|k)?/i);
  if (!match) return null;
  const unit = match[2];
  const multiplier = unit === "万" || unit === "w" ? 10000 : unit === "千" || unit === "k" ? 1000 : 1;
  return Math.round(Number(match[1]) * multiplier);
}

function parseConfidence(value) {
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const raw = text(value).replace("%", "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)).toISOString();
    }
  }
  const raw = text(value).replace(/\//g, "-");
  const timestamp = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function splitKeywords(value) {
  return [...new Set(text(value).split(/[，,、;；|/：:\n\r]+/).map((item) => item.trim()).filter(Boolean))];
}

function normalizeSentiment(value) {
  const raw = text(value);
  if (/积极|正面|正向|positive|满意|开心/i.test(raw)) return "积极";
  if (/消极|负面|负向|negative|不满|愤怒/i.test(raw)) return "消极";
  if (/中性|neutral/i.test(raw)) return "中性";
  return raw || "未分类";
}

function normalizeIssueType(value) {
  const raw = text(value);
  return raw || "未分类";
}

function normalizeStatus(value, content, issueType) {
  const raw = text(value);
  if (/无效|无有效|空内容|invalid/i.test(raw) || issueType === "无有效内容") return "无有效内容";
  if (/正常|有效|valid/i.test(raw)) return "正常";
  return content ? raw || "正常" : "无有效内容";
}

const workbook = XLSX.readFile(inputPath, { cellDates: true, raw: true });
const candidates = workbook.SheetNames.map((sheetName) => {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
  const headerRow = detectHeaderRow(rows);
  const headers = rows[headerRow] || [];
  const mapping = mapFields(headers);
  return { sheetName, rows, headerRow, headers, mapping, fieldCount: Object.keys(mapping).length };
}).sort((a, b) => b.fieldCount - a.fieldCount || b.rows.length - a.rows.length);

const selected = candidates[0];
if (!selected || selected.fieldCount < 2) throw new Error("未找到可识别的数据表头。");

const rawRecords = selected.rows.slice(selected.headerRow + 1).map((row, sourceIndex) => {
  const get = (field) => (selected.mapping[field] == null ? null : row[selected.mapping[field]]);
  const title = text(get("title"));
  const content = text(get("content"));
  const issueType = normalizeIssueType(get("issueType"));
  const status = normalizeStatus(get("status"), content || title, issueType);
  return {
    sourceRow: selected.headerRow + sourceIndex + 2,
    id: text(get("id")) || `row-${sourceIndex + 1}`,
    title: title || content.slice(0, 42) || "未命名帖子",
    link: text(get("link")),
    author: text(get("author")) || "未知作者",
    authorLink: text(get("authorLink")),
    content,
    publishedAt: parseDate(get("publishedAt")),
    views: parseViews(get("views")),
    status,
    issueType,
    sentiment: normalizeSentiment(get("sentiment")),
    keywords: splitKeywords(get("keywords")),
    confidence: parseConfidence(get("confidence")),
    duplicate: false,
  };
}).filter((record) => record.title || record.content || record.id);

const seen = new Set();
for (const record of rawRecords) {
  const key = record.id && !record.id.startsWith("row-")
    ? `id:${record.id}`
    : record.link
      ? `link:${record.link}`
      : `text:${record.title.toLowerCase()}|${record.author.toLowerCase()}`;
  record.duplicate = seen.has(key);
  seen.add(key);
}

const records = rawRecords.filter((record) => !record.duplicate);
const validRecords = records.filter((record) => record.status !== "无有效内容");
const countBy = (items, getter) => {
  const map = new Map();
  items.forEach((item) => {
    const key = getter(item) || "未分类";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, share: items.length ? count / items.length : 0 }))
    .sort((a, b) => b.count - a.count);
};

const issueTypes = countBy(validRecords, (r) => r.issueType);
const sentiments = countBy(validRecords, (r) => r.sentiment);
const statuses = countBy(records, (r) => r.status);
const keywordMap = new Map();
validRecords.forEach((record) =>
  record.keywords.forEach((keyword) => keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1)),
);
const keywords = [...keywordMap.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
  .slice(0, 30);

const viewsAvailable = validRecords.filter((record) => record.views != null);
const averageViews = viewsAvailable.length
  ? Math.round(viewsAvailable.reduce((sum, record) => sum + record.views, 0) / viewsAvailable.length)
  : null;
const topPosts = [...viewsAvailable].sort((a, b) => b.views - a.views).slice(0, 20);

const authorMap = new Map();
validRecords.forEach((record) => {
  const current = authorMap.get(record.author) || { name: record.author, count: 0, views: 0 };
  current.count += 1;
  current.views += record.views || 0;
  authorMap.set(record.author, current);
});
const authors = [...authorMap.values()].sort((a, b) => b.count - a.count || b.views - a.views);

const trendMap = new Map();
validRecords.forEach((record) => {
  if (!record.publishedAt) return;
  const date = record.publishedAt.slice(0, 10);
  trendMap.set(date, (trendMap.get(date) || 0) + 1);
});
const trend = [...trendMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

const lowConfidence = records
  .filter((record) => record.confidence != null && record.confidence < 0.7)
  .sort((a, b) => a.confidence - b.confidence);

const negativeCount = sentiments.find((item) => item.name === "消极")?.count || 0;
const negativeShare = validRecords.length ? negativeCount / validRecords.length : 0;
const leadingType = issueTypes[0] || { name: "暂无", count: 0, share: 0 };
const leadingKeyword = keywords[0] || { name: "暂无", count: 0 };
const topViewedType = countBy(viewsAvailable, (r) => r.issueType)
  .map((item) => ({
    ...item,
    totalViews: viewsAvailable.filter((r) => r.issueType === item.name).reduce((sum, r) => sum + r.views, 0),
  }))
  .sort((a, b) => b.totalViews - a.totalViews)[0];

const recommendations = [
  {
    title: `优先建设「${leadingType.name}」帮助中心`,
    detail: `该类型共 ${leadingType.count} 条，占有效内容 ${(leadingType.share * 100).toFixed(1)}%，适合拆成排查清单、常见原因和示例流程。`,
    priority: "P0",
  },
  {
    title: `围绕「${leadingKeyword.name}」补充 FAQ`,
    detail: `它是当前最高频关键词（${leadingKeyword.count} 次），建议在社区搜索、发帖页和客服入口前置推荐答案。`,
    priority: "P0",
  },
  {
    title: "建立消极反馈快速响应机制",
    detail: `消极反馈占 ${(negativeShare * 100).toFixed(1)}%，可为高浏览量消极帖子设置自动提醒和 24 小时响应 SLA。`,
    priority: "P1",
  },
  {
    title: "用 Agent 承接标准化排障",
    detail: "元素定位、脚本稳定性、运行报错等问题通常有固定诊断路径，可由 Agent 先收集环境、截图和错误信息，再给出分步建议。",
    priority: "P1",
  },
  {
    title: "设置低置信度人工复核队列",
    detail: `当前有 ${lowConfidence.length} 条置信度低于 0.70 的记录，建议优先复核并回流标签，持续提升分类稳定性。`,
    priority: "P2",
  },
];

const dashboardData = {
  metadata: {
    sourceFile: path.basename(inputPath),
    generatedAt: new Date().toISOString(),
    selectedSheet: selected.sheetName,
    headerRow: selected.headerRow + 1,
    originalRows: rawRecords.length,
    duplicateRows: rawRecords.filter((record) => record.duplicate).length,
    fieldMapping: Object.fromEntries(
      Object.entries(selected.mapping).map(([field, index]) => [field, selected.headers[index]]),
    ),
    availableFields: Object.keys(selected.mapping),
  },
  summary: {
    totalPosts: records.length,
    validPosts: validRecords.length,
    invalidPosts: records.length - validRecords.length,
    invalidShare: records.length ? (records.length - validRecords.length) / records.length : 0,
    leadingIssueType: leadingType.name,
    leadingIssueCount: leadingType.count,
    negativeShare,
    averageViews,
    lowConfidenceCount: lowConfidence.length,
    activeAuthors: authors.filter((author) => author.count > 1).length,
  },
  distributions: { issueTypes, sentiments, statuses, keywords, trend, authors: authors.slice(0, 15) },
  topPosts,
  lowConfidence,
  recommendations,
  findings: [
    `${leadingType.name}是讨论最多的问题类型，共 ${leadingType.count} 条，占有效帖子 ${(leadingType.share * 100).toFixed(1)}%。`,
    `社区情感以${sentiments[0]?.name || "未分类"}为主；消极反馈占 ${(negativeShare * 100).toFixed(1)}%。`,
    `最高频关键词是“${leadingKeyword.name}”；关键词集中反映用户的操作与排障诉求。`,
    averageViews == null
      ? "源数据未提供可解析的浏览量，关注度排名模块已自动降级。"
      : `有效帖平均浏览量为 ${averageViews}；${topViewedType?.name || "暂无"}贡献的总浏览量最高。`,
    trend.length
      ? `数据覆盖 ${trend[0].date} 至 ${trend.at(-1).date}，可用于观察每日发帖波动。`
      : "源数据未提供可解析的发布时间，趋势模块已自动隐藏。",
  ],
  records,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2), "utf8");

const report = `# 社区数据分析报告

- 数据源：${dashboardData.metadata.sourceFile} / ${dashboardData.metadata.selectedSheet}
- 总帖子：${dashboardData.summary.totalPosts}
- 有效帖子：${dashboardData.summary.validPosts}
- 无效内容占比：${(dashboardData.summary.invalidShare * 100).toFixed(1)}%
- 主要问题类型：${dashboardData.summary.leadingIssueType}（${dashboardData.summary.leadingIssueCount} 条）
- 消极反馈占比：${(dashboardData.summary.negativeShare * 100).toFixed(1)}%
- 平均浏览量：${dashboardData.summary.averageViews ?? "无可用数据"}
- 低置信度待复核：${dashboardData.summary.lowConfidenceCount} 条

## 核心发现

${dashboardData.findings.map((item) => `- ${item}`).join("\n")}

## 运营建议

${dashboardData.recommendations.map((item) => `- **${item.priority} ${item.title}**：${item.detail}`).join("\n")}
`;
fs.writeFileSync(reportPath, report, "utf8");

console.log(JSON.stringify({
  outputPath,
  reportPath,
  selectedSheet: selected.sheetName,
  fieldMapping: dashboardData.metadata.fieldMapping,
  summary: dashboardData.summary,
}, null, 2));
