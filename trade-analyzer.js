// trade-analyzer.js
// v0.0320309001
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
    const observer = new MutationObserver(() => {
        const theme = body.dataset.theme || "light";
        updateChartThemes(theme);
    });
    observer.observe(body, { attributes: true, attributeFilter: ["data-theme"] });
    updateChartThemes(body.dataset.theme || "light");
})();

function updateChartThemes(theme) {
    const isDark = theme === "dark";
    const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
    const textColor = isDark ? "#e8eaf6" : "#1a1f3a";
    Chart.defaults.color = textColor;
    
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
if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze);
const csvFile = document.getElementById("csvFile");
if (csvFile) csvFile.addEventListener("change", handleAnalyze);

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
    document.querySelectorAll(".toggle-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
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

function parseCsv(text) {
    const lines = text.trim().split(/\r?
/);
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
    globalTrades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));
    globalBySymbol = groupBySymbol(globalTrades);
}

function parseHoldingToDays(text) {
    if (!text) return 0;
    const t = text.toLowerCase().trim();
    if (t.endsWith("days") || t.endsWith("day")) return parseFloat(t) || 0;
    if (t.endsWith("hrs") || t.endsWith("hours") || t.endsWith("hr")) return (parseFloat(t) || 0) / 24.0;
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

function buildStats(trades) {
    const totalTrades = trades.length;
    if (!totalTrades) return null;
    let grossProfit = 0, grossLoss = 0, profitTrades = 0, lossTrades = 0;
    let maxConsecLoss = 0, curConsecLoss = 0, cum = 0, peak = 0, maxDD = 0;
    for (const t of trades) {
        const p = t.netProfit;
        if (p > 0) { profitTrades++; grossProfit += p; curConsecLoss = 0; }
        else if (p < 0) { lossTrades++; grossLoss += -p; curConsecLoss++; if (curConsecLoss > maxConsecLoss) maxConsecLoss = curConsecLoss; }
        cum += p; if (cum > peak) peak = cum;
        const dd = peak - cum; if (dd > maxDD) maxDD = dd;
    }
    const winRate = profitTrades / totalTrades || 0;
    const lossRate = lossTrades / totalTrades || 0;
    const avgWin = profitTrades ? grossProfit / profitTrades : 0;
    const avgLoss = lossTrades ? grossLoss / lossTrades : 0;
    return { totalTrades, grossProfit, grossLoss, profitTrades, lossTrades, winRate, lossRate, avgWin, avgLoss, expectancy: avgWin * winRate - avgLoss * lossRate, profitFactor: grossLoss > 0 ? grossProfit / grossLoss : Infinity, maxDrawdown: maxDD, maxConsecLoss };
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
        weekdayCounts[ts.getDay()]++;
        weekdayProfit[ts.getDay()] += t.netProfit;
        bySymbolProfit[t.symbol] = (bySymbolProfit[t.symbol] || 0) + t.netProfit;
        curve.push({ x: label, y: cum });
        if (!firstTime || ts < firstTime) firstTime = ts;
        if (!lastTime || ts > lastTime) lastTime = ts;
    }
    return { stats, weekdayCounts, weekdayProfit, symbolRanking: Object.entries(bySymbolProfit).sort((a, b) => b[1] - a[1]), curve, firstTime, lastTime };
}

document.addEventListener("click", (e) => {
    const header = e.target.closest(".collapsible-header");
    if (!header) return;
    const body = document.getElementById(header.dataset.target);
    if (!body) return;
    const btn = header.querySelector(".collapse-toggle");
    const isCollapsed = body.classList.toggle("collapsed");
    body.style.maxHeight = isCollapsed ? "0px" : body.scrollHeight + "px";
    if (btn) btn.textContent = isCollapsed ? "＋" : "－";
});

function expandBody(id) {
    const body = document.getElementById(id);
    if (body) { body.classList.remove("collapsed"); body.style.maxHeight = body.scrollHeight + "px"; }
}

function buildAll() {
    if (!globalTrades.length) { alert("CSV 內沒有有效交易紀錄"); return; }
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
    if (document.getElementById("analyzerMenuBar")) document.getElementById("analyzerMenuBar").style.display = "flex";
}

