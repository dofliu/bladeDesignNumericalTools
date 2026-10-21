// Minimal i18n: Chinese source text is the key. t(zh) returns English when S.lang === 'en'.
// Static markup uses data-i18n (text) / data-i18n-title (title + aria-label); applyI18n() re-renders both.
export const EN = {
  // header
  '風力機葉片設計': 'Wind Turbine Blade Design',
  '虛擬風洞 · 葉片 · 流場 · 報告': 'Virtual wind tunnel · blade · flow · report',
  '水平軸': 'HAWT', '垂直軸': 'VAWT',
  '風洞': 'Wind tunnel', '單葉片': 'Blade', '流場': 'Flow', '報告': 'Report', '研究': 'Lab',
  '通用三維線葉片(研究模式)': 'General 3-D line blade (research mode)',
  '① 概念': '① Concept', '② 幾何': '② Geometry', '③ 翼型': '③ Airfoil', '④ 虛擬風洞': '④ Tunnel', '⑤ 比較與報告': '⑤ Report',
  '‹ 上一步': '‹ Back', '下一步 ›': 'Next ›', '上一步': 'Previous step', '下一步': 'Next step',
  '流程版面': 'Flow', '設定面板': 'Panel', '匯出': 'Export',
  '切換流程式 / 經典版面': 'Switch flow / classic layout', '收合/展開設定面板': 'Collapse / expand settings panel',
  '匯出葉片 STL 與數據': 'Export blade STL and data', '切換深淺色': 'Toggle light / dark',
  '風機型式': 'Turbine type', '工作區': 'Workspaces', '設計流程': 'Design flow',
  '經典版面': 'Classic', '顯示設定': 'Show panel', '隱藏設定': 'Hide panel',
  '選轉子型式與基本尺寸,看 3D 外觀與整體性能。': 'Pick the rotor type and basic size; check the 3-D look and overall performance.',
  '調整葉片/外形幾何,在單葉片檢視平面圖與剖面。': 'Adjust blade geometry; inspect planform and sections in the Blade workspace.',
  '選翼型、設定沿展長翼型站與極曲線。': 'Choose airfoils, spanwise stations and polars.',
  '設定風速、紊流與負載,觀察轉子與發電機動態。': 'Set wind, turbulence and load; watch rotor and generator dynamics.',
  '執行自動測試、產生報告與比較方案。': 'Run automatic tests, build the report and compare designs.',
  '流場分析:翼型位勢流與轉子致動盤/DMST 流管(近似,非 CFD)。': 'Flow analysis: airfoil potential flow and rotor actuator-disk / DMST stream tube (approximate, not CFD).',
  '研究模式:匯入三維線葉片與極曲線,看各段攻角、Re、資料覆蓋與部分扭矩係數(非整機效率)。': 'Research mode: import a 3-D line blade and polars; see local angle of attack, Re, data coverage and partial torque coefficient (not whole-rotor efficiency).',
  // side panel
  '設計設定': 'Design settings', '完成': 'Done', '翼型': 'Airfoil', '轉子': 'Rotor', '負載': 'Load', '設定': 'Settings',
  // settings panes (EN-2)
  '來流': 'Inflow', '風速': 'Wind speed', '風向': 'Wind direction', '紊流強度': 'Turbulence intensity',
  '空氣': 'Air', '溫度': 'Temperature', '海拔': 'Altitude', '偏航(對風)': 'Yaw (alignment)',
  '偏航模式': 'Yaw mode', '自動對風': 'Auto align', '固定機艙角': 'Fixed nacelle angle', '偏航速率': 'Yaw rate', '機艙角': 'Nacelle angle',
  '模擬': 'Simulation', '時間倍率': 'Time scale', '1×(即時)': '1× (real time)',
  '發電機(永磁同步 + 整流)': 'Generator (PMSG + rectifier)', '依轉子設計自動匹配參數': 'Auto-match parameters to rotor',
  '反電勢常數 ke': 'Back-EMF constant ke', '繞組電阻 Rs': 'Winding resistance Rs', '整流壓降': 'Rectifier drop', '轉換器效率': 'Converter efficiency',
  '負載': 'Load', '負載類型': 'Load type', '電池充電(定電壓)': 'Battery charging (constant voltage)', '電阻負載': 'Resistive load',
  '電池電壓': 'Battery voltage', '負載電阻': 'Load resistance',
  'MPPT 控制': 'MPPT control', '控制策略': 'Control strategy', '擾動觀察法 P&O(爬山法)': 'Perturb & observe (P&O)',
  '最佳尖速比控制(需風速計)': 'Optimal tip-speed ratio (needs anemometer)', '最佳轉矩控制 T = kω²': 'Optimal torque T = kω²', '手動固定占空比': 'Manual fixed duty',
  '轉速擾動 Δω(額定%)': 'Speed perturbation Δω (% rated)', '擾動週期': 'Perturbation period', '占空比 D': 'Duty D', '固定 D(比較用)': 'Fixed D (for comparison)',
  '保護': 'Protection', '超速保護(超過上限自動煞車)': 'Overspeed protection (auto brake above limit)', '轉速上限': 'Speed limit', '發電機額定功率': 'Generator rated power',
  '開始側偏風速': 'Furl start wind speed', '最大側偏角': 'Max furl angle', '側偏速率': 'Furl rate',
  '切出風速': 'Cut-out wind speed', '重啟風速': 'Restart wind speed', '槳距致動速率': 'Pitch actuator rate',
  '額定以上主動變槳(取代降轉速軟失速)': 'Active pitch above rated (replaces soft stall)',
  '放開煞車': 'Release brake', '煞車(短路 + 機械)': 'Brake (short + mechanical)', '電氣即時值': 'Live electrical values',
  '立即重新匹配': 'Re-match now', '施加陣風(6 秒)': 'Apply gust (6 s)', '轉子歸零重新啟動': 'Reset rotor and restart', '預先轉到最佳轉速': 'Pre-spin to optimal speed',
  '轉子家族(點選卡片建立預設設計)': 'Rotor family (click a card for a default design)', '轉子摘要': 'Rotor summary', '方案比較': 'Design comparison',
  '型式': 'Type', '幾何': 'Geometry', '控制': 'Control', '材料': 'Material', '檔案': 'File', '檔案單位': 'File unit',
  '設計點與弦長': 'Design point and chord', '設計風速': 'Design wind speed', '設計尖速比 λd': 'Design tip-speed ratio λd', '轉子半徑 R': 'Rotor radius R',
  '輪轂半徑': 'Hub radius', '輪轂直徑': 'Hub diameter', '葉片數 B': 'Blade count B', '葉片數': 'Blade count', '片': 'blades', '支': 'arms', '圈': 'turns',
  '最大弦長 / R': 'Max chord / R', '弦長 c': 'Chord c', '弦長倍率': 'Chord scale', '高度 H': 'Height H', '外徑 D': 'Outer diameter D',
  '高度 / 軸向長度 H': 'Height / axial length H', '軸向長度 L': 'Axial length L', '最大半徑 / 軸向長度': 'Max radius / axial length',
  '每葉支撐臂數': 'Support arms per blade', '上下端板': 'End plates', '螺旋包角': 'Helix wrap angle', '每片繞軸圈數': 'Turns per blade',
  '扭角方式': 'Twist method', '扭角設計': 'Twist design', 'BEM 數值最佳化(設計 λ 下 Cp 最大)': 'BEM optimization (max Cp at design λ)',
  'Schmitz 解析解(快速)': 'Schmitz analytic (fast)', '線性扭角(手動指定根/尖)': 'Linear twist (manual root/tip)', '手動指定': 'Manual',
  '根部扭角': 'Root twist', '尖部扭角': 'Tip twist', '扭轉倍率': 'Twist scale', '安裝角(外傾+)': 'Pitch / setting angle (outward +)', '槳距角': 'Pitch angle',
  '目標攻角': 'Target angle of attack', '攻角 α': 'Angle of attack α', '自動:各截面最佳升阻比': 'Auto: best L/D per section',
  '翼型': 'Airfoil', '翼型選擇': 'Airfoil selection', '葉片翼型': 'Blade airfoil', '翼型摘要': 'Airfoil summary', '沿展長的翼型分布': 'Spanwise airfoil distribution',
  '自訂 NACA 翼型': 'Custom NACA airfoil', '匯入翼型資料庫座標': 'Import airfoil database coordinates', '極曲線模型': 'Polar model',
  '失速後 CDmax': 'Post-stall CDmax', '製造修正': 'Manufacturing corrections', '新增翼型站': 'Add airfoil station', '套用建議配置': 'Apply suggested layout',
  '位置 r/R': 'Position r/R', '刪除': 'Delete',
  '簡化動態失速(Gormont 式,未校正)': 'Simplified dynamic stall (Gormont, uncalibrated)', '流線彎曲修正(Migliore 簡化,未校正)': 'Streamline curvature correction (simplified Migliore, uncalibrated)',
  '轉子結構': 'Rotor structure', '幾何與質量(包絡)': 'Geometry and mass (envelope)', '轉子質量': 'Rotor mass', '體積 / 質量': 'Volume / mass',
  '等效密度(實心均勻)': 'Equivalent density (solid, uniform)', '轉動慣量 J(0 = 自動)': 'Moment of inertia J (0 = auto)', '對旋轉軸慣量': 'Inertia about rotation axis',
  '掃掠面積(0 = 自動)': 'Swept area (0 = auto)', '掃掠面積(旋轉包絡)': 'Swept area (rotation envelope)', '特徵半徑 R(λ 基準)': 'Characteristic radius R (λ basis)',
  '性能曲線(匯入資料)': 'Performance curve (imported data)', '我的形狀該選哪條路': 'Which route fits my shape',
  '外形控制點 r(z)': 'Shape control points r(z)', '尾端半徑比(1 = 圓柱、< 1 = 錐形)': 'End radius ratio (1 = cylinder, < 1 = taper)', '板厚': 'Plate thickness',
  '重疊比 e/d': 'Overlap ratio e/d', '截面數': 'Section count', '旋轉軸(STL 座標軸)': 'Rotation axis (STL axis)',
  'X 軸': 'X axis', 'Y 軸': 'Y axis', 'Z 軸': 'Z axis', '公分 (cm)': 'cm', '公尺 (m)': 'm', '公釐 (mm)': 'mm', '英吋 (in)': 'in',
  '匯入外形(STL,只在瀏覽器內處理,不上傳)': 'Import shape (STL; processed in-browser, never uploaded)',
  // chart titles / axes / legends (EN-3)
  'A 加權 dB(A)': 'A-weighted dB(A)',
  'Betz 極限': 'Betz limit',
  'Cp 與 Cq vs λ': 'Cp and Cq vs λ',
  'Cp–λ 比較': 'Cp–λ comparison',
  'Cp–λ 與 Ct': 'Cp–λ and Ct',
  'MPPT 理想(限額定)': 'Ideal MPPT (rated-limited)',
  'N·m/m': 'N·m/m',
  'Re (×10³)': 'Re (×10³)',
  'r = 0.7R 沿軸向': 'r = 0.7R along axis',
  'x/R(0 為轉子)': 'x/R (0 = rotor)',
  'α 設計點': 'α design point',
  '上表面': 'Upper surface',
  '上表面 −Cp': 'Upper −Cp',
  '下游 x = 2.5R': 'Downstream x = 2.5R',
  '下表面': 'Lower surface',
  '下表面 −Cp': 'Lower −Cp',
  '入流角與扭角(差值即攻角)': 'Inflow angle and twist (difference = AoA)',
  '分布圖僅適用水平軸方案,可改看功率曲線': 'Distribution plot is HAWT-only; see the power curve instead',
  '功率 (W)': 'Power (W)',
  '功率係數 Cp–λ 比較': 'Power coefficient Cp–λ comparison',
  '功率曲線': 'Power curve',
  '匯入資料點': 'Imported data points',
  '升力係數 Cl–α(各站設計雷諾數)': 'Lift coefficient Cl–α (design Re per station)',
  '升力型垂直軸、外形可用 r(z) 與扭轉描述': 'Lift-type VAWT; shape described by r(z) and twist',
  '升力與阻力係數': 'Lift and drag coefficients',
  '升阻比 L/D': 'Lift-to-drag L/D',
  '升阻比 L/D–α': 'L/D–α',
  '單一葉片': 'Single blade',
  '單葉': 'Single blade',
  '失速角': 'Stall angle',
  '完全自由的 CAD 外形': 'Free-form CAD shape',
  '容許應力': 'Allowable stress',
  '實際 α': 'Actual α',
  '尖速比 λ': 'Tip-speed ratio λ',
  '尖速比、Cp 與占空比': 'Tip-speed ratio, Cp and duty',
  '局部 Re(×10³);虛線為極曲線 Re 範圍': 'Local Re (×10³); dashed = polar Re range',
  '局部雷諾數': 'Local Reynolds number',
  '弦長 c/R': 'Chord c/R',
  '弦長與扭角': 'Chord and twist',
  '弦長與扭角分布': 'Chord and twist distribution',
  '應力 (MPa)': 'Stress (MPa)',
  '扭轉+槳距 θ (°)': 'Twist + pitch θ (°)',
  '揮舞 Mflap (N·m)': 'Flap Mflap (N·m)',
  '撓度 (mm)': 'Deflection (mm)',
  '擺振 Medge (N·m)': 'Edge Medge (N·m)',
  '改到「性能曲線」與「葉片分析」看轉矩特性': 'See torque characteristics in "Performance curves" and "Blade analysis"',
  '攻角 α (°)': 'Angle of attack α (°)',
  '攻角 α(°);虛線為極曲線攻角範圍': 'AoA α (°); dashed = polar AoA range',
  '攻角分布': 'AoA distribution',
  '方位角 (°)': 'Azimuth (°)',
  '方位角 θ (°)': 'Azimuth θ (°)',
  '方位角 θ (°)  灰區:下風半圈': 'Azimuth θ (°)  grey: downwind half',
  '時間 (s)': 'Time (s)',
  '最佳功率軌跡': 'Optimal power track',
  '最佳升阻比 α': 'Best L/D α',
  '有規律的外形,但現有模型算不了(例如螺旋、特殊截面)': 'Regular shape the current model cannot solve (e.g. helix, special section)',
  '未加權 dB': 'Unweighted dB',
  '根部彎矩沿展長(設計點)': 'Root moment along span (design point)',
  '機率密度': 'Probability density',
  '橫向速度剖面 u/V∞': 'Cross-stream velocity profile u/V∞',
  '氣動': 'Aero',
  '氣動功率–轉速(黃點為運轉軌跡)': 'Aero power vs speed (yellow = operating track)',
  '氣動功率與輸出電功率': 'Aero power and electrical output',
  '理想 MPPT 電功率曲線(未限額定)': 'Ideal MPPT power curve (not rated-limited)',
  '理想 MPPT(限額定)': 'Ideal MPPT (rated-limited)',
  '目前': 'Current',
  '目前設定': 'Current setting',
  '相對厚度': 'Relative thickness',
  '等待運轉資料…': 'Waiting for run data…',
  '等效殼截面性質': 'Equivalent shell section properties',
  '紊流測試時間序列': 'Turbulence test time series',
  '總轉矩': 'Total torque',
  '葉根應力 (MPa)': 'Root stress (MPa)',
  '葉根應力時間序列(前 5 秒)': 'Root stress time series (first 5 s)',
  '虛擬風洞實測': 'Virtual tunnel measured',
  '角度 (°)': 'Angle (°)',
  '設計 α': 'Design α',
  '誘導因子': 'Induction factors',
  '誘導因子與葉尖損失': 'Induction factors and tip loss',
  '軸向/切向誘導因子與葉尖損失': 'Axial / tangential induction and tip loss',
  '軸向速度 u/V∞': 'Axial velocity u/V∞',
  '輸出': 'Output',
  '輸出 (W)': 'Output (W)',
  '轉子中心 x = 0': 'Rotor centre x = 0',
  '轉子方位角 (°)': 'Rotor azimuth (°)',
  '轉子總轉矩': 'Rotor total torque',
  '轉矩 (N·m)': 'Torque (N·m)',
  '轉矩 vs 方位角(8 m/s)': 'Torque vs azimuth (8 m/s)',
  '轉矩 vs 方位角(V = 8 m/s)': 'Torque vs azimuth (V = 8 m/s)',
  '轉速 (rpm)': 'Speed (rpm)',
  '轉速 rpm': 'Speed rpm',
  '運轉點': 'Operating point',
  '部分 CQ': 'Partial CQ',
  '部分 CQ(不含誘導、接合與橋接;非整機)': 'Partial CQ (no induction, joints or bridges; not whole rotor)',
  '陣風響應': 'Gust response',
  '電功率 (W)': 'Electrical power (W)',
  '靜止起轉過程': 'Standstill spin-up',
  '靜止轉矩': 'Static torque',
  '面積 (mm²)': 'Area (mm²)',
  '頻率 (Hz)': 'Frequency (Hz)',
  '風速 (m/s)': 'Wind speed (m/s)',
  '風速 m/s': 'Wind speed m/s',
  '風速機率': 'Wind speed probability',
  '風速與轉速': 'Wind speed and rotor speed',
  // language button
  '切換語言(中文 / English)': 'Switch language (中文 / English)'
};

