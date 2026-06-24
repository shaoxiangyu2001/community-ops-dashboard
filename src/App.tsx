import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Eye,
  FileQuestion,
  Filter,
  Gauge,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import rawData from "./data/dashboardData.json";

type RecordItem = (typeof rawData.records)[number];
type FilterState = {
  issueType: string;
  sentiment: string;
  keyword: string;
  status: string;
  query: string;
};

const ALL = "全部";
const COLORS = ["#2dd4bf", "#7c3aed", "#38bdf8", "#f59e0b", "#fb7185", "#a3e635"];
const SENTIMENT_COLORS: Record<string, string> = {
  积极: "#34d399",
  中性: "#60a5fa",
  消极: "#fb7185",
  未分类: "#64748b",
};

const countBy = (records: RecordItem[], getter: (record: RecordItem) => string) => {
  const counts = new Map<string, number>();
  records.forEach((record) => {
    const key = getter(record) || "未分类";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatNumber = (value: number | null) => (value == null ? "—" : value.toLocaleString("zh-CN"));

const SCENE_RULES = [
  {
    name: "元素捕获失败",
    issueTypes: ["元素定位问题", "iframe或页面布局异常", "点击或交互失败问题"],
    pattern: /捕获不到|捕捉不到|找不到元素|定位不到|识别不到|抓取失败|无法捕获/i,
    action: "制作元素捕获失败排查向导：页面加载、iframe、遮罩层、动态属性、浏览器插件。",
  },
  {
    name: "元素偏移与漂移",
    issueTypes: ["元素定位问题", "iframe或页面布局异常", "脚本稳定性问题"],
    pattern: /元素错位|元素偏移|元素漂移|位置不对|页面布局|飘到/i,
    action: "建立元素偏移专题，收集分辨率、缩放比例、浏览器版本和复现页面。",
  },
  {
    name: "相似元素与循环",
    issueTypes: ["元素定位问题", "点击或交互失败问题"],
    pattern: /相似元素|循环元素|循环相似|批量元素|匹配位置/i,
    action: "补充相似元素数组、父子层级和循环定位的可复制示例。",
  },
  {
    name: "脚本失效与卡顿",
    issueTypes: ["脚本稳定性问题"],
    pattern: /失效|卡住|卡死|超时|断开连接|偶尔|不稳定|变卡|变慢/i,
    action: "由 Agent 收集运行日志、失败步骤、环境变化，并给出稳定性检查清单。",
  },
  {
    name: "点击与弹窗交互",
    issueTypes: ["点击或交互失败问题", "元素定位问题", "iframe或页面布局异常"],
    pattern: /点击不到|点不到|点击失败|弹窗|对话框|复选框|滑动不生效/i,
    action: "整理点击方式选择、遮挡检测、滚动可见和弹窗切换 FAQ。",
  },
  {
    name: "Excel 批量处理",
    issueTypes: ["Excel与数据自动化问题"],
    pattern: /excel|单元格|工作簿|行列|复制粘贴|批量读取|多维表格/i,
    action: "提供 Excel 批量读写、图片处理和大数据量性能模板。",
  },
  {
    name: "代码与接口报错",
    issueTypes: ["代码运行错误"],
    pattern: /报错|错误|exception|object reference|接口异常|api报错|extra data|traceback/i,
    action: "建设错误码知识库，按报错文本匹配原因、修复步骤和示例代码。",
  },
  {
    name: "移动端与微信自动化",
    issueTypes: ["代码运行错误", "点击或交互失败问题", "元素定位问题", "iframe或页面布局异常"],
    pattern: /手机|微信|adb|移动端|屏幕尺寸/i,
    action: "补充移动端连接、控件识别、滑动和版本兼容性指南。",
  },
] as const;

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option>{ALL}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note: string;
  accent: string;
}) {
  return (
    <article className="kpi-card" style={{ "--accent": accent } as React.CSSProperties}>
      <div className="kpi-top">
        <span className="kpi-icon">{icon}</span>
        <Activity size={15} className="kpi-spark" />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel chart-panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <BarChart3 size={18} />
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <CircleHelp size={24} />
      <span>{text}</span>
    </div>
  );
}

function PriorityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; negativeRate: number; averageViews: number; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="priority-tooltip">
      <strong>{item.name}</strong>
      <span>消极率：<b>{formatPercent(item.negativeRate)}</b></span>
      <span>平均浏览量：<b>{item.averageViews} 次</b></span>
      <span>帖子数量：<b>{item.count} 条</b></span>
    </div>
  );
}

