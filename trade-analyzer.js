// trade-analyzer.js
// v0.0310309001
let globalTrades = [];
let globalInitialDeposit = 5000;

let equityChart, weekdayChart, symbolProfitChart;
let mfeChart, maeChart, holdingChart;
let symbolCumulativeChart, symbolWeekdayProfitChart, symbolWeekdayCountChart, symbolHourlyProfitChart, symbolHourlyCountChart;
let radarChart;

let mfeMaeMode = "pips";
let cumulativeMode = "all";

// ---------- Theme Sync (Use body.dataset.theme from index.html) ----------
(function setupThemeSync() {
  const body = document.body;
  // Use a MutationObserver to watch for theme changes on body
  const observer = new MutationObserver(() => {
    const theme = body.dataset.theme || "light";
    updateChartThemes(theme);
  });
  observer.observe(body, { attributes: true, attributeFilter: ["data-theme"] });
  
  // Initial run
  updateChartThemes(body.dataset.theme || "light");
})();

function updateChartThemes(theme) {
  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const textColor = isDark ? "#e8eaf6" : "#1a1f3a";

  Chart.defaults.color = textColor;
  // Chart.defaults global grid removed (v4 compat)

  // Update existing charts if they exist
  [equityChart, weekdayChart, symbolProfitChart, mfeChart, maeChart, holdingChart,
   symbolCumulativeChart, symbolWeekdayProfitChart, symbolWeekdayCountChart,
   symbolHourlyProfitChart, symbolHourlyCountChart, radarChart].forEach(chart => {
    if (chart) {
      if (chart.options.scales && chart.options.scales.r) {
         chart.options.scales.r.grid.color = gridColor;
         chart.options.scales.r.angleLines.color = gridColor;
      }
      chart.update();
    }
  });
}

// ---------- Cumulative Switch (All / Separate) ----------
(function setupCumSwitch() {
  const cumInput = document.getElementById("cumSwitch");
  if (!cumInput) return;
  cumulativeMode = "all";
  cumInput.checked = false;
  cumInput.addEventListener("change", () => {
    cumulativeMode = cumInput.checked ? "separate" : "all";
    const activeSymbolBtn = document.querySelector(".symbol-btn.active");
    const sym = activeSymbolBtn ? activeSymbolBtn.dataset.symbol : "ALL";
    const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym] || [];
    renderSymbolExtraCharts(sym, trades);
  });
})();

// Analyze button
const analyzeBtn = document.getElementById("analyzeBtn");
if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze); const csvFile = document.getElementById("csvFile"); if (csvFile) csvFile.addEventListener("change", handleAnalyze);

// Reset button
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) resetBtn.addEventListener("click", resetView);

// Pips / Money switch
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-mode");
  if (!btn) return;
  const mode = btn.dataset.mode;
  if (!mode || mode === mfeMaeMode) return;
  mfeMaeMode = mode;
  document.querySelectorAll(".toggle-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode) );
  const activeSymbolBtn = document.querySelector(".symbol-btn.active");
  const sym = activeSymbolBtn ? activeSymbolBtn.dataset.symbol : "ALL";
  const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym] || [];
  renderMfeMaeHoldingCharts(trades);
});

function handleAnalyze() {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput ? fileInput.files[0] : null;
  if (!file) {
    alert("請先選擇 CSV 檔案");
    return;
  }
  const eaSelect = document.getElementById("eaSelect");
  globalEAKey = eaSelect ? eaSelect.value : "SMA";
  
  const reader = new FileReader();
  reader.onload = (e) => {
    parseCsv(e.target.result);
    buildAll();
  };
  reader.readAsText(file);
}