let lang = 'zh';
try { const l = localStorage.getItem('wt-lang'); if (l === 'en' || l === 'zh') lang = l; } catch (e) {}

export const getLang = () => lang;
export const t = zh => (lang === 'en' && EN[zh]) || zh;

// Fragment translation for dynamic strings (numbers interpolated into Chinese text): exact key first,
// then known phrases (FR) replaced longest-first. Results are cached per string.
export const FR = {};
let frKeys = null; const trCache = new Map();
export function tr(s) {
  if (lang !== 'en' || !s || !/[一-鿿]/.test(s)) return s;
  if (EN[s]) return EN[s];
  let r = trCache.get(s);
  if (r !== undefined) return r;
  if (!frKeys) frKeys = Object.keys(FR).sort((a, b) => b.length - a.length);
  r = s;
  for (const k of frKeys) if (r.includes(k)) r = r.split(k).join(FR[k]);
  if (trCache.size > 4000) trCache.clear();
  trCache.set(s, r);
  return r;
}

// Original Chinese is kept in data-zh / data-zh-title so switching back and forth is lossless.
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.dataset.zh == null) el.dataset.zh = el.textContent;
    el.textContent = t(el.dataset.zh);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    if (el.dataset.zhTitle == null) el.dataset.zhTitle = el.getAttribute('title') || el.getAttribute('aria-label') || '';
    const s = t(el.dataset.zhTitle);
    if (el.hasAttribute('title')) el.setAttribute('title', s);
    if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', s);
  });
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  const b = document.getElementById('langBtn');
  if (b) { b.textContent = lang === 'en' ? '中' : 'EN'; b.title = t('切換語言(中文 / English)'); }
}

