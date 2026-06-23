# FigureHue

**Extract publication-ready color palettes from any image — in your browser.**

FigureHue 是一款面向科研作图的配色提取工具：上传参考图，自动聚类主色调，一键导出 Matplotlib / ggplot2 / LaTeX 等格式，全程在本地浏览器运行，图片不上传服务器。

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](VERSION)
[![Stack](https://img.shields.io/badge/stack-vanilla%20HTML%2FJS-333)](index.html)
[![Build](https://img.shields.io/badge/build-none-success)](#快速开始)

---

## 为什么用 FigureHue？

写论文、做海报时，经常需要让图表配色与参考图、品牌色或领域惯例保持一致。手动吸色、反复试错很费时。FigureHue 把这件事变成：

1. **拖入图片** → 自动提取 3–8 个主色  
2. **微调 & 取色** → 锁定重要颜色、手动替换色槽  
3. **预览 & 检测** → 图表预览、色盲模拟、对比度与可区分性检查  
4. **复制导出** → 直接粘贴进 Python / R / LaTeX 工程  

线上运行无需构建，打开即用；开发检查统一使用仓库内声明的 `FigureHue` conda 环境。

---

## 功能概览

### 输入

| 能力 | 说明 |
|------|------|
| 拖拽 / 点击上传 | 支持常见图片格式 |
| 剪贴板粘贴 | `Ctrl+V` 直接粘贴截图 |
| URL 加载 | 从图片链接读取（受 CORS 限制） |
| 示例图库 | 内置多张示例，快速体验 |

### 配色提取

- **K-Means++** 聚类，可调颜色数量（3–8）
- 可选 **忽略白/黑/灰背景**，减少底色干扰
- **风格预设**：原图 / Nature / Science / 莫兰迪 / 鲜艳海报 / 印刷友好
- **ColorBrewer 映射**：可选吸附到 Set1、Set2、Paired 等标准色板

### 交互编辑

- 图片上 **悬停预览 / 点击取色**，指定替换色槽
- **放大取色** 弹窗，适合细节区域精准选色
- 色槽 **锁定 / 删除并重新提取**
- **饱和度 / 明度** 滑块微调
- **恢复默认**：一键回到自动提取结果

### 无障碍 & 预览

- 色盲模拟（红/绿/蓝盲）
- **灰度打印预览**（图表预览区）
- WCAG 对比度、相邻色可区分性、色盲冲突检测
- 问题项附带 **改进建议**
- 柱状图、折线图、散点图、Heatmap 实时预览

### 导出 & 管理

| 格式 | 用途 |
|------|------|
| HEX / CSS 变量 | 设计与前端 |
| Matplotlib / Seaborn | Python 科研绘图 |
| ggplot2 | R 语言 |
| LaTeX `xcolor` | 论文排版 |
| JSON / Figma | 协作与备份 |
| 方案保存 & 对比 | 浏览器 `localStorage` |

### 色板交换与协作

- 导入 FigureHue JSON、Figma JSON、GIMP GPL 或普通 HEX 列表
- 拖拽调整颜色顺序，锁定状态和图片采样标记会随颜色移动
- 一键复制分享链接；打开链接即可在浏览器中恢复色板
- 新增 GIMP GPL 导出，便于与 GIMP、Inkscape 等工具交换色板

---

## 快速开始

> 纯静态站点，**零依赖安装、零构建步骤**。

```bash
git clone https://github.com/Promistars/FigureHue.git
cd FigureHue
python3 -m http.server 8080
```

浏览器访问：**http://localhost:8080**

### 开发 / 检查环境

FigureHue 的项目级工具统一放在独立 conda 环境中，避免和 IAMS 或其他项目混用：

```bash
conda env create -f environment.yml
conda run -n FigureHue node --check js/main.js
```

如果本机已经创建过环境，可用下面的命令同步依赖：

```bash
conda env update -n FigureHue -f environment.yml --prune
```

### 其他部署方式

- 任意静态 Web 服务器（Nginx、Caddy、Apache）指向项目根目录  
- GitHub Pages / Cloudflare Pages / 对象存储 + CDN  
- 嵌入现有后端框架的静态文件路由  

仓库内可选脚本（`setup_systemd.sh`、`restart.sh`）用于在 Linux 上以 systemd 托管本地 HTTP 服务，可按需使用。

---

## 项目结构

```
FigureHue/
├── index.html          # 应用入口
├── css/styles.css      # 样式
├── js/
│   ├── main.js         # 应用逻辑
│   ├── colorExtract.js # K-Means++ 提取
│   ├── colorUtils.js   # 颜色空间与调整
│   ├── colorblind.js   # 色盲模拟
│   ├── colorbrewer.js  # ColorBrewer 映射
│   ├── charts.js       # Chart.js 预览
│   ├── exportFormats.js
│   ├── presets.js      # 风格预设与示例图
│   └── storage.js      # 本地存储
├── VERSION             # 当前版本
├── environment.yml     # FigureHue 开发检查环境
└── README.md
```

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | HTML5、CSS3、JavaScript (ES Modules) |
| 图表 | [Chart.js](https://www.chartjs.org/)（CDN） |
| 算法 | K-Means++ 颜色聚类 |
| 无障碍 | Brettel 色盲模拟、WCAG 对比度计算 |
| 存储 | 浏览器 `localStorage`（仅本机） |

---

## 隐私说明

- **完全前端运行**：图片在浏览器本地处理，不会上传到任何后端  
- **无账号、无追踪**：不依赖第三方分析服务  
- 保存的配色方案仅存在于你的浏览器本地存储  

---

## 版本

当前版本：**v1.1.0**（见 [`VERSION`](VERSION)）

---

## 许可

本仓库尚未指定开源许可证。若你计划公开分享或接受贡献，请添加合适的 `LICENSE` 文件（例如 MIT、Apache-2.0）。

---

## 贡献

欢迎通过 Issue 反馈问题、提出功能建议，或通过 Pull Request 提交改进。

如果这个项目对你有帮助，欢迎 Star ⭐