// ---------- CSV 解析 ----------
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) {
    globalTrades = [];
    globalBySymbol = {};
    return;
  }
  const headers = lines[0].split(",");
  const idx = (name) => headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());
  const iOpenTime = idx("open time") !== -1 ? idx("open time") : idx("Open Time");
  const iCloseTime = idx("close time") !== -1 ? idx("close time") : idx("Close Time");
  const iType = idx("type");
  const iLots = idx("lots") !== -1 ? idx("lots") : idx("volume");
  const iSymbol = idx("symbol");
  const iNetProfit = idx("net profit") !== -1 ? idx("net profit") : idx("profit");
  const iNetPips = idx("net pips") !== -1 ? idx("net pips") : idx("pips");
  const iMFE = idx("mfe") !== -1 ? idx("mfe") : idx("max profit pips");
  const iMAE = idx("mae") !== -1 ? idx("mae") : idx("max loss pips");
  const iHold = idx("holding time") !== -1 ? idx("holding time") : -1;
  const trades = [];
  for (let i = 1; i < lines.length; i++) {
    const rowRaw = lines[i];
    if (!rowRaw.trim()) continue;
    const cells = rowRaw.split(",");
    if (iType < 0 || iSymbol < 0) continue;
    const type = (cells[iType] || "").trim().toLowerCase();
    if (type !== "buy" && type !== "sell") continue;
    const t = {
      openTime: iOpenTime >= 0 ? cells[iOpenTime] || "" : "",
      closeTime: iCloseTime >= 0 ? cells[iCloseTime] || "" : "",
      type,
      symbol: (cells[iSymbol] || "").trim(),
      lots: iLots >= 0 ? parseFloat(cells[iLots] || "0") || 0 : 0,
      netProfit: iNetProfit >= 0 ? parseFloat(cells[iNetProfit] || "0") || 0 : 0,
      netPips: iNetPips >= 0 ? parseFloat(cells[iNetPips] || "0") || 0 : 0,
      mfe: iMFE >= 0 ? parseFloat(cells[iMFE] || "0") || 0 : 0,
      mae: iMAE >= 0 ? parseFloat(cells[iMAE] || "0") || 0 : 0,
      holdingRaw: iHold === -1 ? "" : cells[iHold] || "",
    };
    t.holdingDays = parseHoldingToDays(t.holdingRaw);
    trades.push(t);
  }
  globalTrades = trades;
  globalTrades.sort((a, b) => {
    const da = new Date(a.closeTime || a.openTime);
    const db = new Date(b.closeTime || b.openTime);
    return da - db;
  });
  globalBySymbol = groupBySymbol(globalTrades);
}

function parseHoldingToDays(text) {
  if (!text) return 0;
  const t = text.toLowerCase().trim();
  if (t.endsWith("days") || t.endsWith("day")) {
    const v = parseFloat(t);
    return isNaN(v) ? 0 : v;
  }
  if (t.endsWith("hrs") || t.endsWith("hours") || t.endsWith("hr")) {
    const v = parseFloat(t);
    return isNaN(v) ? 0 : v / 24.0;
  }
  return 0;
}

function groupBySymbol(trades) {
  const map = {};
  for (const t of trades) {
    if (!t.symbol) continue;
    if (!map[t.symbol]) map[t.symbol] = [];
    map[t.symbol].push(t);
  }
  return map;
}