// Translate text nodes and common attributes of a dynamically built subtree (settings panes).
export function translateTree(root) {
  if (lang !== 'en') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const k = n.nodeValue.trim();
    if (k && /[一-鿿]/.test(k)) { const v = tr(k); if (v !== k) n.nodeValue = n.nodeValue.replace(k, v); }
  }
  root.querySelectorAll('[aria-label],[data-g]').forEach(el => {
    const a = el.getAttribute('aria-label');
    if (a && /[一-鿿]/.test(a)) el.setAttribute('aria-label', tr(a));
  });
  root.querySelectorAll('[title],[placeholder]').forEach(el => {
    for (const k of ['title', 'placeholder']) { const a = el.getAttribute(k); if (a && /[一-鿿]/.test(a)) el.setAttribute(k, tr(a)); }
  });
}

// Translate an HTML string (report body) in English mode: text nodes and title/alt attributes.
export function trHtml(html) {
  if (lang !== 'en' || !/[一-鿿]/.test(html)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const w = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const k = n.nodeValue.trim();
    if (k && /[一-鿿]/.test(k)) n.nodeValue = n.nodeValue.replace(k, tr(k));
  }
  tpl.content.querySelectorAll('[title],[alt]').forEach(el => {
    for (const a of ['title', 'alt']) { const v = el.getAttribute(a); if (v && /[一-鿿]/.test(v)) el.setAttribute(a, tr(v)); }
  });
  return tpl.innerHTML;
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('wt-lang', lang); } catch (e) {}
  applyI18n();
}

// Dynamic DOM (workspaces, HUD, summaries) is rebuilt with Chinese text; translate additions in English mode.
export function watchI18n(root = document.body) {
  let pending = 0;
  new MutationObserver(() => {
    if (lang !== 'en' || pending) return;
    pending = setTimeout(() => { pending = 0; translateTree(root); }, 60);
  }).observe(root, { childList: true, subtree: true, characterData: true });
}