function App() {
  const [filters, setFilters] = useState<FilterState>({
    issueType: ALL,
    sentiment: ALL,
    keyword: ALL,
    status: ALL,
    query: "",
  });

  useEffect(() => {
    const targetId = window.location.hash.replace("#", "");
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  const records = rawData.records as RecordItem[];
  const issueOptions = useMemo(() => [...new Set(records.map((item) => item.issueType))].sort(), [records]);
  const sentimentOptions = useMemo(() => [...new Set(records.map((item) => item.sentiment))].sort(), [records]);
  const statusOptions = useMemo(() => [...new Set(records.map((item) => item.status))].sort(), [records]);
  const keywordOptions = useMemo(
    () =>
      [...new Set(records.flatMap((item) => item.keywords))]
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .slice(0, 120),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesQuery =
        !query ||
        record.title.toLowerCase().includes(query) ||
        record.author.toLowerCase().includes(query) ||
        record.content.toLowerCase().includes(query) ||
        record.keywords.some((keyword) => keyword.toLowerCase().includes(query));
      return (
        matchesQuery &&
        (filters.issueType === ALL || record.issueType === filters.issueType) &&
        (filters.sentiment === ALL || record.sentiment === filters.sentiment) &&
        (filters.status === ALL || record.status === filters.status) &&
        (filters.keyword === ALL || record.keywords.includes(filters.keyword))
      );
    });
  }, [filters, records]);

  const validRecords = useMemo(
    () => filteredRecords.filter((record) => record.status !== "无有效内容"),
    [filteredRecords],
  );
  const chartRecords = filters.status === "无有效内容" ? filteredRecords : validRecords;
  const issueData = useMemo(() => countBy(chartRecords, (record) => record.issueType), [chartRecords]);
  const sentimentData = useMemo(() => countBy(chartRecords, (record) => record.sentiment), [chartRecords]);
  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    chartRecords.forEach((record) => {
      if (!record.publishedAt) return;
      const date = record.publishedAt.slice(0, 10);
      map.set(date, (map.get(date) || 0) + 1);
    });
    return [...map.entries()]
      .map(([date, count]) => ({ date, label: date.slice(5).replace("-", "/"), count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [chartRecords]);

  const keywordData = useMemo(() => {
    const map = new Map<string, number>();
    chartRecords.forEach((record) =>
      record.keywords.forEach((keyword) => map.set(keyword, (map.get(keyword) || 0) + 1)),
    );
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
      .slice(0, 18);
  }, [chartRecords]);

  const topPosts = useMemo(
    () =>
      chartRecords
        .filter((record) => record.views != null)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 8),
    [chartRecords],
  );
  const lowConfidence = useMemo(
    () =>
      filteredRecords
        .filter((record) => record.confidence != null && record.confidence < 0.7)
        .sort((a, b) => (a.confidence || 0) - (b.confidence || 0))
        .slice(0, 5),
    [filteredRecords],
  );

  const issueDiagnostics = useMemo(() => {
    const grouped = new Map<string, RecordItem[]>();
    chartRecords.forEach((record) => {
      const items = grouped.get(record.issueType) || [];
      items.push(record);
      grouped.set(record.issueType, items);
    });
    const maxViews = Math.max(
      1,
      ...[...grouped.values()].map((items) =>
        items.reduce((sum, item) => sum + (item.views || 0), 0) / Math.max(items.length, 1),
      ),
    );
    return [...grouped.entries()]
      .map(([name, items]) => {
        const negativeCount = items.filter((item) => item.sentiment === "消极").length;
        const averageViews = Math.round(
          items.reduce((sum, item) => sum + (item.views || 0), 0) / Math.max(items.length, 1),
        );
        const highImpactNegative = items.filter(
          (item) => item.sentiment === "消极" && (item.views || 0) >= 100,
        ).length;
        const volumeShare = items.length / Math.max(chartRecords.length, 1);
        const negativeRate = negativeCount / Math.max(items.length, 1);
        const priorityScore = Math.round(
          volumeShare * 40 + negativeRate * 35 + (averageViews / maxViews) * 25,
        );
        return {
          name,
          count: items.length,
          volumeShare,
          negativeCount,
          negativeRate,
          averageViews,
          highImpactNegative,
          priorityScore,
          priority: priorityScore >= 45 ? "P0" : priorityScore >= 32 ? "P1" : "P2",
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [chartRecords]);

  const sceneClusters = useMemo(() => {
    const buckets = SCENE_RULES.map((rule) => ({ ...rule, records: [] as RecordItem[] }));
    chartRecords.forEach((record) => {
      const source = `${record.title} ${record.content} ${record.keywords.join(" ")}`;
      const matched = buckets.find(
        (bucket) => bucket.issueTypes.some((type) => type === record.issueType) && bucket.pattern.test(source),
      );
      if (matched) matched.records.push(record);
    });
    return buckets
      .filter((bucket) => bucket.records.length)
      .map((bucket) => {
        const negativeCount = bucket.records.filter((item) => item.sentiment === "消极").length;
        const averageViews = Math.round(
          bucket.records.reduce((sum, item) => sum + (item.views || 0), 0) / bucket.records.length,
        );
        const example = [...bucket.records].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
        return {
          name: bucket.name,
          count: bucket.records.length,
          share: bucket.records.length / Math.max(chartRecords.length, 1),
          negativeRate: negativeCount / bucket.records.length,
          averageViews,
          action: bucket.action,
          example,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [chartRecords]);

  const faqCandidates = useMemo(
    () =>
      sceneClusters
        .map((scene) => ({
          question: scene.name,
          evidence: `${scene.count} 条相关帖子，消极率 ${formatPercent(scene.negativeRate)}，平均浏览 ${scene.averageViews}`,
          action: scene.action,
          score: scene.count * 2 + scene.negativeRate * 10 + scene.averageViews / 30,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [sceneClusters],
  );

  const highImpactNegativePosts = useMemo(
    () =>
      chartRecords
        .filter((record) => record.sentiment === "消极")
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5),
    [chartRecords],
  );

  const total = filteredRecords.length;
  const valid = validRecords.length;
  const negative = validRecords.filter((record) => record.sentiment === "消极").length;
  const negativeShare = valid ? negative / valid : 0;
  const views = validRecords.filter((record) => record.views != null);
  const averageViews = views.length
    ? Math.round(views.reduce((sum, record) => sum + (record.views || 0), 0) / views.length)
    : null;
  const leadingIssue = issueData[0]?.name || "暂无";
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => (key === "query" ? Boolean(value) : value !== ALL),
  ).length;

  const updateFilter = (key: keyof FilterState, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () =>
    setFilters({ issueType: ALL, sentiment: ALL, keyword: ALL, status: ALL, query: "" });

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>Community Lens</strong>
            <span>社区运营智能分析</span>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="live-dot">数据已更新</span>
          <span>{rawData.metadata.sourceFile}</span>
        </div>
      </header>

      <main>
        <section className="hero" id="overview">
          <div>
            <span className="eyebrow">
              <Gauge size={15} /> AI INSIGHT BOARD
            </span>
            <h1>社区数据运营分析看板</h1>
            <p>
              从帖子内容、问题类型、情感和关注度中，定位最值得优先处理的用户问题。
            </p>
          </div>
          <div className="hero-badge">
            <span>数据周期</span>
            <strong>
              {rawData.distributions.trend[0]?.date.slice(5)} —{" "}
              {rawData.distributions.trend[rawData.distributions.trend.length - 1]?.date.slice(5)}
            </strong>
            <small>共 {rawData.summary.totalPosts} 条原始记录</small>
          </div>
        </section>

        <section className="filter-bar">
          <div className="filter-title">
            <Filter size={18} />
            <div>
              <strong>全局筛选</strong>
              <span>图表、指标和明细同步联动</span>
            </div>
          </div>
          <div className="filter-grid">
            <SelectFilter
              label="问题类型"
              value={filters.issueType}
              options={issueOptions}
              onChange={(value) => updateFilter("issueType", value)}
            />
            <SelectFilter
              label="情感"
              value={filters.sentiment}
              options={sentimentOptions}
              onChange={(value) => updateFilter("sentiment", value)}
            />
            <SelectFilter
              label="关键词"
              value={filters.keyword}
              options={keywordOptions}
              onChange={(value) => updateFilter("keyword", value)}
            />
            <SelectFilter
              label="数据状态"
              value={filters.status}
              options={statusOptions}
              onChange={(value) => updateFilter("status", value)}
            />
            <label className="search-control">
              <Search size={16} />
              <input
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="搜索标题 / 作者 / 内容"
              />
              {filters.query && (
                <button onClick={() => updateFilter("query", "")} aria-label="清空搜索">
                  <X size={15} />
                </button>
              )}
            </label>
          </div>
          <button className="reset-button" onClick={resetFilters} disabled={!activeFilterCount}>
            <RefreshCw size={15} />
            重置{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </section>

        <section className="kpi-grid">
          <KpiCard
            icon={<MessageSquareText size={20} />}
            label="帖子总量"
            value={total}
            note={`当前筛选命中 ${formatPercent(total / rawData.summary.totalPosts)}`}
            accent="#38bdf8"
          />
          <KpiCard
            icon={<CheckCircle2 size={20} />}
            label="有效帖子"
            value={valid}
            note={`${total ? formatPercent(valid / total) : "0.0%"} 可用于分析`}
            accent="#2dd4bf"
          />
          <KpiCard
            icon={<Target size={20} />}
            label="主要问题类型"
            value={leadingIssue}
            note={issueData[0] ? `${issueData[0].count} 条有效讨论` : "暂无有效内容"}
            accent="#8b5cf6"
          />
          <KpiCard
            icon={<AlertTriangle size={20} />}
            label="消极反馈占比"
            value={formatPercent(negativeShare)}
            note={`${negative} 条需要重点关注`}
            accent="#fb7185"
          />
          <KpiCard
            icon={<Eye size={20} />}
            label="平均浏览量"
            value={formatNumber(averageViews)}
            note={averageViews == null ? "源数据无浏览量" : `基于 ${views.length} 条有效帖`}
            accent="#f59e0b"
          />
        </section>

        <section className="charts-grid document-section" id="basic-charts">
          <ChartCard title="问题类型分布" subtitle="单位：有效帖子数 · 横向对比">
            {issueData.length ? (
              <div className="chart-box chart-tall">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={issueData} layout="vertical" margin={{ left: 12, right: 18, top: 8, bottom: 8 }}>
                    <CartesianGrid stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} stroke="#64748b" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={132}
                      tick={{ fill: "#cbd5e1", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(56,189,248,.06)" }}
                      contentStyle={{ background: "#101c2e", border: "1px solid #26364e", borderRadius: 12 }}
                      labelStyle={{ color: "#f1f5f9", fontSize: 13 }}
                      itemStyle={{ color: "#cbd5e1", fontSize: 13 }}
                      formatter={(value) => [`${value} 条`, "帖子数"]}
                    />
                    <Bar dataKey="count" radius={[0, 7, 7, 0]} barSize={17}>
                      {issueData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="当前筛选下暂无问题类型数据" />
            )}
          </ChartCard>

          <ChartCard title="情感分布" subtitle="单位：有效帖子数 · 情绪健康度">
            {sentimentData.length ? (
              <>
                <div className="donut-wrap">
                  <div className="chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={4}
                          stroke="none"
                        >
                          {sentimentData.map((entry) => (
                            <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] || "#64748b"} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#101c2e", border: "1px solid #26364e", borderRadius: 12 }}
                          labelStyle={{ color: "#f1f5f9", fontSize: 13 }}
                          itemStyle={{ color: "#cbd5e1", fontSize: 13 }}
                          formatter={(value) => [`${value} 条`, "帖子数"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <strong>{chartRecords.length}</strong>
                      <span>有效讨论</span>
                    </div>
                  </div>
                  <div className="legend-list">
                    {sentimentData.map((item) => (
                      <div key={item.name}>
                        <span className="legend-dot" style={{ background: SENTIMENT_COLORS[item.name] || "#64748b" }} />
                        <span>{item.name}</span>
                        <strong>{formatPercent(item.count / chartRecords.length)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="当前筛选下暂无情感数据" />
            )}
          </ChartCard>

          {rawData.metadata.availableFields.includes("publishedAt") ? (
            <ChartCard title="发帖趋势" subtitle="单位：帖子数 / 日 · 观察讨论波峰" className="trend-card">
              {trendData.length ? (
                <div className="chart-box chart-trend">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ left: -12, right: 12, top: 16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.38} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="4 4" />
                      <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} stroke="#64748b" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#101c2e", border: "1px solid #26364e", borderRadius: 12 }}
                        labelStyle={{ color: "#f1f5f9", fontSize: 13 }}
                        itemStyle={{ color: "#cbd5e1", fontSize: 13 }}
                        formatter={(value) => [`${value} 条`, "发帖数"]}
                        labelFormatter={(_, payload) => payload[0]?.payload.date || ""}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        fill="url(#trendFill)"
                        activeDot={{ r: 5, fill: "#e0f2fe", stroke: "#38bdf8", strokeWidth: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="当前筛选下暂无可解析的发布时间" />
              )}
            </ChartCard>
          ) : (
            <section className="panel unavailable-panel">
              <CalendarDays size={26} />
              <h2>趋势模块未展示</h2>
              <p>源数据中没有可识别的发布时间字段。</p>
            </section>
          )}
        </section>

        <section className="deep-analysis-section document-section" id="priority-diagnosis">
          <div className="section-title">
            <div>
              <span>DEEP DIAGNOSIS</span>
              <h2>问题优先级深度诊断</h2>
              <p>综合讨论量、消极率和平均浏览量，识别真正需要优先投入运营资源的问题。</p>
            </div>
            <Target size={24} />
          </div>

          <div className="deep-analysis-grid">
            <section className="panel priority-matrix">
              <div className="panel-heading">
                <div>
                  <h2>问题优先级矩阵</h2>
                  <p>横轴：消极率 · 纵轴：平均浏览量 · 气泡：帖子数量</p>
                </div>
                <Gauge size={19} />
              </div>
              {issueDiagnostics.length ? (
                <div className="priority-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ left: 5, right: 22, top: 20, bottom: 10 }}>
                      <CartesianGrid stroke="#25344a" strokeDasharray="4 4" />
                      <XAxis
                        type="number"
                        dataKey="negativeRate"
                        domain={[0, 1]}
                        tickFormatter={(value) => `${Math.round(value * 100)}%`}
                        tick={{ fill: "#d7e2ef", fontSize: 15, fontWeight: 600 }}
                        name="消极率"
                      />
                      <YAxis
                        type="number"
                        dataKey="averageViews"
                        name="平均浏览量"
                        unit="次"
                        tick={{ fill: "#d7e2ef", fontSize: 15, fontWeight: 600 }}
                      />
                      <ZAxis type="number" dataKey="count" range={[180, 900]} name="帖子数量" />
                      <Tooltip
                        cursor={{ strokeDasharray: "4 4" }}
                        content={<PriorityTooltip />}
                      />
                      <Scatter name="问题类型" data={issueDiagnostics} fill="#38bdf8">
                        {issueDiagnostics.map((item, index) => (
                          <Cell
                            key={item.name}
                            fill={item.priority === "P0" ? "#fb7185" : item.priority === "P1" ? "#f59e0b" : COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="当前筛选下暂无可诊断的问题类型" />
              )}
              <div className="matrix-legend">
                <span><i className="dot-p0" /> P0 高优先</span>
                <span><i className="dot-p1" /> P1 重点观察</span>
                <span><i className="dot-p2" /> P2 常规维护</span>
              </div>
            </section>

            <section className="panel diagnosis-table-panel">
              <div className="panel-heading">
                <div>
                  <h2>类型诊断明细</h2>
                  <p>优先级分数 = 讨论量 40% + 消极率 35% + 浏览关注度 25%</p>
                </div>
                <BarChart3 size={19} />
              </div>
              <div className="diagnosis-list">
                {issueDiagnostics.map((item) => (
                  <article key={item.name}>
                    <span className={`priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                    <div className="diagnosis-main">
                      <strong>{item.name}</strong>
                      <div className="score-track">
                        <span style={{ width: `${Math.min(item.priorityScore, 100)}%` }} />
                      </div>
                    </div>
                    <dl>
                      <div><dt>数量</dt><dd>{item.count} 条</dd></div>
                      <div><dt>消极率</dt><dd>{formatPercent(item.negativeRate)}</dd></div>
                      <div><dt>平均浏览</dt><dd>{item.averageViews}</dd></div>
                      <div><dt>高影响负面</dt><dd>{item.highImpactNegative} 条</dd></div>
                    </dl>
                    <b>{item.priorityScore}</b>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="panel scenario-panel document-section" id="scenario-analysis">
          <div className="panel-heading">
            <div>
              <h2>具体故障场景聚类</h2>
              <p>从标题、正文和关键词中匹配具体用户场景；每张卡片都提供数据证据、典型案例和建议动作</p>
            </div>
            <Sparkles size={19} />
          </div>
          {sceneClusters.length ? (
            <div className="scenario-grid">
              {sceneClusters.map((scene, index) => (
                <article key={scene.name}>
                  <div className="scenario-top">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <em>{formatPercent(scene.share)} 的有效讨论</em>
                  </div>
                  <h3>{scene.name}</h3>
                  <div className="scenario-metrics">
                    <span><strong>{scene.count}</strong> 条帖子</span>
                    <span><strong>{formatPercent(scene.negativeRate)}</strong> 消极率</span>
                    <span><strong>{scene.averageViews}</strong> 平均浏览</span>
                  </div>
                  <div className="scenario-example">
                    <small>高关注案例</small>
                    <p>{scene.example.title}</p>
                  </div>
                  <div className="scenario-action">
                    <Bot size={15} />
                    <p>{scene.action}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="当前筛选下未识别出具体故障场景" />
          )}
        </section>

        <section className="action-insight-grid document-section" id="faq-cases">
          <section className="panel faq-panel">
            <div className="panel-heading">
              <div>
                <h2>FAQ / 帮助文档候选</h2>
                <p>按出现频次、消极程度和关注度综合排序</p>
              </div>
              <Lightbulb size={19} />
            </div>
            <div className="faq-list">
              {faqCandidates.map((item, index) => (
                <article key={item.question}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{item.question}</h3>
                    <small>{item.evidence}</small>
                    <p>{item.action}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel negative-case-panel">
            <div className="panel-heading">
              <div>
                <h2>高影响消极案例</h2>
                <p>优先回应高浏览量负面帖子，降低社区扩散风险</p>
              </div>
              <AlertTriangle size={19} />
            </div>
            <div className="negative-case-list">
              {highImpactNegativePosts.map((post, index) => (
                <article key={post.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{post.title}</strong>
                    <small>{post.issueType} · {post.views} 浏览 · 置信度 {formatPercent(post.confidence || 0)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="insight-grid document-section" id="keywords-findings">
          <section className="panel keyword-panel">
            <div className="panel-heading">
              <div>
                <h2>高频关键词</h2>
                <p>标签大小表示出现频次，点击可直接筛选</p>
              </div>
              <Sparkles size={18} />
            </div>
            {keywordData.length ? (
              <div className="keyword-cloud">
                {keywordData.map((keyword, index) => (
                  <button
                    key={keyword.name}
                    className={filters.keyword === keyword.name ? "active" : ""}
                    style={
                      {
                        "--keyword-color": COLORS[index % COLORS.length],
                        "--keyword-scale": Math.max(0.82, 1.2 - index * 0.025),
                      } as React.CSSProperties
                    }
                    onClick={() => updateFilter("keyword", filters.keyword === keyword.name ? ALL : keyword.name)}
                  >
                    {keyword.name}
                    <span>{keyword.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState text="当前筛选下暂无关键词" />
            )}
          </section>

          <section className="panel finding-panel">
            <div className="panel-heading">
              <div>
                <h2>AI 核心发现</h2>
                <p>基于完整数据集生成的运营摘要</p>
              </div>
              <Bot size={19} />
            </div>
            <div className="finding-list">
              {rawData.findings.slice(0, 4).map((finding, index) => (
                <article key={finding}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{finding}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="panel table-panel document-section" id="top-posts">
          <div className="panel-heading">
            <div>
              <h2>高关注帖子 Top 8</h2>
              <p>按浏览量降序，优先识别高影响问题</p>
            </div>
            <div className="table-count">
              <Eye size={16} /> {topPosts.reduce((sum, post) => sum + (post.views || 0), 0).toLocaleString("zh-CN")} 次浏览
            </div>
          </div>
          {topPosts.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>帖子标题</th>
                    <th>问题类型</th>
                    <th>情感</th>
                    <th>浏览量</th>
                    <th>置信度</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map((post, index) => (
                    <tr key={post.id}>
                      <td>
                        <span className="rank">{index + 1}</span>
                      </td>
                      <td>
                        {post.link ? (
                          <a href={post.link} target="_blank" rel="noreferrer">
                            {post.title}
                            <ArrowUpRight size={14} />
                          </a>
                        ) : (
                          post.title
                        )}
                        <small>
                          <UserRound size={12} /> {post.author}
                        </small>
                      </td>
                      <td>
                        <span className="type-badge">{post.issueType}</span>
                      </td>
                      <td>
                        <span className={`sentiment sentiment-${post.sentiment}`}>{post.sentiment}</span>
                      </td>
                      <td>
                        <strong>{formatNumber(post.views)}</strong>
                      </td>
                      <td>{post.confidence == null ? "—" : formatPercent(post.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="当前筛选下没有包含浏览量的帖子" />
          )}
        </section>

        <section className="review-grid document-section" id="review-authors">
          <section className="panel review-panel">
            <div className="panel-heading">
              <div>
                <h2>低置信度复核队列</h2>
                <p>置信度低于 0.70，建议人工确认分类</p>
              </div>
              <FileQuestion size={19} />
            </div>
            {lowConfidence.length ? (
              <div className="review-list">
                {lowConfidence.map((item) => (
                  <article key={item.id}>
                    <span className="confidence-score">{formatPercent(item.confidence || 0)}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.issueType}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState text="当前筛选下没有低置信度记录" />
            )}
          </section>

          <section className="panel author-panel">
            <div className="panel-heading">
              <div>
                <h2>活跃作者</h2>
                <p>重复发帖作者可用于识别持续性需求</p>
              </div>
              <UsersRound size={19} />
            </div>
            <div className="author-list">
              {rawData.distributions.authors.slice(0, 7).map((author, index) => (
                <div key={author.name}>
                  <span>{index + 1}</span>
                  <strong>{author.name}</strong>
                  <em>{author.count} 帖</em>
                  <small>{author.views} 浏览</small>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="recommendation-section document-section" id="recommendations">
          <div className="recommendation-heading">
            <span>
              <Lightbulb size={20} />
            </span>
            <div>
              <p>OPERATION PLAYBOOK</p>
              <h2>运营建议总结</h2>
            </div>
          </div>
          <div className="recommendation-grid">
            {rawData.recommendations.map((recommendation, index) => (
              <article key={recommendation.title}>
                <div>
                  <span className={`priority priority-${recommendation.priority.toLowerCase()}`}>
                    {recommendation.priority}
                  </span>
                  {index === 3 ? <Bot size={18} /> : index === 4 ? <FileQuestion size={18} /> : <TrendingUp size={18} />}
                </div>
                <h3>{recommendation.title}</h3>
                <p>{recommendation.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <footer>
          <span>
            <CheckCircle2 size={14} /> 数据已完成空值、重复、浏览量、时间与关键词清洗
          </span>
          <span>生成时间：{new Date(rawData.metadata.generatedAt).toLocaleString("zh-CN")}</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