// ---------- 基本統計 ----------
function buildStats(trades) {
  const totalTrades = trades.length;
  if (!totalTrades) return null;
  let grossProfit = 0, grossLoss = 0, profitTrades = 0, lossTrades = 0;
  let maxConsecLoss = 0, curConsecLoss = 0, cum = 0, peak = 0, maxDD = 0;
  for (const t of trades) {
    const p = t.netProfit;
    if (p > 0) {
      profitTrades++;
      grossProfit += p;
      curConsecLoss = 0;
    } else if (p < 0) {
      lossTrades++;
      grossLoss += -p;
      curConsecLoss++;
      if (curConsecLoss > maxConsecLoss) maxConsecLoss = curConsecLoss;
    }
    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  const winRate = profitTrades / totalTrades || 0;
  const lossRate = lossTrades / totalTrades || 0;
  const avgWin = profitTrades ? grossProfit / profitTrades : 0;
  const avgLoss = lossTrades ? grossLoss / lossTrades : 0;
  const expectancy = avgWin * winRate - avgLoss * lossRate;
  const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  return {
    totalTrades,
    grossProfit,
    grossLoss,
    profitTrades,
    lossTrades,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor: pf,
    maxDrawdown: maxDD,
    maxConsecLoss,
  };
}

function buildAccountSummary() {
  const stats = buildStats(globalTrades);
  const bySymbolProfit = {};
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const weekdayProfit = [0, 0, 0, 0, 0, 0, 0];
  let cum = 0;
  const curve = [];
  let firstTime = null, lastTime = null;
  for (const t of globalTrades) {
    cum += t.netProfit;
    const ts = new Date(t.closeTime || t.openTime);
    const label = isNaN(ts.getTime()) ? "" : ts.toISOString().slice(0, 10);
    const wd = ts.getDay();
    weekdayCounts[wd]++;
    weekdayProfit[wd] += t.netProfit;
    bySymbolProfit[t.symbol] = (bySymbolProfit[t.symbol] || 0) + t.netProfit;
    curve.push({ x: label, y: cum });
    if (!firstTime || ts < firstTime) firstTime = ts;
    if (!lastTime || ts > lastTime) lastTime = ts;
  }
  const symbolRanking = Object.entries(bySymbolProfit).sort((a, b) => b[1] - a[1]);
  return { stats, weekdayCounts, weekdayProfit, symbolRanking, curve, firstTime, lastTime };
}

// ---------- Collapsible ----------
document.addEventListener("click", (e) => {
  const header = e.target.closest(".collapsible-header");
  if (!header) return;
  const targetId = header.dataset.target;
  if (!targetId) return;
  const body = document.getElementById(targetId);
  if (!body) return;
  const btn = header.querySelector(".collapse-toggle");
  const isCollapsed = body.classList.toggle("collapsed");
  if (isCollapsed) {
    body.style.maxHeight = "0px";
    if (btn) btn.textContent = "＋";
  } else {
    body.style.maxHeight = body.scrollHeight + "px";
    if (btn) btn.textContent = "－";
  }
});

function expandBody(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.remove("collapsed");
  body.style.maxHeight = body.scrollHeight + "px";
}

// ---------- 總流程 / RESET ----------
function buildAll() {
  if (!globalTrades.length) {
    alert("CSV 內沒有有效交易紀錄");
    return;
  }
  const acc = buildAccountSummary();
  renderSummaryCards(acc);
  renderRadarChart(acc);
  renderSummaryEquityChart(acc);
  document.getElementById("summaryCardsSection").style.display = "block";
  expandBody("summaryCardsBody");
  renderSymbolButtons();
  document.getElementById("symbolSection").style.display = "block";
  renderSymbolMiniCharts();
  expandBody("symbolBody");
  renderSymbol("ALL");
  const menuBar = document.getElementById("analyzerMenuBar");
  if (menuBar) menuBar.style.display = "flex";
}

function resetView() {
  globalTrades = [];
  globalBySymbol = {};
  globalEAKey = "SMA";
  mfeMaeMode = "pips";
  cumulativeMode = "all";
  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();
  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();
  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();
  equityChart = weekdayChart = symbolProfitChart = null;
  mfeChart = maeChart = holdingChart = null;
  symbolCumulativeChart = symbolWeekdayProfitChart = symbolWeekdayCountChart = symbolHourlyProfitChart = symbolHourlyCountChart = null;
  const hideIds = [ "summaryCardsSection", "symbolSection", "symbolDetailSection", "swotSection", "martinSection", ];
  hideIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const clearIds = [ "symbolButtons", "symbolMiniCharts", "symbolStats", "martinTables", "swotST", "swotS", "swotSW", "swotT", "swotW", "swotOT", "swotO", "swotOW", "eaCenterAnalysis", ];
  clearIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
  const summaryDefaults = { growthValue: "0 %", growthPeriod: "", radarProfitTrades: "", radarLossTrades: "", radarDepositLoad: "", radarMaxDD: "", radarActivity: "", equityValue: "0.00", profitValue: "0.00", initialDepositValue: "0.00", };
  Object.entries(summaryDefaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
  const equityBar = document.getElementById("equityBar");
  const profitBar = document.getElementById("profitBar");
  if (equityBar) equityBar.style.width = "0%";
  if (profitBar) profitBar.style.width = "0%";
  const fileInput = document.getElementById("csvFile");
  if (fileInput) fileInput.value = "";
  const eaSelect = document.getElementById("eaSelect");
  if (eaSelect) eaSelect.value = "SMA";
  const symbolTitle = document.getElementById("symbolTitle");
  if (symbolTitle) symbolTitle.textContent = "5. Symbol 深入分析 📊";
  const eaTag = document.getElementById("eaTag");
  if (eaTag) eaTag.textContent = "EA";
  document.querySelectorAll(".toggle-mode").forEach((b) => b.classList.remove("active"));
  const pipsBtn = document.querySelector('.toggle-mode[data-mode="pips"]');
  if (pipsBtn) pipsBtn.classList.add("active");
  const cumInput = document.getElementById("cumSwitch");
  if (cumInput) cumInput.checked = false;
  cumulativeMode = "all";
  const menuBar = document.getElementById("analyzerMenuBar");
  if (menuBar) menuBar.style.display = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 帳戶摘要卡 ----------
function renderSummaryCards(acc) {
  const stats = acc.stats;
  const netProfit = stats.grossProfit - stats.grossLoss;
  const initialDeposit = globalInitialDeposit;
  const equity = initialDeposit + netProfit;
  const growthPct = (equity / initialDeposit - 1) * 100;
  const periodDays = acc.firstTime && acc.lastTime ? Math.max(1, Math.round((acc.lastTime.getTime() - acc.firstTime.getTime()) / (1000 * 3600 * 24))) : 0;
  const weeks = (periodDays / 7).toFixed(1);
  const growthEl = document.getElementById("growthValue");
  const growthPeriodEl = document.getElementById("growthPeriod");
  if (growthEl) growthEl.textContent = growthPct.toFixed(2) + " %";
  if (growthPeriodEl) growthPeriodEl.textContent = "Days: " + periodDays + " (Week(s): " + weeks + ")";
  const equityEl = document.getElementById("equityValue");
  const profitEl = document.getElementById("profitValue");
  const initEl = document.getElementById("initialDepositValue");
  if (equityEl) equityEl.textContent = equity.toFixed(2);
  if (profitEl) profitEl.textContent = netProfit.toFixed(2);
  if (initEl) initEl.textContent = initialDeposit.toFixed(2);
  const equityPct = Math.min(100, (equity / initialDeposit) * 20);
  const profitPct = Math.min(100, Math.abs(netProfit / initialDeposit) * 20);
  const equityBar = document.getElementById("equityBar");
  const profitBar = document.getElementById("profitBar");
  if (equityBar) equityBar.style.width = equityPct + "%";
  if (profitBar) profitBar.style.width = profitPct + "%";
  const radarProfit = document.getElementById("radarProfitTrades");
  const radarLoss = document.getElementById("radarLossTrades");
  const radarDepositLoad = document.getElementById("radarDepositLoad");
  const radarMaxDD = document.getElementById("radarMaxDD");
  const radarActivity = document.getElementById("radarActivity");
  const radarAlgoScore = document.getElementById("radarAlgoScore");
  if (radarProfit) radarProfit.textContent = (stats.winRate * 100).toFixed(1) + " %";
  if (radarLoss) radarLoss.textContent = (stats.lossRate * 100).toFixed(1) + " %";
  if (radarDepositLoad) radarDepositLoad.textContent = "0.0 %";
  if (radarMaxDD) radarMaxDD.textContent = stats.maxDrawdown.toFixed(2);
  if (radarActivity) radarActivity.textContent = stats.totalTrades + " trades";
  if (radarAlgoScore) radarAlgoScore.textContent = "–";
}

// ---------- Section 2: Equity Growth Chart ----------
function renderSummaryEquityChart(acc) {
  const ctxEl = document.getElementById("equityChart");
  if (!ctxEl) return;
  if (equityChart) equityChart.destroy();
  equityChart = new Chart(ctxEl.getContext("2d"), {
    type: "line",
    data: {
      labels: acc.curve.map((p) => p.x),
      datasets: [{ label: "Equity Curve", data: acc.curve.map((p) => p.y), borderColor: "#22d3ee", backgroundColor: "rgba(34,211,238,0.1)", fill: true, pointRadius: 0, tension: 0.3, borderWidth: 2, }],
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { title: { display: true, text: "Cumulative Profit" }, ticks: { maxTicksLimit: 5 } }, }, },
  });
}

// ---------- Radar Chart ----------
function renderRadarChart(acc) {
  const ctxEl = document.getElementById("radarChart");
  if (!ctxEl) return;
  if (radarChart) radarChart.destroy();
  const stats = acc.stats;
  const profitScore = stats.winRate * 100;
  const lossScore = 100 - stats.lossRate * 100;
  const depositScore = 100;
  const ddScore = Math.max(0, 100 - Math.min(100, stats.maxDrawdown / 100));
  const periodDays = acc.firstTime && acc.lastTime ? Math.max(1, Math.round((acc.lastTime - acc.firstTime) / (1000 * 3600 * 24))) : 1;
  const tradesPerDay = stats.totalTrades / periodDays;
  const clippedActivity = Math.max(0, Math.min(100, tradesPerDay * 20));
  const algoScore = 50;
  const labels = ["Profit Trades", "Loss Trades", "Max Deposit Load", "Max DD", "Trading Activity", "Algo Trading"];
  const data = [profitScore, lossScore, depositScore, ddScore, clippedActivity, algoScore];
  radarChart = new Chart(ctxEl.getContext("2d"), {
    type: "radar",
    data: { labels, datasets: [{ label: "EA Radar", data, backgroundColor: "rgba(14, 165, 233, 0.25)", borderColor: "#0ea5e9", borderWidth: 2, pointBackgroundColor: "#0ea5e9", pointRadius: 3, }], },
    options: { plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, min: 0, max: 100, ticks: { stepSize: 20, showLabelBackdrop: false }, grid: { color: document.body.dataset.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(148, 163, 184, 0.4)" }, angleLines: { color: document.body.dataset.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(148, 163, 184, 0.4)" }, pointLabels: { font: { size: 10 } }, }, }, },
  });
}

