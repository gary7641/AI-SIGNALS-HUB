# AI-SIGNALS-HUB Version Inventory

## 版本記錄表 / Version History Table

本文件記錄 AI-SIGNALS-HUB Trade Analyzer 的所有版本變更。

---

## 版本清單 / Version List

| 版本<br>Version | 發布日期<br>Release Date | Tag | Commit ID | 主要變更<br>Major Changes | 狀態<br>Status |
|:---:|:---:|:---:|:---:|---|:---:|
| **v2.0** | 2026-04-15 | `v2.0` | `10140ca` | **移除 Radar Chart 功能**<br>- 刪除 `renderRadarChart()` 函數<br>- 清理相關變數和引用<br>- 移除 77 行程式碼<br>- 簡化程式碼結構 | ✅ Latest |
| **v1.0** | 2026-04-13 | `AISIGNALSHUB` | `28b50cb` | **初始完整版本**<br>- 完整的交易分析功能<br>- Radar Chart 視覺化<br>- SWOT 分析<br>- Martin 策略分析<br>- 多圖表支援 | 🔖 Stable |

---

## 詳細變更記錄 / Detailed Changelog

### Version 2.0 (2026-04-15)

#### 🗑️ Removed Features
- **Radar Chart Visualization**: 移除了用於顯示帳戶統計數據的雷達圖功能
  - 函數：`renderRadarChart(accountStats)`
  - 變數：`radarChart`
  - 相關程式碼：77 行

#### 📝 Technical Details
- **Commit**: [10140ca](https://github.com/gary7641/AI-SIGNALS-HUB/commit/10140ca) - "Remove renderRadarChart function"
- **Files Modified**: `trade-analyzer.js`
- **Lines Changed**: +0 -77

#### 💡 Rationale
雷達圖功能被移除以簡化程式碼庫，並專注於其他更適合交易分析工作流程的視覺化方法。

---

### Version 1.0 (2026-04-13)

#### ✨ Initial Release
完整的交易歷史分析器，包含以下功能：

##### Core Features
- 📊 **多維度圖表分析**
  - Equity Curve（權益曲線）
  - Weekday Performance（週間表現）
  - Symbol Profit Ranking（交易品種盈利排名）
  - MFE/MAE 散點圖
  - Holding Time Analysis（持倉時間分析）

- 📈 **Symbol 深入分析**
  - 累積盈利曲線
  - 週間/小時統計圖表
  - 支援 All/Separate 模式切換

- 🎯 **SWOT 分析**
  - 自動生成策略優勢/劣勢分析
  - 機會/威脅識別
  - EA 中心化分析

- 🎲 **Martin 策略分析**
  - 多層級倉位統計
  - 累積盈利追蹤
  - 勝率分層顯示
  - 風險/安全層級標示

- 🎨 **UI/UX Features**
  - Dark/Light 主題切換
  - 折疊式區塊設計
  - 響應式圖表
  - Pips/Money 模式切換

##### Technical
- **Main Files**: `index.html`, `trade-analyzer.js`, `analyzer-style.css`, `ea-rules.js`
- **Dependencies**: Chart.js
- **Deployment**: GitHub Pages

---

## 版本命名規則 / Versioning Convention

本項目採用 [Semantic Versioning](https://semver.org/) 規則：

```
v{MAJOR}.{MINOR}.{PATCH}
```

- **MAJOR**: 重大功能變更或不兼容的 API 修改
- **MINOR**: 新增功能，向後兼容
- **PATCH**: Bug 修復，向後兼容

---

## 版本狀態說明 / Status Definitions

| 圖標 | 狀態 | 說明 |
|:---:|---|---|
| ✅ | Latest | 最新發布版本 |
| 🔖 | Stable | 穩定版本 |
| 🚧 | Beta | 測試版本 |
| ⚠️ | Deprecated | 已棄用版本 |
| 🔴 | Archived | 封存版本 |

---

## 升級指南 / Upgrade Guide

### 從 v1.0 升級到 v2.0

#### 不兼容變更
- ❌ `renderRadarChart()` 函數已被移除
- ❌ `radarChart` 變數不再存在

#### 影響範圍
- 如果你的自定義程式碼中有調用 `renderRadarChart()`，需要移除這些調用
- Radar Chart 相關的 DOM 元素（`#radarChart`）將不再被使用

#### 建議
- 使用其他統計卡片和圖表來查看帳戶表現
- 參考 Summary Cards 區塊的數據展示

---

## 未來規劃 / Future Roadmap

### v2.1 (計劃中)
- [ ] 新增匯出功能（PDF/Excel）
- [ ] 優化 mobile 響應式設計
- [ ] 新增比較模式（多個 CSV 對比）

### v3.0 (規劃中)
- [ ] 整合 TradingView 圖表
- [ ] 即時數據串流支援
- [ ] API 接口開發
- [ ] 多語言支援（英文/中文/日文）

---

## 維護者 / Maintainer

**gary7641**  
Repository: [AI-SIGNALS-HUB](https://github.com/gary7641/AI-SIGNALS-HUB)

---

*Last Updated: 2026-04-15*
