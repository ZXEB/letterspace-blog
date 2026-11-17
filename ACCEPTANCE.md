# 本次交付与验收

验收日期：2026-11-17（Asia/Shanghai）。继续现有项目与独立部署，没有初始化管理员或重置密码。

## 结果

- 生产构建成功；动效版前端资源：`index-GISjX-oa.css`、`index-BASonNIm.js`。
- `scripts/smoke.mjs`：106 项断言通过，进程退出码 0。
- `scripts/admin-smoke.mjs`：15 项断言通过，进程退出码 0，临时文章和草稿已删除。
- 原有 5 篇演示文章、2 篇手记和 About 页面保留。
- 新站 `/health`、Mix Space `/api/v3/ping`、RSS、RSS 兼容地址、动态 XML sitemap 正常。

| 项目 | 实测结果 |
| --- | --- |
| 首页与内页 | 首页、文章、手记、时间线、搜索、友链、项目、关于、关于本站均显示 |
| 文章路由 | 5 篇文章的分类/slug 路径、旧 slug 路径均能读取正文 |
| 列表分页 | 使用真实 API，将每页容量缩小为 1/2 条，验证文章、手记翻页、刷新、分类筛选 |
| 搜索 | 真实后端搜索、提交、无结果状态及下一页均通过 |
| 完整时间线 | 缩小后端页容量后，仍完整显示 5 篇文章和 2 篇手记 |
| 关于同步 | 页面显示后台 slug=about 的实际正文，不使用默认介绍掩盖接口失败 |
| Sitemap | XML 可解析，包含分类文章地址；新发布立即加入，取消发布立即移除 |
| Feed | XML 可解析，所有链接指向独立新站，访问对应实际页面 |
| 管理后台 | 原密码浏览器登录成功；HTTP/IP 会话刷新后仍有效；退出清除 cookie |
| 发布与编辑 | API 新建、修改、读取、取消发布、删除；浏览器默认富文本编辑器实际发布 |
| 富文本 | 实际 Lexical 文档的 Markdown 导出显示段落、加粗和列表，没有显示 JSON |
| 内容隔离 | 同一浏览器已登录后台时，前台仍不显示取消发布的文章 |
| 手机与主题 | 390px 导航与正文无横向溢出；明暗切换、颜色和刷新持久化通过 |
| 浏览器异常 | 前台和后台验收流程均无未捕获 JS 异常 |

## 证据文件（均在本机 D 盘）

- `.cache/ui/acceptance-report.json`
- `.cache/ui/admin-acceptance-report.json`
- `.cache/ui/final-desktop.png`
- `.cache/ui/final-mobile.png`
- `.cache/ui/final-dark.png`
- `.cache/ui/admin-dashboard.png`
- `.cache/ui/admin-published.png`
- `.cache/ui/rich-text-public.png`
- `.cache/ui/rich-text-evidence.json`

旧的 `*-failure.json`、早期截图仅保留排障历史；最终以两份带时间戳的成功报告和零退出码为准。

## 变更与运行边界

补齐分类路由、分页、后端搜索、公开 API cookie 隔离、About 同步、自定义页面、动态 sitemap、正文渲染和基础 SEO；首页改为居中留白、近期文章/手记双栏与月份分布。

固定 Mix Space v13.20.0 镜像不变。新增的 `letterspace-sitemap-1` 是独立 sitemap/API 网关；修复本版本在 HTTP 下发出 Secure cookie 导致浏览器拒收的问题。转换仅作用于新站，保留 HttpOnly、SameSite、签名和 Origin 校验；配置 HTTPS 后自动停用。

部署时只在 `/opt/letterspace` 写入新站文件、备份新站数据库/上传卷，并平滑 reload 新站 Nginx。原站和其他业务容器 ID、镜像、启动时间、重启次数前后比较一致；`.env` SHA-256 与部署前、本机一致。未运行迁移、初始化或覆盖任何密钥。

最近一次应用部署的回滚备份：`/opt/letterspace/backups/20261117T145245Z`。首次修改前备份：`/opt/letterspace/backups/20261117T144347Z`。使用与恢复方法见 README。

## 验收范围

这是可日常写作使用的独立实现，不是 Yohaku 闭源前端的逐像素复制。前端为 SPA，具有基础 SEO，未实现完整 SSR。常见富文本已实测，编辑器特殊交互嵌入、图表等未逐一验收。当前保持用户指定的 HTTP/IP 地址，未变更原站域名、证书或宿主机 80/443 配置。分页验证使用现有小数据集的真实多页响应，不代表大规模性能压测。

## 动效细化（2026-11-17）

在原有前端上补齐分层首屏入场、导航滑动高亮、滚动显现、行项目悬停反馈、页面进入过渡、主题扩散、手机菜单动画、文章骨架、月份时间线绘制和阅读进度。

`scripts/motion-smoke.mjs` 验证真实动画中间帧、最终状态、主题遮罩清理、手机导航、正文加载与无横向溢出；同时验证 `prefers-reduced-motion` 下无持续动画且正文可读。证据为 `.cache/ui/motion-acceptance-report.json` 及 `motion-*.png`。动效时长和错峰控制集中在 `src/motion.css`，无新增运行依赖。

此次采用 `scripts/deploy-frontend.sh` 更新静态文件和前端源码，不重启新站或原站容器，不修改 API、数据库、密钥或后台配置。