// EN-4: Blade / Flow / Research workspaces, tunnel readouts, canvas annotations.
Object.assign(EN, {
  '站 1': 'Stn 1', '風': 'Wind', '攻角 α (°)': 'Angle of attack α (°)',
  '每個站指定一種翼型與它在葉片上的位置;兩站之間的外形與極曲線依位置線性混合,第一站以內、最後一站以外維持該站翼型。常見做法是根部用厚翼型(t/c 18–25%)承受彎矩,中段過渡,尖部用高升阻比的薄翼型(t/c 12–15%),因為功率主要來自外側 60% 展長。':
    'Each station sets an airfoil and its blade position; shape and polar blend linearly between stations, and the first/last station airfoil is held beyond the ends. Typical practice: thick root airfoil (t/c 18–25%) for bending, a transition in the middle, and thin high-L/D airfoils (t/c 12–15%) at the tip, since most power comes from the outer 60% of span.',
  '內建模型:Hess-Smith 面板法求無黏升力斜率與零升攻角,加上雷諾數相依的摩擦阻力、失速估算與 Viterna 失速後外推(−180°~180°)。需要更高精度時,可貼上 XFOIL 或風洞實測極曲線取代。':
    'Built-in model: Hess-Smith panel method for inviscid lift slope and zero-lift angle, plus Reynolds-dependent friction drag, a stall estimate and Viterna post-stall extrapolation (−180° to 180°). For higher accuracy, paste XFOIL or wind-tunnel polars instead.',
  '貼上 XFOIL/實測極曲線': 'Paste XFOIL / measured polar', '套用到': 'Apply to', '套用極曲線': 'Apply polar', '改回內建模型': 'Revert to built-in model',
  '顯示翼型': 'Show airfoil', '最大厚度 t/c': 'Max thickness t/c', '最大彎度': 'Max camber', '零升攻角(無黏)': 'Zero-lift angle (inviscid)',
  '升力斜率(無黏)': 'Lift slope (inviscid)', '最大升阻比 @Re 200k': 'Max L/D @ Re 200k', '極曲線來源': 'Polar source', '面板法 + 半經驗修正': 'Panel method + semi-empirical corrections',
  '剖面位置 r/R': 'Section position r/R', '分析尖速比 λ': 'Analysis tip-speed ratio λ', '7.00(設計)': '7.00 (design)', '3.50(設計)': '3.50 (design)', '3.39°(設計)': '3.39° (design)', '8.00°(設計)': '8.00° (design)',
  '設計點 λd': 'Design point λd', '目前運轉點': 'Current operating point', '葉片平面形狀與翼型配置': 'Blade planform and airfoil layout', '· 點選或拖曳選擇剖面': '· click or drag to pick a section',
  '剖面資料': 'Section data', '位置 r': 'Position r', '翼型組合': 'Airfoil blend', '相對厚度 t/c': 'Relative thickness t/c', '扭角 + 槳距 θ': 'Twist + pitch θ', '入流角 φ': 'Inflow angle φ',
  '局部尖速比 λr': 'Local tip-speed ratio λr', '相對風速 W': 'Relative wind speed W', '雷諾數 Re': 'Reynolds number Re', '誘導因子 a / a′': 'Induction factors a / a′', '葉尖損失 F': 'Tip-loss factor F',
  '轉子 Cp(此 λ)': 'Rotor Cp (this λ)', '轉速': 'Rotor speed', '剖面形狀與速度三角形': 'Section shape and velocity triangle', '此剖面的極曲線': 'Polar of this section',
  '剖面疊圖(由葉尖往輪轂看)': 'Section overlay (tip toward hub)', '沿展長的氣動特性變化': 'Aerodynamics along the span', '顯示': 'Show',
  '垂直軸葉片會經歷正負攻角交替,常用對稱翼型(NACA 00xx)。厚翼型失速較緩和、有助於啟動。': 'VAWT blades see alternating positive and negative angles of attack, so symmetric airfoils (NACA 00xx) are common. Thick airfoils stall more gently and help starting.',
  '方位角 θ': 'Azimuth θ', '最佳 λopt': 'Best λopt', '葉片外形(側視)': 'Blade shape (side view)', '俯視:葉片位置與速度三角形': 'Top view: blade position and velocity triangle',
  '局部半徑': 'Local radius', '當地風速 u': 'Local wind speed u', '葉片速度 Ωr': 'Blade speed Ωr', '攻角 α(幾何)': 'Angle of attack α (geometric)', '一圈內攻角範圍': 'AoA range per revolution',
  '估計失速角': 'Est. stall angle', '攻角隨方位角變化(中段剖面)': 'AoA vs azimuth (mid-span section)', '轉矩隨方位角變化': 'Torque vs azimuth', '翼型極曲線(局部雷諾數)': 'Airfoil polar (local Reynolds number)',
  '剖面 r/R': 'Section r/R', '用設計點攻角': 'Use design-point AoA', '流線': 'Streamlines', '翼型剖面流場(面板法位勢流)': 'Airfoil section flow (panel-method potential flow)',
  '翼面壓力分布': 'Surface pressure distribution', '轉子尖速比 λ': 'Rotor tip-speed ratio λ', '設計點': 'Design point', '跟隨目前運轉點': 'Follow operating point',
  '葉尖渦(螺旋尾流)': 'Tip vortices (helical wake)', '自由渦尾流(Biot-Savart 迭代)': 'Free-vortex wake (Biot-Savart iteration)', '轉子流場(致動盤 + BEM 誘導)': 'Rotor flow (actuator disk + BEM induction)',
  '轉子流場(雙重多流管)': 'Rotor flow (double multiple stream tube)', '速度剖面': 'Velocity profile', '模型說明': 'Model notes', '預設 8°': 'Default 8°', '最佳 λ': 'Best λ',
  '翼型剖面:Hess-Smith 面板法(源 + 均勻渦,Kutta 條件)求無黏位勢流,流線以速度場積分。位勢流不含邊界層與分離;分離點由表面速度做 Thwaites(層流)+ Michel 轉捩 + Head(紊流)積分邊界層估計,紅色分離區只是示意,Cl 會高於實際值;實際升阻力請以「極曲線」分頁的黏性修正模型為準。':
    'Airfoil section: Hess-Smith panel method (source + uniform vortex, Kutta condition) for inviscid potential flow; streamlines are integrated from the velocity field. Potential flow has no boundary layer or separation; the separation point is estimated by integrating the boundary layer from surface speed (Thwaites laminar + Michel transition + Head turbulent). The red separated region is illustrative and Cl is higher than real; use the viscous-corrected model in the Polar tab for actual lift and drag.',
  '水平軸轉子:以 BEM 求得各截面軸向誘導因子 a(r),搭配致動盤渦柱理論 u = V∞[1 − a(1 + x/√(x²+R²))] 近似軸向速度,流線由各流管質量守恆求得;尾流旋轉未計入;勾選「葉尖渦」會疊上預設螺旋尾流(依葉尖誘導 a 對流、流管膨脹,實線為近側、灰線為遠側),不是自由渦尾流。':
    'HAWT rotor: BEM gives the axial induction a(r) of each section; actuator-disk vortex-cylinder theory u = V∞[1 − a(1 + x/√(x²+R²))] approximates axial speed, and streamlines follow mass conservation per stream tube. Wake rotation is not included. "Tip vortices" overlays a preset helical wake (convected by tip induction a with stream-tube expansion; solid = near side, grey = far side), not a free-vortex wake.',
  '垂直軸轉子:以雙重多流管法的上、下風誘導速度組合成俯視流場,示意上風半圈先減速、下風葉片再次取能的特性。':
    'VAWT rotor: the top-view flow combines upwind and downwind induced speeds from the double multiple stream tube method, showing the upwind half slowing the flow before downwind blades extract energy again.',
  '研究模式(通用三維線葉片)': 'Research mode (general 3-D line blade)', '部分扭矩係數': 'partial torque coefficient',
  '不是整機 Cp 或效率,不可與 Betz 極限比較': 'not whole-rotor Cp or efficiency; do not compare with the Betz limit',
  '資料': 'Data', '載入內建範例': 'Load built-in example', '匯入葉片 JSON': 'Import blade JSON', '匯出目前葉片 JSON': 'Export current blade JSON', '匯出逐截面 CSV': 'Export per-section CSV',
  '名稱': 'Name', '分支': 'Branches', '分析區間 s': 'Analysis range s', '旋轉複製': 'Rotational copies', '2 份': '2 copies', '說明': 'Notes', '匯入極曲線 JSON': 'Import polar JSON',
  '攻角範圍': 'AoA range', 'Re 範圍': 'Re range', '資料點': 'Data points', '條件': 'Conditions', '工況與修改': 'Operating point and modifications', '積分節點': 'Integration nodes',
  'λ 掃描': 'λ sweep', '軸向折減 a': 'Axial reduction a', '安裝角偏移 Δβ(°)': 'Setting-angle offset Δβ (°)', '線性扭角 s0→s1(°)': 'Linear twist s0→s1 (°)',
  '二次扭角 s1 處(°)': 'Quadratic twist at s1 (°)', '方向': 'Direction', '結果摘要': 'Result summary', '部分 CQ(2 份 × Σ分支 / π)': 'Partial CQ (2 copies × Σbranches / π)', '工況': 'Operating point',
  '最低資料覆蓋率(弧長加權)': 'Min data coverage (arc-length weighted)', 'I(完整窗)': 'I (full window)', 'I(有資料段)': 'I (data-backed part)', '覆蓋率': 'Coverage',
  '缺值段與原因': 'Missing segments and reasons', '無': 'None', '扭角/翼型修改比較:部分 CQ–λ': 'Twist / airfoil modification comparison: partial CQ–λ', '加入比較(目前設定)': 'Add to comparison (current)',
  '清除比較': 'Clear comparison', '匯出 CQ–λ CSV': 'Export CQ–λ CSV', '第一筆為基準;缺完整窗資料的 λ 不畫(不補 0)。': 'First entry is the baseline; λ values lacking full-window data are not plotted (not filled with 0).',
  '方案(λ 6.00)': 'Case (λ 6.00)', '與基準差': 'Diff vs baseline', '最低覆蓋率': 'Min coverage', '定義檔原樣': 'As in definition file',
  '立體': '3-D', '正面': 'Front', '側面': 'Side', '俯視': 'Top', '儀表': 'Gauges', '暫停': 'Pause', '偏航誤差': 'Yaw error', '氣動功率': 'Aerodynamic power', '輸出電力': 'Output power', '轉矩': 'Torque',
  '▾ 收合分析圖表': '▾ Collapse analysis charts', '▸ 展開分析圖表': '▸ Expand analysis charts', '翼型與極曲線': 'Airfoil and polar', '葉片分析': 'Blade analysis', '性能曲線': 'Performance curves',
  '即時監測': 'Live monitor', 'Cp 攻角': 'Cp AoA', '旋轉平面': 'Rotation plane', '葉尖 →': 'Tip →', '升力 L': 'Lift L', '阻力 D ×10': 'Drag D ×10', '上表面 −Cp': 'Upper surface −Cp', '下表面 −Cp': 'Lower surface −Cp',
  'α 設計點': 'α design point', '風 ↓(軸向)   葉片運動 →(切向)': 'Wind ↓ (axial)   Blade motion → (tangential)',
  '綠:當地風速 u   橘:葉片速度 Ωr   藍:相對風速 W': 'Green: local wind u   Orange: blade speed Ωr   Blue: relative wind W',
  '上風半圈先減速一次,下風葉片在已減速的氣流中再取一次能量': 'Upwind half slows the flow once; downwind blades extract energy again from the slowed flow',
  '⚠ 已接近或超過失速:紅色為邊界層積分估計的分離區(示意),位勢流結果不再可靠': '⚠ At or beyond stall: red marks the separated region estimated by boundary-layer integration (illustrative); potential-flow results are no longer reliable',
  '注意:攻角偏大,後段邊界層開始分離': 'Note: AoA is large; the aft boundary layer starts to separate',
  '匯入外形(STL)轉子': 'Imported-shape (STL) rotor', '阿基米德螺旋轉子': 'Archimedean spiral rotor', '自訂性能曲線轉子': 'Custom performance-curve rotor', 'Savonius 阻力型轉子': 'Savonius drag-type rotor',
  '俯視幾何': 'Top-view geometry',
});
Object.assign(FR, {
  '上表面': 'Upper surface', '下表面': 'Lower surface', '攻角 α': 'Angle of attack α', '設計點': 'design point', '面板': 'panels',
  '站 ': 'Stn ', '65 站': '65 stations', '2412 鏡射': '2412 mirrored', '鏡射 NACA 2412': 'mirrored NACA 2412',
  '壓力分布(無黏,': 'pressure distribution (inviscid, ', '升力與阻力係數': 'Lift and drag coefficients', ';虛線為其他 Re 的 Cl': '; dashed: Cl at other Re', '設計點': 'design point',
  '升阻比 Cl/Cd,最佳': 'L/D (Cl/Cd), best', '弦向放大': 'Chord exaggeration', '顏色:相對厚度': 'color: thickness', '(淺)': ' (light)', '(深)': ' (dark)', '虛線:變槳軸': 'dashed: pitch axis', '% 弦長)': '% chord)',
  ' 個剖面,': ' sections, ', '紫(根部)→ 藍(葉尖);': 'purple (root) → blue (tip); ', '黃色為選取剖面': 'yellow = selected section', '黑點為變槳軸': 'black dot = pitch axis',
  '位勢流 Cl': 'potential-flow Cl', '估計失速角': 'Est. stall angle', '失速角': 'Stall angle', '轉捩': 'transition', '無分離': 'no separation', '分離': 'separation', '−Cp 分布': '−Cp distribution',
  '側視子午面流場': 'Side-view meridional flow', '平均軸向誘導': 'Mean axial induction', '轉子處': 'at rotor', '遠尾流': 'far wake', '扭矩密度': 'Torque density', '(力 + Cm;單位': ' (force + Cm; unit', '單位': 'unit', '每份': 'per copy',
  '選取高度': 'Selected height', '局部半徑': 'Local radius', '當地風速': 'local wind speed', '葉片速度': 'blade speed', '相對風速': 'relative wind speed', '綠': 'green', '橘': 'orange', '藍': 'blue',
  '攻角 vs 方位角': 'AoA vs azimuth', '攻角偏大': 'AoA is large', '注意': 'Note', '俯視流管速度(雙重多流管)': 'Top-view stream-tube speed (double multiple stream tube)',
  ';自訂外形:此為赤道截面,傾角 > 60° 的高度占': '; custom shape: equatorial section, height fraction with tilt > 60°: ', '(只計阻力)': ' (drag only)',
  '(上風半圈)': ' (upwind half)', '(下風半圈)': ' (downwind half)', '(設計)': ' (design)', '(V = 8)': ' (V = 8)',
  '轉矩 vs 方位角': 'Torque vs azimuth', '轉子總轉矩': 'Total rotor torque', '單葉片': 'Single blade',
  ':逐截面攻角、局部 Re、力與四分之一弦力偶,沿實體弧長積分成': ': per-section AoA, local Re, force and quarter-chord moment, integrated along the physical arc length into the ',
  '(分母 q∞πR³)。': ' (denominator q∞πR³). ',
  '不含誘導/尾流(a 只是指定的軸向折減情境)、翼根/翼尖/橋接/輪轂、分支間干涉與三維修正;': 'It excludes induction/wake (a is only a prescribed axial-reduction scenario), root/tip/bridges/hub, inter-branch interference and 3-D corrections; ',
  '。極曲線為匯入資料(範例為 XFOIL 二維計算,不是量測);超出資料範圍一律標為缺值,不外插、不補 0。說明見 docs/LINE3D.md。': '. Polars are imported data (the example is 2-D XFOIL, not measurement); anything outside the data range is marked missing, never extrapolated or filled with 0. See docs/LINE3D.md.',
  '內建範例': 'Built-in example', '回翼閉合葉片 v0.2 中心線 + candidate146 扭角': 'Return-wing closed blade v0.2 centerline + candidate146 twist', 'Work(65 站,': 'Work (65 stations, ', 'Return(65 站,': 'Return (65 stations, ',
  '診斷用:只含 s 0.1–0.9 的工作翼與回翼;不含翼根、翼尖、橋接與輪轂。兩組相隔 180°(copies 2)。長度以 R 為單位,beta 為截面安裝角(度)。': 'Diagnostic: only the work and return wings for s 0.1–0.9; no root, tip, bridges or hub. The two copies are 180° apart (copies 2). Lengths are in units of R; beta is the section setting angle (deg).',
  ' 有效 / ': ' valid / ', '(無效點保留為缺值)': ' (invalid points kept as missing)', '2 份': '2 copies', ' · 力 + Cm · ': ' · force + Cm · ', ' 節點': ' nodes',
  'I 為單一分支 ∫(x × F̂ + M̂)': 'I is one branch ∫(x × F̂ + M̂)', ';「有資料段」只是支撐子區的值,不能當成完整結果。端點/中點檢查不保證區間內沒有更窄的缺口。': '; the "data-backed part" is only the supported sub-range value and must not be read as the full result. Endpoint/midpoint checks do not guarantee there is no narrower gap inside the interval.',
  '沿弧長分佈(實線有資料;紅色底色為缺值區間,紅色虛線為缺值段的攻角/Re)': 'Distribution along arc length (solid = data; red shading = missing interval, red dashed = AoA/Re over missing segments)',
  '目前設定缺值的 λ:': 'λ values missing for the current setup: ', '比較表取掃描格點中最接近目前 λ 者;掃描用 161 節點以加快速度,與摘要的 321 節點略有差異。': 'The comparison table uses the sweep grid point nearest the current λ; the sweep uses 161 nodes for speed, so it differs slightly from the 321-node summary.',
  'a 為指定的純軸向速度折減(W = (1−a)e': 'a is a prescribed pure axial speed reduction (W = (1−a)e',
  '×x),不是由誘導模型算出。Δβ 加在定義檔的安裝角上;線性/二次扭角以分支弧長正規化(u=0 在起點,u=1 在終點),線性項加 u×值、二次項加 u²×值;翼型改動套用整支分支。': '×x), not computed by an induction model. Δβ is added to the setting angle in the definition file; linear/quadratic twist is normalized by branch arc length (u=0 at start, u=1 at end), the linear term adds u×value and the quadratic term u²×value; an airfoil change applies to the whole branch.',
  '水平軸 ': 'HAWT, ', '垂直軸 ': 'VAWT, ', ' 葉': ' blades', ',R ': ', R ', '可信度 中高': 'Confidence: medium-high', '可信度 中低': 'Confidence: medium-low', '可信度 中': 'Confidence: medium', '可信度': 'Confidence',
  'BEM 扭角': 'BEM twist', 'Schmitz 扭角': 'Schmitz twist', '線性扭角': 'linear twist', ',3 葉,': ', 3 blades, ', ',3 葉': ', 3 blades',
  'BEM + 半經驗極曲線': 'BEM + semi-empirical polars', 'DMST,未含動態失速': 'DMST, no dynamic stall',
  'H 型(直葉片)': 'H-type (straight blades)', '、': ', ', '。': '. ',
});