function resetView() {
    globalTrades = []; globalBySymbol = {}; mfeMaeMode = "pips"; cumulativeMode = "all";
    [equityChart, weekdayChart, symbolProfitChart, mfeChart, maeChart, holdingChart, symbolCumulativeChart, symbolWeekdayProfitChart, symbolWeekdayCountChart, symbolHourlyProfitChart, symbolHourlyCountChart].forEach(c => c && c.destroy());
    equityChart = weekdayChart = symbolProfitChart = mfeChart = maeChart = holdingChart = symbolCumulativeChart = symbolWeekdayProfitChart = symbolWeekdayCountChart = symbolHourlyProfitChart = symbolHourlyCountChart = null;
    ["summaryCardsSection", "symbolSection", "symbolDetailSection", "swotSection", "martinSection"].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
    ["symbolButtons", "symbolMiniCharts", "symbolStats", "martinTables", "swotST", "swotS", "swotSW", "swotT", "swotW", "swotOT", "swotO", "swotOW"].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ""; });
    const fileInput = document.getElementById("csvFile"); if (fileInput) fileInput.value = "";
    if (document.getElementById("analyzerMenuBar")) document.getElementById("analyzerMenuBar").style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSummaryCards(acc) {
    const stats = acc.stats;
    const netProfit = stats.grossProfit - stats.grossLoss;
    const initialDeposit = globalInitialDeposit;
    const equity = initialDeposit + netProfit;
    const growthPct = (equity / initialDeposit - 1) * 100;
    const periodDays = acc.firstTime && acc.lastTime ? Math.max(1, Math.round((acc.lastTime.getTime() - acc.firstTime.getTime()) / (1000 * 3600 * 24))) : 0;
    const growthEl = document.getElementById("growthValue");
    if (growthEl) growthEl.textContent = growthPct.toFixed(2) + " %";
    const growthPeriodEl = document.getElementById("growthPeriod");
    if (growthPeriodEl) growthPeriodEl.textContent = "Days: " + periodDays + " (Week(s): " + (periodDays / 7).toFixed(1) + ")";
    document.getElementById("equityValue").textContent = equity.toFixed(2);
    document.getElementById("profitValue").textContent = netProfit.toFixed(2);
    document.getElementById("initialDepositValue").textContent = initialDeposit.toFixed(2);
    document.getElementById("equityBar").style.width = Math.min(100, (equity / initialDeposit) * 20) + "%";
    document.getElementById("radarProfitTrades").textContent = (stats.winRate * 100).toFixed(1) + " %";
    document.getElementById("radarMaxDD").textContent = stats.maxDrawdown.toFixed(2);
    document.getElementById("radarActivity").textContent = stats.totalTrades + " trades";
}

function renderSummaryEquityChart(acc) {
    const ctx = document.getElementById("equityChart");
    if (!ctx) return;
    if (equityChart) equityChart.destroy();
    equityChart = new Chart(ctx.getContext("2d"), {
        type: "line",
        data: { labels: acc.curve.map(p => p.x), datasets: [{ label: "Equity Curve", data: acc.curve.map(p => p.y), borderColor: "#22d3ee", backgroundColor: "rgba(34,211,238,0.1)", fill: true, pointRadius: 0, tension: 0.3, borderWidth: 1 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { title: { display: true, text: "Cumulative Profit" } } } }
    });
}

function renderRadarChart(acc) {
    const ctx = document.getElementById("radarChart");
    if (!ctx) return;
    if (radarChart) radarChart.destroy();
    const stats = acc.stats;
    radarChart = new Chart(ctx.getContext("2d"), {
        type: "radar",
        data: { labels: ["Profit Trades", "Loss Trades", "Max Deposit Load", "Max DD", "Trading Activity", "Algo Trading"], datasets: [{ label: "EA Radar", data: [stats.winRate * 100, 100 - stats.lossRate * 100, 100, Math.max(0, 100 - stats.maxDrawdown / 100), 50, 50], backgroundColor: "rgba(14, 165, 233, 0.25)", borderColor: "#0ea5e9", borderWidth: 1 }] },
        options: { plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, min: 0, max: 100, ticks: { stepSize: 20, display: false } } } }
    });
}