// ---------- Symbol 按鈕 ----------
function renderSymbolButtons() {
  const container = document.getElementById("symbolButtons");
  container.innerHTML = "";
  const symbols = Object.keys(globalBySymbol).sort();
  const allStats = buildStats(globalTrades);
  const allNet = allStats.grossProfit - allStats.grossLoss;
  const allBtn = document.createElement("button");
  allBtn.className = "symbol-btn active";
  allBtn.dataset.symbol = "ALL";
  allBtn.innerHTML = `All Symbols &nbsp; ${allNet.toFixed(0)} `;
  allBtn.onclick = () => { [...container.querySelectorAll(".symbol-btn")].forEach((b) => b.classList.remove("active")); allBtn.classList.add("active"); renderSymbol("ALL"); };
  container.appendChild(allBtn);
  symbols.forEach((sym) => {
    const stats = buildStats(globalBySymbol[sym]);
    const net = stats.grossProfit - stats.grossLoss;
    const btn = document.createElement("button");
    btn.className = "symbol-btn";
    btn.dataset.symbol = sym;
    btn.innerHTML = `${sym} &nbsp; ${net.toFixed(0)} `;
    btn.onclick = () => { [...container.querySelectorAll(".symbol-btn")].forEach((b) => b.classList.remove("active")); btn.classList.add("active"); renderSymbol(sym); };
    container.appendChild(btn);
  });
}

