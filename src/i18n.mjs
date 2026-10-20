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

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('wt-lang', lang); } catch (e) {}
  applyI18n();
}
