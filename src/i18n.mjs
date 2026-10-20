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
    if (k && EN[k]) n.nodeValue = n.nodeValue.replace(k, EN[k]);
  }
  root.querySelectorAll('[aria-label],[data-g]').forEach(el => {
    const a = el.getAttribute('aria-label');
    if (a && EN[a]) el.setAttribute('aria-label', EN[a]);
  });
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('wt-lang', lang); } catch (e) {}
  applyI18n();
}