function renderSymbol(symbol) {
  const trades = symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];
  if (!trades.length) return;
  document.getElementById("symbolDetailSection").style.display = "block";
  document.getElementById("swotSection").style.display = "block";
  expandBody("symbolDetailBody");
  expandBody("swotBody");
  document.getElementById("symbolTitle").textContent = symbol === "ALL" ? "5. Symbol 深入分析 📊 – All Symbols" : `5. Symbol 深入分析 📊 – ${symbol}`;
  const cumWrap = document.getElementById("cumSwitchWrapper");
  if (cumWrap) cumWrap.style.display = symbol === "ALL" ? "inline-flex" : "none";
  const stats = buildStats(trades);
  renderSymbolStats(stats);
  const rule = EA_RULES[globalEAKey] || EA_RULES.OtherBasic;
  const eaTag = document.getElementById("eaTag");
  if (eaTag) eaTag.textContent = symbol === "ALL" ? `${rule.name} – 全組合` : rule.name;
  let martinSummary = null;
  if (rule.martin && symbol !== "ALL") {
    const m = buildMartinForSymbol(trades);
    martinSummary = m.martinSummary;
    renderMartinTables(symbol, m.tablePerSide);
    document.getElementById("martinSection").style.display = "block";
  } else {
    document.getElementById("martinSection").style.display = "none";
  }
  renderMfeMaeHoldingCharts(trades);
  renderSymbolExtraCharts(symbol, trades);
  const swot = buildSwotForEA(globalEAKey, symbol, stats, martinSummary);
  renderSwot(swot);
}

function renderSymbolStats(stats) {
  const net = stats.grossProfit - stats.grossLoss;
  const el = document.getElementById("symbolStats");
  el.innerHTML = `

單數: ${stats.totalTrades} &nbsp; 勝率: ${(stats.winRate * 100).toFixed(1)}% &nbsp; 淨盈利: ${net.toFixed(2)} &nbsp; PF: ${stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}

期望值/單: ${stats.expectancy.toFixed(2)} &nbsp; Max DD: ${stats.maxDrawdown.toFixed(2)} &nbsp; 最大連虧: ${stats.maxConsecLoss}

`;
}