// EN-5: report workspace (generated report body is translated with trHtml → tr).
Object.assign(FR, {
  '功率曲線測試': 'Power-curve test', '偏航測試': 'Yaw test', '紊流測試 TI 15%': 'Turbulence test TI 15%', '陣風測試': 'Gust test', '啟動測試': 'Start-up test',
  '設計尖速比 λd = ': 'Design tip-speed ratio λd = ', ' 時 Cp = ': ' gives Cp = ', ',比最佳值 ': ', below the optimum ', ')低;可將設計尖速比調向 ': ') ; consider moving the design tip-speed ratio toward ',
  ',或讓 MPPT 追蹤 λopt。': ', or let the MPPT track λopt. ', '設計點 Cp ': 'Design-point Cp ', '已接近本轉子的最佳值,扭角與弦長分布與設計尖速比匹配良好。': 'is close to the best for this rotor; twist and chord distributions match the design tip-speed ratio well. ',
  '在 12 m/s 以最佳尖速比運轉時葉尖速度約 ': 'At 12 m/s and optimal tip-speed ratio the tip speed is about ', ' m/s,超過 70 m/s 容易產生明顯噪音,住宅區使用建議降低設計尖速比或設定轉速上限。': ' m/s; above 70 m/s noise is likely audible, so for residential sites lower the design tip-speed ratio or set a speed limit. ',
  '根部翼型相對厚度僅 ': 'Root airfoil thickness is only ', '%,根部彎矩最大,建議改用 t/c ≥ 18–21% 的翼型或加厚根部結構。': '% while the root bending moment is largest; use an airfoil with t/c ≥ 18–21% or thicken the root structure. ',
  '目前採用線性扭角,部分截面偏離最佳攻角;若製造允許,可比較「BEM 數值最佳化」扭角的 Cp 差異(方案比較分頁)。': 'Linear twist is used and some sections deviate from the optimal angle of attack; if manufacturing allows, compare the Cp of "BEM numerical optimization" twist (Design comparison tab). ',
  '設計點最大攻角約 ': 'Maximum design-point angle of attack is about ', '°,靠近失速,低風速或陣風時可能提早失速。': '°, close to stall; stall may occur early in low wind or gusts. ',
  '實度 Bc/R = ': 'Solidity Bc/R = ', ';最佳尖速比 ': '; optimal tip-speed ratio ', '、Cp,max ': ', Cp,max ', '。實度越高最佳尖速比越低、啟動越容易但最高效率下降。': '. Higher solidity lowers the optimal tip-speed ratio and eases start-up but reduces peak efficiency. ',
  '自訂外形有約 ': 'The custom shape has about ', '% 的葉片高度傾角超過 60°(接近水平的橫段),DMST 在這些段只計阻力、不產生轉矩,此外形的 Cp 可信度較低,建議以風洞實驗或 CFD 驗證。': '% of blade height tilted beyond 60° (nearly horizontal segments); DMST counts only drag there and produces no torque, so Cp confidence is low. Verify with wind-tunnel tests or CFD. ',
  '自訂外形沒有傾角超過 60° 的葉片段;DMST 仍未含流線彎曲與動態失速,傾角較大處的 Cp 偏樂觀。': 'The custom shape has no blade segments tilted beyond 60°; DMST still omits streamline curvature and dynamic stall, so Cp is optimistic where tilt is large. ',
  ' m/s 區間實測輸出達理想 MPPT 的 ': ' m/s the measured output reaches ', ' m/s 區間實測輸出只有理想 MPPT 的 ': ' m/s the measured output is only ', '%,追蹤效果良好。': '% of ideal MPPT; tracking is good. ',
  '%;可嘗試最佳尖速比/最佳轉矩控制,或調整 P&O 擾動步長與週期。': '% of ideal MPPT; try optimal tip-speed-ratio / optimal-torque control, or tune the P&O step and period. ',
  '已啟用側偏收尾:': 'Furling enabled: ', ' m/s 起機艙開始側偏,最高測試風速 ': ' m/s the nacelle starts yawing away; at the highest test speed ', ' m/s 時平均側偏角約 ': ' m/s the mean furl angle is about ', '°(上限 ': '° (limit ', '°),輸出功率 ': '°), output power ', '(發電機額定 ': ' (generator rated ',
  ');為簡化模型,不含尾翼力矩與被動收尾遲滯。': '); simplified model without tail-vane moment or passive-furl hysteresis. ', '已啟用側偏收尾(啟動風速 ': 'Furling enabled (onset speed ', ' m/s),但測試風速範圍內未達到側偏條件。': ' m/s) but the furling condition is not reached within the tested range. ',
  '已啟用主動變槳:': 'Active pitch enabled: ', ' m/s 起槳距開始順槳,最高測試風速 ': ' m/s the blades start feathering; at the highest test speed ', ' m/s 時穩態槳距約 ': ' m/s the steady pitch is about ', ');變槳取代降轉速軟失速,額定以上轉速維持在額定轉速。': '); pitch replaces speed-reduction soft stall and speed stays at rated above rated wind. ',
  '風速 ': 'Above wind speed ', ' m/s 以上,轉子氣動功率超過發電機額定(': ' m/s the rotor aerodynamic power exceeds the generator rating (', '),定槳距轉子即使降轉速進入失速仍無法把功率壓在額定內,多次觸發過速/過功率保護。': '); a fixed-pitch rotor cannot hold power within rating even when slowed into stall, so overspeed/overpower protection trips repeatedly. ',
  '目前已啟用切出風速停機(': 'Cut-out shutdown is enabled (', ' m/s),可避免在額定風速以上反覆觸發保護,測試風速已延伸至 ': ' m/s), avoiding repeated protection trips above rated wind; test speeds are extended to ', ' m/s 以涵蓋切出風速,功率曲線在切出後降為 0;仍建議依實際場址風況調整切出/重啟風速。': ' m/s to cover cut-out and the power curve drops to 0 after cut-out; still adjust cut-out/restart speeds to the actual site. ',
  '可在「負載→保護」啟用切出風速停機來避免反覆觸發,或加入側偏收尾(furling)、變槳機構;若場址常有高風速,也可加大發電機額定。': 'Enable cut-out shutdown under "Load → Protection" to avoid repeated trips, or add furling / a pitch mechanism; for high-wind sites also consider a larger generator rating. ',
  '測試風速範圍(至 ': 'No protection trip within the tested range (up to ', ' m/s)內未觸發保護,發電機額定 ': ' m/s); the generator rating ', ' 足以涵蓋此轉子。': ' is sufficient for this rotor. ',
  '實測切入風速約 ': 'Measured cut-in wind speed is about ', ' m/s(輸出 ': ' m/s (output ', '啟動測試中 ': 'In the start-up test, ',
  ' 無法在 60 秒內自行起轉到 λopt 的一半,需要馬達輔助啟動、增加實度或改用混合 Savonius 啟動器。': ' cannot self-start to half of λopt within 60 s; use motor-assisted start, increase solidity, or add a hybrid Savonius starter. ',
  '在 4、6、8 m/s 皆能自行啟動,達到半最佳轉速時間分別為 ': 'Self-starts at 4, 6 and 8 m/s; time to half optimal speed: ', '陣風測試觸發保護煞車,代表轉速或功率餘裕不足;可提高發電機額定或轉速上限。': 'The gust test triggered the protection brake, indicating insufficient speed or power margin; raise the generator rating or speed limit. ',
  '葉根疲勞壽命估計只有約 ': 'Estimated root fatigue life is only about ', ' 年(8 m/s、紊流 15% 連續運轉),低於常用的 20 年設計壽命;可改用強度較高的材料、加大根部弦長或厚度,或降低設計尖速比以減少推力。': ' years (continuous 8 m/s, 15% turbulence), below the usual 20-year design life; use a stronger material, enlarge root chord or thickness, or lower the design tip-speed ratio to reduce thrust. ',
  ';轉子慣量越大功率越平順但追蹤越慢。': '; larger rotor inertia smooths power but slows tracking. ', '紊流 15% 下平均輸出 ': 'At 15% turbulence the mean output is ', ',功率標準差 ': ', power standard deviation ',
  '葉水平軸風力機 R': '-blade HAWT, R', '設計規劃與虛擬風洞測試報告': 'Design planning and virtual wind-tunnel test report', ' · 由風力機葉片設計工具產生': ' · generated by the wind-turbine blade design tool',
  '最大功率係數 Cp': 'Max power coefficient Cp', '最佳尖速比': 'Optimal tip-speed ratio', '氣動功率 @ ': 'Aerodynamic power @ ', '年發電量 kWh(理想,Weibull 年均 ': 'Annual energy kWh (ideal, Weibull mean ', ' m/s、k=': ' m/s, k=',
  '容量因數(對發電機額定 ': 'Capacity factor (vs generator rating ', '模型可信度:': 'Model confidence: ', '極曲線資料來源:': 'Polar data source: ', '設計目標:': 'Design goal: ', '設計條件': 'Design conditions',
  '型式': 'Type', '水平軸': 'HAWT', '垂直軸': 'VAWT', '轉子半徑 / 輪轂半徑': 'Rotor radius / hub radius', '掃掠面積': 'Swept area', '設計風速 / 設計尖速比': 'Design wind speed / tip-speed ratio', '扭角設計方式': 'Twist design method',
  '數值最佳化': 'numerical optimization', '解析解': 'analytic', '線性': 'linear', '槳距角': 'Pitch angle', '材料 / 單葉質量': 'Material / mass per blade', '空氣條件': 'Air conditions', '海拔': 'altitude',
  '負載': 'Load', '電池充電': 'Battery charging', '(升降壓轉換器)': ' (buck-boost converter)', '電阻負載': 'Resistive load', '控制': 'Control', '擾動觀察法': 'Perturb & observe', '最佳尖速比控制': 'Optimal tip-speed-ratio control',
  '最佳轉矩控制': 'Optimal-torque control', '最佳轉矩': 'Optimal torque', '固定占空比': 'Fixed duty cycle', '發電機': 'Generator', ',額定 ': ', rated ', ',轉速上限 ': ', speed limit ',
  '噪音估計(設計點,葉尖速度法)': 'Noise estimate (design point, tip-speed method)', '葉尖速度 ': 'Tip speed ', ' m/s,聲功率級約 ': ' m/s, sound power level about ', ' m 處約 ': ' m about ',
  '(經驗式,誤差約 ±5 dB,不含音調/調幅噪音)': ' (empirical, error about ±5 dB, excludes tonal/amplitude-modulated noise)', '後緣自噪音(BPM 頻譜)': 'Trailing-edge self-noise (BPM spectrum)', '、未加權 ': ', unweighted ',
  '(改用邊界層積分 δ* 交叉驗證:': ' (cross-check with boundary-layer integral δ*: ', ';1/3 八度頻帶加總,僅含紊流邊界層後緣自噪音,不含入流紊流/鈍後緣噪音;只適合設計間相對比較,絕對值誤差可達 ±5 dB 以上)': '; 1/3-octave sum, turbulent-boundary-layer trailing-edge self-noise only, excluding inflow-turbulence and blunt-trailing-edge noise; suited to relative comparison between designs, absolute error can exceed ±5 dB)',
  '葉尖渦噪音(BPM)': 'Tip-vortex noise (BPM)', '(葉尖攻角 ': ' (tip angle of attack ', ';與後緣自噪音能量相加約 ': '; energy-summed with trailing-edge noise about ', ';圓弧葉尖經驗式、未含葉尖形狀差異,僅供相對比較)': '; rounded-tip empirical formula, tip-shape differences not included, for relative comparison only)',
  '成本與 LCOE 粗估': 'Cost and LCOE estimate', '葉片/轉子材料約 NT$ ': 'Blade/rotor material about NT$ ', '、發電機與電控約 NT$ ': ', generator and electronics about NT$ ', '、塔架基礎約 NT$ ': ', tower and foundation about NT$ ', ',合計 NT$ ': ', total NT$ ',
  ';以年固定費率 ': '; with annual fixed charge rate ', ' 維運 ': ' O&M ', ' 估算,LCOE 約 NT$ ': ' the LCOE is about NT$ ', '(以理想年發電量計,單價為概念性假設': ' (based on ideal annual energy; unit prices are conceptual assumptions',
  '已套用使用者自訂單價': 'User-defined unit prices applied', '側偏收尾': 'Furling', ' m/s 起側偏,上限 ': ' m/s onset, limit ', ',速率 ': ', rate ', '切出/重啟風速': 'Cut-out / restart speed', ' m/s(1 秒低通平均風速,含遲滯)': ' m/s (1 s low-pass mean wind, with hysteresis)',
  '後緣自噪音 1/3 八度頻譜(': 'Trailing-edge self-noise 1/3-octave spectrum (', '未加權 dB': 'unweighted dB', '加權 dB(A)': 'weighted dB(A)', '頻率 (Hz)': 'Frequency (Hz)', '圖:BPM 後緣自噪音頻譜(設計點;僅設計間相對比較)': 'Fig.: BPM trailing-edge self-noise spectrum (design point; relative comparison only)',
  '翼型選擇與極曲線': 'Airfoil selection and polars', '站': 'Stn', '位置': 'Position', '翼型': 'Airfoil', '設計 Re': 'Design Re', '最大升阻比': 'Max L/D', '最佳攻角': 'Best AoA',
  '升力係數 Cl–α(各站設計雷諾數)': 'Lift coefficient Cl–α (design Reynolds number per station)', '攻角 α (°)': 'Angle of attack α (°)', '升阻比 L/D–α': 'L/D–α', '圖:各翼型升力曲線': 'Fig.: Lift curves per airfoil', '圖:各翼型升阻比': 'Fig.: L/D per airfoil',
  '葉片幾何': 'Blade geometry', '轉子幾何': 'Rotor geometry', '圖:葉片平面形狀(弦向放大)與翼型站位置,顏色代表相對厚度': 'Fig.: Blade planform (chord exaggerated) and airfoil stations; color = relative thickness', '圖:剖面疊圖(由葉尖往輪轂看)': 'Fig.: Section overlay (viewed from tip toward hub)',
  '弦長與扭角分布': 'Chord and twist distribution', '圖:弦長與扭角': 'Fig.: Chord and twist', '弦長 (mm)': 'Chord (mm)', '扭角 (°)': 'Twist (°)', '翼型組合': 'Airfoil mix', '設計 α (°)': 'Design α (°)',
  '設計點氣動分析': 'Design-point aerodynamic analysis', '設計點 λd = ': 'Design point λd = ', '、V = ': ', V = ', ',轉速 ': ', speed ', ',推力 ': ', thrust ', ',轉矩 ': ', torque ',
  '圖:攻角分布(實際 vs 最佳升阻比)': 'Fig.: Angle-of-attack distribution (actual vs best L/D)', '圖:升阻比分布': 'Fig.: L/D distribution', '圖:推力與轉矩分布': 'Fig.: Thrust and torque distribution', '圖:誘導因子與葉尖損失': 'Fig.: Induction factors and tip loss',
  '攻角 vs 方位角(λ': 'AoA vs azimuth (λ', '方位角 (°)': 'Azimuth (°)', '圖:中段剖面攻角變化(灰區為下風半圈)': 'Fig.: Mid-span section AoA variation (grey = downwind half)', '轉矩 vs 方位角(8 m/s)': 'Torque vs azimuth (8 m/s)', '總轉矩': 'Total torque', '單葉': 'Single blade', '圖:轉矩漣波': 'Fig.: Torque ripple',
  '葉片結構(設計點與極端風速)': 'Blade structure (design point and extreme wind)', '材料': 'Material', ',容許應力 ': ', allowable stress ', '根部彎矩(揮舞 / 擺振)': 'Root bending moment (flap / edge)', '根部離心軸力': 'Root centrifugal force',
  '設計點最小安全係數': 'Design-point minimum safety factor', '設計點葉尖揮舞撓度': 'Design-point tip flap deflection', '% 半徑)': '% of radius)', '極端風速停機工況最小安全係數': 'Extreme-wind parked minimum safety factor', '截面積 (mm²)': 'Section area (mm²)', '應力 (MPa)': 'Stress (MPa)', '安全係數': 'Safety factor',
  '疲勞(葉根,雨流計數 + Miner 法則)': 'Fatigue (blade root, rainflow counting + Miner rule)', '取紊流測試(平均風速 8 m/s、紊流強度 15%)': 'Taking the turbulence test (mean wind 8 m/s, turbulence intensity 15%), ',
  ' 秒的葉根應力時間序列(推力揮舞 + 氣動轉矩擺振 + 離心力 + 每轉一次的重力擺振),以 ASTM E1049 雨流計數得到 ': ' s root-stress time series (thrust flap + aerodynamic-torque edge + centrifugal + once-per-rev gravity edge), ASTM E1049 rainflow counting gives ',
  ' 個循環,最大應力範圍 ': ' cycles, maximum stress range ', ',1 Hz 等效應力範圍 ': ', 1 Hz equivalent stress range ', '以 Basquin S-N 曲線(極限強度 ': 'Miner damage is computed with a Basquin S-N curve (ultimate strength ', ',斜率 m = ': ', slope m = ', '、斜率 m = ': ', slope m = ',
  ')與 Goodman 平均應力修正計算 Miner 損傷,若長期都在此工況運轉,估計疲勞壽命': ') and Goodman mean-stress correction; if operated long-term in this condition, the estimated fatigue life is ', '小型風機常用設計壽命 20 年)': 'typical small-turbine design life 20 years)', '年': ' years',
  '葉根應力時間序列(前 5 秒)': 'Root-stress time series (first 5 s)', '葉根應力 (MPa)': 'Root stress (MPa)', '時間 (s)': 'Time (s)', '圖:紊流測試中的葉根應力': 'Fig.: Root stress during the turbulence test',
  '執行虛擬風洞自動測試後,這一節會加入以紊流測試應力時間序列做雨流計數的疲勞壽命估計。': 'After running the virtual wind-tunnel tests, this section adds a fatigue-life estimate from rainflow counting of the turbulence-test stress series. ',
  '結構為單一等效殼截面的懸臂梁模型:只含揮舞/擺振彎曲與離心軸力的保守相加,無扭轉、屈曲與分項安全係數;疲勞只取單一風況、S-N 參數為材料典型值,壽命估計的數量級比絕對值更有意義;安全係數低於 1.5 以紅色標示,僅供概念設計參考。': 'The structure is a cantilever model with a single equivalent shell section: flap/edge bending and centrifugal force are added conservatively; no torsion, buckling or partial safety factors. Fatigue uses a single wind condition and typical S-N parameters, so the order of magnitude matters more than the absolute value. Safety factors below 1.5 are shown in red; for concept design only. ',
  '轉子性能預測': 'Rotor performance prediction', '尖速比 λ': 'Tip-speed ratio λ', '理想 MPPT(限額定)': 'Ideal MPPT (capped at rated)', '虛擬風洞實測': 'Virtual wind-tunnel measured', '固定 D': 'Fixed D', '功率曲線': 'Power curve', '風速 (m/s)': 'Wind speed (m/s)', '電功率 (W)': 'Electrical power (W)',
  '圖:功率係數與推力係數': 'Fig.: Power and thrust coefficients', '圖:功率曲線(預測與實測)': 'Fig.: Power curve (predicted and measured)', '虛擬風洞測試結果': 'Virtual wind-tunnel test results', '穩態功率曲線測試': 'Steady-state power-curve test',
  '紊流 0%、自動對風,每個風速模擬 ': 'Turbulence 0%, auto yaw-alignment, each wind speed simulated for ', ' 秒並取後段平均;控制策略:': ' s with the late-window average; control strategy: ', '轉速 (rpm)': 'Speed (rpm)', '實測': 'Measured', '氣動功率': 'Aerodynamic power', '輸出電功率': 'Output electrical power',
  '系統效率': 'System efficiency', '理想 MPPT': 'Ideal MPPT', '追蹤率': 'Tracking ratio', '占空比': 'Duty cycle', '槳距': 'Pitch', '側偏角': 'Furl angle', '⚠保護 ': '⚠ protection ', ' 次': ' times', '偏航誤差測試(8 m/s)': 'Yaw-error test (8 m/s)', '偏航誤差': 'Yaw error', '相對 0°': 'Relative to 0°', '參考': 'reference',
  '紊流與陣風測試': 'Turbulence and gust test', '平均風速 8 m/s、紊流強度 15%:平均輸出 ': 'Mean wind 8 m/s, turbulence intensity 15%: mean output ', ',標準差 ': ', standard deviation ', ',平均系統效率 ': ', mean system efficiency ', ',最高轉速 ': ', peak speed ', '陣風(6 秒內增加 45%)下最高轉速 ': 'Under the gust (+45% within 6 s) peak speed ',
  '(穩態 ': ' (steady ', ')、最高輸出 ': '), peak output ', '觸發保護煞車': 'protection brake triggered', '未觸發保護': 'no protection trip', '紊流測試時間序列': 'Turbulence-test time series', '輸出 (W)': 'Output (W)', '陣風響應': 'Gust response', '圖:紊流下的風速與輸出功率': 'Fig.: Wind speed and output power under turbulence', '圖:陣風下的轉速與功率': 'Fig.: Speed and power under gust',
  '達到 ½·λopt 所需時間': 'Time to reach ½·λopt', ' 秒後 λ': ' s λ', ' 秒後轉速': ' s speed', '未能自行啟動': 'Did not self-start', '靜止起轉過程': 'Spin-up from rest', '圖:由靜止起轉的轉速變化': 'Fig.: Speed during spin-up from rest', '流場分析': 'Flow analysis', '圖:': 'Fig.: ', '剖面': ' section', ' 在設計攻角下的位勢流速度場與流線': ' potential-flow velocity field and streamlines at design AoA',
  '圖:設計點轉子子午面軸向速度與流管擴張': 'Fig.: Design-point rotor meridional axial velocity and stream-tube expansion', '圖:最佳尖速比下的俯視流管速度': 'Fig.: Top-view stream-tube speed at optimal tip-speed ratio', '方案比較': 'Design comparison', '方案': 'Design', '高效區 λ': 'High-efficiency λ', '–λ 比較': '–λ comparison', '圖:各方案功率係數': 'Fig.: Power coefficient per design',
  '結論與建議': 'Conclusions and recommendations', '模型說明與限制': 'Model notes and limitations',
  '翼型極曲線:Hess-Smith 面板法求無黏升力斜率與零升攻角,加上雷諾數相依摩擦阻力、失速估算與 Viterna 失速後外推;精度低於 XFOIL 或風洞實測,可在工具中匯入極曲線取代;匯入資料只在其攻角範圍內使用,範圍外仍由此模型外推,且工具不驗證匯入資料的品質(實驗或 XFOIL 皆然)。': 'Airfoil polars: Hess-Smith panel method for inviscid lift slope and zero-lift angle, plus Reynolds-dependent friction drag, a stall estimate and Viterna post-stall extrapolation; less accurate than XFOIL or wind-tunnel data, and imported polars can replace it. Imported data is used only within its AoA range; outside it the model extrapolates, and the tool does not validate imported data quality (experiment or XFOIL alike). ',
  '水平軸:葉片元素動量理論(BEM),含 Prandtl 葉尖/輪轂損失與 Buhl 高誘導修正;偏航以分區方位角計算。': 'HAWT: blade-element momentum theory (BEM) with Prandtl tip/hub loss and Buhl high-induction correction; yaw is computed by azimuth sectors. ',
  '垂直軸:雙重多流管法(DMST),含展弦比修正與支撐臂阻力,未含動態失速與流線彎曲,高尖速比結果偏樂觀。Savonius 為經驗曲線。': 'VAWT: double multiple stream tube (DMST) with aspect-ratio correction and support-arm drag; no dynamic stall or streamline curvature, so high tip-speed-ratio results are optimistic. Savonius uses an empirical curve. ',
  '本設計的性能來源為「匯入曲線(使用者提供)」': 'This design\'s performance comes from an "imported curve (user-provided)"', '本工具不計算此轉子的氣動性能,Cp–λ 的準確度完全取決於資料來源(論文、CFD 或實驗),所有發電量與控制結果都以該曲線為前提。': 'This tool does not compute the aerodynamics of this rotor; the accuracy of Cp–λ depends entirely on the data source (paper, CFD or experiment), and all energy and control results assume that curve. ',
  '目前載入的是內建「示意」曲線(非實測),請先換成自己的資料再引用結果。': 'The built-in "illustrative" curve (not measured) is loaded; replace it with your own data before citing results. ',
  '電氣系統:永磁發電機 + 整流 + 升降壓轉換器的準穩態模型;虛擬風洞測試為時域模擬,不含結構振動、塔影與地面邊界層。': 'Electrical system: quasi-steady model of a permanent-magnet generator + rectifier + buck-boost converter; the virtual wind-tunnel tests are time-domain simulations without structural vibration, tower shadow or ground boundary layer. ',
  '本報告數值適合概念設計與方案比較;製造前建議以 CFD 或實體風洞驗證。': 'Values in this report suit concept design and design comparison; verify with CFD or a physical wind tunnel before manufacturing. ',
  '設計規劃與測試報告': 'Design planning and test report', '設計與測試報告': 'Design and test report',
  '報告會彙整目前的設計條件、翼型配置、葉片幾何表、氣動分析、性能曲線、方案比較與流場圖,並可在虛擬風洞中自動執行功率曲線、偏航、紊流/陣風與啟動測試(約需 10–40 秒)。產生後可下載成 HTML 檔,用瀏覽器開啟後可列印或另存成 PDF。': 'The report compiles the current design conditions, airfoil layout, blade geometry table, aerodynamic analysis, performance curves, design comparison and flow plots, and can automatically run power-curve, yaw, turbulence/gust and start-up tests in the virtual wind tunnel (about 10–40 s). Download it as an HTML file, then open it in a browser to print or save as PDF. ',
  '平均風速': 'mean wind speed', '計算:': 'Computed by: ', '葉片元素動量理論': 'blade-element momentum theory', '內建半經驗極曲線': 'built-in semi-empirical polars', '雙重多流管': 'double multiple stream tube', '中高:': 'Medium-high: ', '中:': 'Medium: ',
  '玻纖複合材': 'Fiberglass composite', '空心殼': 'hollow shell', '木材(實心)': 'Wood (solid)', '鋁擠型(空心)': 'Extruded aluminium (hollow)', '3D 列印 PLA(30% 填充)': '3D-printed PLA (30% infill)', '碳纖複合材': 'Carbon-fiber composite',
  '半徑 / 高度': 'Radius / height', '弦長 / ': 'Chord / ', '實度 Bc/R': 'Solidity Bc/R', '的位勢流速度場與流線': ': potential-flow velocity field and streamlines', '在設計攻角下': ' at design AoA', '設計攻角': 'design AoA',
  '葉尖': 'tip', '葉根': 'root', '葉片': 'blade', '轉子': 'rotor', '水平軸風力機': 'HAWT', '風力機': 'wind turbine', '設計': 'design', '葉': ' blades',
});
Object.assign(EN, {
  '設計規劃與測試報告': 'Design planning and test report', '專案名稱': 'Project name', '設計者': 'Designer', '設計目標': 'Design goal', '姓名或單位': 'Name or organization',
  '例:社區示範 1 kW 小型風機': 'e.g. Community demo 1 kW small turbine', '例:年均風速 5.5 m/s 的屋頂場址,48 V 電池充電,希望低噪音': 'e.g. Rooftop site with 5.5 m/s mean wind, 48 V battery charging, low noise wanted',
  '執行虛擬風洞測試(功率曲線、偏航、紊流/陣風、啟動)': 'Run virtual wind-tunnel tests (power curve, yaw, turbulence/gust, start-up)', '包含流場分析圖': 'Include flow-analysis plots', '包含方案比較(若已儲存方案)': 'Include design comparison (if designs are saved)',
  '產生報告': 'Generate report', '重新產生報告': 'Regenerate report', '產生中…': 'Generating…', '下載報告 HTML': 'Download report HTML', '列印 / 另存 PDF': 'Print / save as PDF', '報告預覽': 'Report preview', '繪製圖表與排版…': 'Rendering charts and layout…',
  '設計已變更,報告內容可能已過時,請重新產生。': 'The design has changed; the report may be outdated. Please regenerate it.',
  '若沒有開始下載,請改用「列印 / 另存 PDF」': 'If the download does not start, use "Print / save as PDF"', '此環境無法下載,請改用「列印 / 另存 PDF」': 'Downloads are unavailable here; use "Print / save as PDF"',
  '此環境無法列印,請下載 HTML 後用瀏覽器列印': 'Printing is unavailable here; download the HTML and print it from a browser',
});
Object.assign(FR, { '已產生(': 'Generated (', ')。設計若再修改,請重新產生報告。': '). If the design changes again, regenerate the report. ', '產生失敗:': 'Generation failed: ' });