function renderSymbolButtons() {
    const container = document.getElementById("symbolButtons");
    container.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = "symbol-btn active";
    allBtn.dataset.symbol = "ALL";
    allBtn.innerHTML = `All Symbols &nbsp; ${(acc.stats.grossProfit - acc.stats.grossLoss).toFixed(0)}`;
    allBtn.onclick = () => { [...container.querySelectorAll(".symbol-btn")].forEach(b => b.classList.remove("active")); allBtn.classList.add("active"); renderSymbol("ALL"); };
    container.appendChild(allBtn);
    Object.keys(globalBySymbol).sort().forEach(sym => {
        const stats = buildStats(globalBySymbol[sym]);
        const btn = document.createElement("button");
        btn.className = "symbol-btn";
        btn.dataset.symbol = sym;
        btn.innerHTML = `${sym} &nbsp; ${(stats.grossProfit - stats.grossLoss).toFixed(0)}`;
        btn.onclick = () => { [...container.querySelectorAll(".symbol-btn")].forEach(b => b.classList.remove("active")); btn.classList.add("active"); renderSymbol(sym); };
        container.appendChild(btn);
    });
}

function renderSymbol(symbol) {
    const trades = symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];
    if (!trades.length) return;
    ["symbolDetailSection", "swotSection"].forEach(id => document.getElementById(id).style.display = "block");
    expandBody("symbolDetailBody"); expandBody("swotBody");
    document.getElementById("symbolTitle").textContent = symbol === "ALL" ? "Symbol 深入分析 – All Symbols" : `Symbol 深入分析 – ${symbol}`;
    document.getElementById("cumSwitchWrapper").style.display = symbol === "ALL" ? "flex" : "none";
    const stats = buildStats(trades);
    document.getElementById("symbolStats").innerHTML = `單數: ${stats.totalTrades} &nbsp; 勝率: ${(stats.winRate * 100).toFixed(1)}% &nbsp; 淨盈利: ${(stats.grossProfit - stats.grossLoss).toFixed(2)} &nbsp; PF: ${stats.profitFactor.toFixed(2)}<br>期望值/單: ${stats.expectancy.toFixed(2)} &nbsp; Max DD: ${stats.maxDrawdown.toFixed(2)} &nbsp; 最大連虧: ${stats.maxConsecLoss}`;
    const rule = EA_RULES[globalEAKey] || EA_RULES.OtherBasic;
    document.getElementById("eaTag").textContent = symbol === "ALL" ? `${rule.name} – 全組合` : rule.name;
    let martinSummary = null;
    if (rule.martin && symbol !== "ALL") {
        const m = buildMartinForSymbol(trades);
        martinSummary = m.martinSummary;
        renderMartinTables(symbol, m.tablePerSide);
        document.getElementById("martinSection").style.display = "block";
    } else { document.getElementById("martinSection").style.display = "none"; }
    renderMfeMaeHoldingCharts(trades);
    renderSymbolExtraCharts(symbol, trades);
    renderSwot(buildSwotForEA(globalEAKey, symbol, stats, martinSummary));
}

function renderMfeMaeHoldingCharts(trades) {
    const xKey = mfeMaeMode === "pips" ? "netPips" : "netProfit";
    const xTitle = mfeMaeMode === "pips" ? "Result (Net Pips)" : "Result (Net Profit)";
    const common = (data, yLabel) => ({
        type: "scatter",
        data: { datasets: [{ data, pointBackgroundColor: data.map(d => d.c), pointRadius: 3 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: xTitle } }, y: { title: { display: true, text: yLabel } } } }
    });
    if (mfeChart) mfeChart.destroy();
    mfeChart = new Chart(document.getElementById("mfeChart").getContext("2d"), common(trades.map(t => ({ x: t[xKey], y: t.mfe, c: t.netProfit >= 0 ? "#16a34a" : "#dc2626" })), "MFE (pips)"));
    if (maeChart) maeChart.destroy();
    maeChart = new Chart(document.getElementById("maeChart").getContext("2d"), common(trades.map(t => ({ x: t[xKey], y: t.mae, c: t.netProfit >= 0 ? "#16a34a" : "#dc2626" })), "MAE (pips)"));
    if (holdingChart) holdingChart.destroy();
    holdingChart = new Chart(document.getElementById("holdingChart").getContext("2d"), common(trades.map(t => ({ x: t[xKey], y: t.holdingDays, c: t.netProfit >= 0 ? "#16a34a" : "#dc2626" })), "Holding Time (days)"));
}