// ---------- Martin ----------
function buildMartinForSymbol(trades) {
  const map = {};
  for (const t of trades) {
    const key = `${t.symbol}_${t.type}_${t.lots.toFixed(2)}`;
    if (!map[key]) {
      map[key] = { symbol: t.symbol, side: t.type.toUpperCase(), lots: t.lots, tradeCount: 0, sumProfit: 0, sumPips: 0, winCount: 0, lossCount: 0, minWinProfit: null };
    }
    const m = map[key];
    m.tradeCount++;
    m.sumProfit += t.netProfit;
    m.sumPips += t.netPips;
    if (t.netProfit > 0) {
      m.winCount++;
      if (m.minWinProfit === null || t.netProfit < m.minWinProfit) m.minWinProfit = t.netProfit;
    } else if (t.netProfit < 0) m.lossCount++;
  }
  const rows = Object.values(map);
  const bySide = {};
  for (const r of rows) {
    const key = `${r.symbol}_${r.side}`;
    if (!bySide[key]) bySide[key] = [];
    bySide[key].push(r);
  }
  const tablePerSide = [];
  const martinSummary = { totalProfit: 0, firstPositiveLevel: null, maxLevel: 0, worstSideNegative: null };
  for (const key of Object.keys(bySide)) {
    const [symbol, side] = key.split("_");
    const arr = bySide[key].sort((a, b) => a.lots - b.lots);
    let totalProfit = 0, totalPips = 0, totalTrades = 0, cum = 0, levelIndex = 0, firstPositiveLevel = null;
    const rowsOut = [];
    for (const r of arr) {
      totalProfit += r.sumProfit;
      totalPips += r.sumPips;
      totalTrades += r.tradeCount;
      levelIndex++;
      cum += r.sumProfit;
      if (cum >= 0 && firstPositiveLevel === null) firstPositiveLevel = levelIndex;
      const levelWinRate = r.tradeCount > 0 ? (r.winCount / r.tradeCount) * 100 : 0;
      rowsOut.push({ symbol, side, level: levelIndex, lots: r.lots, levelTrades: r.tradeCount, levelSumProfit: r.sumProfit, levelSumPips: r.sumPips, cumulativeProfit: cum, totalProfit, totalPips, totalTrades, levelWinRate, levelMinWin: r.minWinProfit });
    }
    tablePerSide.push({ symbol, side, totalProfit, totalPips, totalTrades, rows: rowsOut, firstPositiveLevel, maxLevel: levelIndex });
    martinSummary.totalProfit += totalProfit;
    if (levelIndex > martinSummary.maxLevel) martinSummary.maxLevel = levelIndex;
    if (totalProfit < 0) martinSummary.worstSideNegative = { symbol, side, totalProfit };
    if (firstPositiveLevel !== null) {
      if (martinSummary.firstPositiveLevel === null || firstPositiveLevel < martinSummary.firstPositiveLevel) martinSummary.firstPositiveLevel = firstPositiveLevel;
    }
  }
  return { tablePerSide, martinSummary };
}