function renderSymbolExtraCharts(symbol, trades) {
    const ctxCum = document.getElementById("symbolCumulativeChart").getContext("2d");
    if (symbolCumulativeChart) symbolCumulativeChart.destroy();
    if (symbol === "ALL" && cumulativeMode === "separate") {
        const grouped = {}; trades.forEach(t => { if (!grouped[t.symbol]) grouped[t.symbol] = []; grouped[t.symbol].push(t); });
        const datasets = Object.entries(grouped).map(([s, arr], i) => {
            let c = 0; return { label: s, data: arr.map(t => { c += t.netProfit; return c; }), borderColor: ["#22d3ee", "#a855f7", "#f97316", "#22c55e", "#eab308"][i % 5], fill: false, pointRadius: 0, tension: 0.15, borderWidth: 1 };
        });
        symbolCumulativeChart = new Chart(ctxCum, { type: "line", data: { labels: Array.from({ length: Math.max(...datasets.map(d => d.data.length)) }, (_, i) => i + 1), datasets }, options: { plugins: { legend: { display: true } } } });
    } else {
        let c = 0;
        symbolCumulativeChart = new Chart(ctxCum, { type: "line", data: { labels: trades.map((_, i) => i + 1), datasets: [{ label: "Cumulative Profit", data: trades.map(t => { c += t.netProfit; return c; }), borderColor: "#2563eb", fill: false, pointRadius: 0, tension: 0.15, borderWidth: 1 }] }, options: { plugins: { legend: { display: false } } } });
    }
    
    const wdProfit = Array(7).fill(0), wdCount = Array(7).fill(0), hrProfit = Array(24).fill(0), hrCount = Array(24).fill(0);
    trades.forEach(t => { const d = new Date(t.closeTime || t.openTime); wdProfit[d.getDay()] += t.netProfit; wdCount[d.getDay()]++; hrProfit[d.getHours()] += t.netProfit; hrCount[d.getHours()]++; });
    
    const renderBar = (id, labels, data, colorArr, title) => {
        const chartId = id + "Chart"; if (window[chartId]) window[chartId].destroy();
        window[chartId] = new Chart(document.getElementById(id).getContext("2d"), { type: "bar", data: { labels, datasets: [{ data, backgroundColor: colorArr }] }, options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: title } } } } });
    };
    renderBar("symbolWeekdayProfit", ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], wdProfit, wdProfit.map(v => v >= 0 ? "#22d3ee" : "#ef4444"), "Profit");
    renderBar("symbolWeekdayCount", ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], wdCount, "#6366f1", "Trades");
    renderBar("symbolHourlyProfit", Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")), hrProfit, hrProfit.map(v => v >= 0 ? "#22d3ee" : "#ef4444"), "Profit");
    renderBar("symbolHourlyCount", Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")), hrCount, "#3b82f6", "Trades");
}

function scrollToAnalyzerSection(id) {
    const el = document.getElementById(id);
    if (el && el.style.display !== "none") el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSwot(swot) {
    if (!swot) return;
    ["ST", "S", "SW", "T", "W", "OT", "O", "OW"].forEach(k => document.getElementById("swot" + k).innerHTML = `<strong>${k}</strong><br>${swot[k].join("<br>")}`);
    if (document.getElementById("swotCenterText")) document.getElementById("swotCenterText").innerHTML = swot.centerAnalysis ? swot.centerAnalysis.join("<br>") : "";
}