function renderMartinTables(symbol, tablePerSide) {
  const container = document.getElementById("martinTables");
  if (!container) return;
  container.innerHTML = "";
  tablePerSide.forEach((block) => {
    const title = document.createElement("div");
    title.className = "martin-header";
    const totalClass = block.totalProfit < 0 ? "row-total-negative" : "row-total-positive";
    title.innerHTML = ` ${block.symbol} - ${block.side} &nbsp; TOTAL Profit: ${block.totalProfit.toFixed(2)}, Trades: ${block.totalTrades} `;
    container.appendChild(title);
    const wrap = document.createElement("div");
    wrap.className = "martin-table-wrapper";
    const table = document.createElement("table");
    table.className = "martin-table";
    table.innerHTML = `<thead><tr><th>#</th><th>Lots</th><th>Trades</th><th>SUM Profit</th><th>SUM Pips</th><th>Cum Profit</th><th>Win Rate %</th><th>Min Win Profit</th><th>TOTAL Profit</th><th>Total Trades</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    block.rows.forEach((r) => {
      const tr = document.createElement("tr");
      let cls = block.totalProfit < 0 ? "row-total-negative" : (block.firstPositiveLevel !== null && r.level >= block.firstPositiveLevel ? "level-safe" : "level-risk");
      if (cls) tr.classList.add(cls);
      if (r.levelWinRate >= 80) tr.classList.add("level-high-winrate");
      const minWinText = r.levelMinWin == null ? "–" : r.levelMinWin.toFixed(2);
      const winRateDisplay = r.levelWinRate >= 80 ? `<strong>${r.levelWinRate.toFixed(1)}%</strong>` : `${r.levelWinRate.toFixed(1)}%`;
      tr.innerHTML = `<td>${r.level}</td><td>${r.lots.toFixed(2)}</td><td>${r.levelTrades}</td><td>${r.levelSumProfit.toFixed(2)}</td><td>${r.levelSumPips.toFixed(1)}</td><td>${r.cumulativeProfit.toFixed(2)}</td><td>${winRateDisplay}</td><td>${minWinText}</td><td>${r.totalProfit.toFixed(2)}</td><td>${r.totalTrades}</td>`;
      tbody.appendChild(tr);
    });
    wrap.appendChild(table);
        const legend = document.createElement("div");
            legend.className = "martin-legend";
                legend.innerHTML = `<span class="legend-box level-safe"></span> Safe Level (Cumulative profit recovered) &nbsp; <span class="legend-box level-high-winrate"></span> Win Rate \u226580% (highlighted in blue) &nbsp; <span class="legend-box row-total-negative"></span> Loss-making side`;
                    wrap.appendChild(legend);
    container.appendChild(wrap);
  });
}

// ---------- Symbol Mini Charts ----------
function renderSymbolMiniCharts() {
  const container = document.getElementById("symbolMiniCharts");
  container.innerHTML = "";
  addMiniChartCard(container, "All Symbols", globalTrades);
  Object.keys(globalBySymbol).sort().forEach((sym) => addMiniChartCard(container, sym, globalBySymbol[sym]));
}

function addMiniChartCard(container, label, trades) {
  if (!trades || !trades.length) return;
  const stats = buildStats(trades);
  const net = stats.grossProfit - stats.grossLoss;
  const div = document.createElement("div");
  div.className = "mini-chart-card";
  const canvas = document.createElement("canvas");
  div.appendChild(canvas);
  const title = document.createElement("div");
  title.className = "mini-chart-title";
  title.innerHTML = `${label} &nbsp; ${net.toFixed(0)} `;
  div.appendChild(title);
  container.appendChild(div);
  let cum = 0;
  const points = [];
  trades.forEach((t) => {
    cum += t.netProfit;
    points.push(cum);
  });
  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels: points.map((_, i) => i + 1), datasets: [{ data: points, borderColor: "#22c55e", borderWidth: 1, fill: false, pointRadius: 0, tension: 0.2 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } },
  });
}

// ---------- MFE / MAE / Holding ----------
function renderMfeMaeHoldingCharts(trades) {
  const mfeCtx = document.getElementById("mfeChart");
  const maeCtx = document.getElementById("maeChart");
  const holdCtx = document.getElementById("holdingChart");
  if (!mfeCtx || !maeCtx || !holdCtx) return;
  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();
  const xKey = mfeMaeMode === "pips" ? "netPips" : "netProfit";
  const xTitle = mfeMaeMode === "pips" ? "Result (Net Pips)" : "Result (Net Profit)";
  const mfeData = trades.map((t) => ({ x: t[xKey], y: t.mfe, c: t.netProfit >= 0 ? "#16a34a" : "#dc2626" }));
  const maeData = trades.map((t) => ({ x: t[xKey], y: t.mae, c: t.netProfit >= 0 ? "#16a34a" : "#dc2626" }));
  const holdData = trades.map((t) => ({ x: t[xKey], y: t.holdingDays, c: t.netProfit >= 0 ? "#16a34a" : "#dc2626" }));
  mfeChart = new Chart(mfeCtx.getContext("2d"), {
    type: "scatter",
    data: { datasets: [{ label: "MFE vs Result", data: mfeData, pointBackgroundColor: mfeData.map((d) => d.c), pointRadius: 3 }] },
    options: { parsing: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: xTitle } }, y: { title: { display: true, text: "MFE (pips)" } } } }
  });
  maeChart = new Chart(maeCtx.getContext("2d"), {
    type: "scatter",
    data: { datasets: [{ label: "MAE vs Result", data: maeData, pointBackgroundColor: maeData.map((d) => d.c), pointRadius: 3 }] },
    options: { parsing: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: xTitle } }, y: { title: { display: true, text: "MAE (pips)" } } } }
  });
  holdingChart = new Chart(holdCtx.getContext("2d"), {
    type: "scatter",
    data: { datasets: [{ label: "Holding Time vs Result", data: holdData, pointBackgroundColor: holdData.map((d) => d.c), pointRadius: 3 }] },
    options: { parsing: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: xTitle } }, y: { title: { display: true, text: "Holding Time (days)" } } } }
  });
}

// ---------- Symbol Extra Charts ----------
function renderSymbolExtraCharts(symbol, trades) {
  const cumCtx = document.getElementById("symbolCumulativeChart");
  const wdProfitCtx = document.getElementById("symbolWeekdayProfitChart");
  const wdCountCtx = document.getElementById("symbolWeekdayCountChart");
  const hrProfitCtx = document.getElementById("symbolHourlyProfitChart");
  const hrCountCtx = document.getElementById("symbolHourlyCountChart");
  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();
  if (!trades || !trades.length) return;
  if (!cumCtx || !wdProfitCtx || !wdCountCtx || !hrProfitCtx || !hrCountCtx) return;
  const sorted = trades;
  const cumCtx2d = cumCtx.getContext("2d");
  if (symbol === "ALL" && cumulativeMode === "separate") {
    const grouped = {};
    sorted.forEach((t) => { if (!t.symbol) return; if (!grouped[t.symbol]) grouped[t.symbol] = []; grouped[t.symbol].push(t); });
    const baseColors = ["#22d3ee", "#a855f7", "#f97316", "#22c55e", "#eab308", "#ec4899", "#0ea5e9"];
    let colorIndex = 0;
    const datasets = [];
    let maxLen = 0;
    Object.entries(grouped).forEach(([symKey, arr]) => {
      let cum = 0; const data = []; arr.forEach((t) => { cum += t.netProfit; data.push(cum); }); if (data.length > maxLen) maxLen = data.length;
      const c = baseColors[colorIndex++ % baseColors.length]; datasets.push({ label: symKey, data, borderColor: c, fill: false, pointRadius: 0, tension: 0.15 });
    });
    const labels = Array.from({ length: maxLen }, (_, i) => i + 1);
    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: "line",
      data: { labels, datasets },
      options: { plugins: { legend: { display: true } }, scales: { x: { title: { display: true, text: "Trade Index (per Symbol)" } }, y: { title: { display: true, text: "Profit" } } } }
    });
  } else {
    let cum = 0; const cumLabels = []; const cumData = []; sorted.forEach((t, idx) => { cum += t.netProfit; cumLabels.push(idx + 1); cumData.push(cum); });
    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: "line",
      data: { labels: cumLabels, datasets: [{ label: "Cumulative Profit", data: cumData, borderColor: "#2563eb", fill: false, pointRadius: 0, tension: 0.15 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "Trade Index" } }, y: { title: { display: true, text: "Profit" } } } }
    });
  }
  const weekdayProfit = Array(7).fill(0); const weekdayCount = Array(7).fill(0);
  sorted.forEach((t) => { const d = new Date(t.closeTime || t.openTime); const wd = isNaN(d) ? 0 : d.getDay(); weekdayProfit[wd] += t.netProfit; weekdayCount[wd] += 1; });
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  symbolWeekdayProfitChart = new Chart(wdProfitCtx.getContext("2d"), {
    type: "bar",
    data: { labels: weekdayNames, datasets: [{ label: "Profit", data: weekdayProfit, backgroundColor: weekdayProfit.map((v) => v >= 0 ? "#22d3ee" : "#ef4444") }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "Profit" } } } }
  });
  symbolWeekdayCountChart = new Chart(wdCountCtx.getContext("2d"), {
    type: "bar",
    data: { labels: weekdayNames, datasets: [{ label: "Count", data: weekdayCount, backgroundColor: "#6366f1" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "Trades" }, beginAtZero: true } } }
  });
  const hourlyProfit = Array(24).fill(0); const hourlyCount = Array(24).fill(0);
  sorted.forEach((t) => { const d = new Date(t.closeTime || t.openTime); const h = isNaN(d) ? 0 : d.getHours(); hourlyProfit[h] += t.netProfit; hourlyCount[h] += 1; });
  const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  symbolHourlyProfitChart = new Chart(hrProfitCtx.getContext("2d"), {
    type: "bar",
    data: { labels: hourLabels, datasets: [{ label: "Profit", data: hourlyProfit, backgroundColor: hourlyProfit.map((v) => v >= 0 ? "#22d3ee" : "#ef4444") }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "Hour" } }, y: { title: { display: true, text: "Profit" } } } }
  });
  symbolHourlyCountChart = new Chart(hrCountCtx.getContext("2d"), {
    type: "bar",
    data: { labels: hourLabels, datasets: [{ label: "Count", data: hourlyCount, backgroundColor: "#3b82f6" }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "Hour" } }, y: { title: { display: true, text: "Trades" }, beginAtZero: true } } }
  });
}

// ---------- Analyzer Menu Bar Scroll ----------
function scrollToAnalyzerSection(id) {
  const el = document.getElementById(id);
  if (!el || el.style.display === "none") return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- SWOT ----------
function renderSwot(swot) {
  if (!swot) return;
  document.getElementById("swotST").innerHTML = "<strong>ST</strong><br>" + swot.ST.join("<br>");
    document.getElementById("swotS").innerHTML = "<strong>S</strong><br>" + swot.S.join("<br>");
    document.getElementById("swotSW").innerHTML = "<strong>SW</strong><br>" + swot.SW.join("<br>");
    document.getElementById("swotT").innerHTML = "<strong>T</strong><br>" + swot.T.join("<br>");
    document.getElementById("swotW").innerHTML = "<strong>W</strong><br>" + swot.W.join("<br>");
    document.getElementById("swotOT").innerHTML = "<strong>OT</strong><br>" + swot.OT.join("<br>");
    document.getElementById("swotO").innerHTML = "<strong>O</strong><br>" + swot.O.join("<br>");
    document.getElementById("swotOW").innerHTML = "<strong>OW</strong><br>" + swot.OW.join("<br>");
  const eaCenterText = document.getElementById("swotCenterText");
  if (eaCenterText) {
    eaCenterText.innerHTML = swot.centerAnalysis ? swot.centerAnalysis.join("<br>") : "";
  }
}
