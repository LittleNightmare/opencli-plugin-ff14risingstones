import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'ff14risingstones.web.sdo.com';
const VIEWS = new Set(['summary', 'detail', 'routes']);
const DEEP_DUNGEON_TYPES = new Set(['dd1', 'dd2', 'dd3', 'dd4']);

const STATISTICS = [
  ['frontline', '战场数据', '#/statistics/frontline'],
  ['ultimate', '绝境战数据', '#/statistics/ultimate'],
  ['fishing', '钓鱼数据', '#/statistics/fishing'],
  ['savage', '零式数据', '#/statistics/savage'],
  ['glamour', '幻化/武具投影数据', '#/statistics/glamour'],
  ['occult', '蜃景幻界数据', '#/statistics/occult'],
  ['deepdungeon', '深层迷宫数据', '#/statistics/deepdungeon'],
];

const KIND_LABELS = Object.fromEntries(STATISTICS.map(([key, name]) => [key, name]));
const KIND_ROUTES = Object.fromEntries(STATISTICS.map(([key, , route]) => [key, route]));

const DETAIL_GROUPS = {
  frontline: [
    ['total', '总览', '/home/dataCenter/frontline1TotalNew'],
    ['weekly', '近周趋势', '/home/dataCenter/frontline2WeekNew'],
    ['job', '职业统计', '/home/dataCenter/frontline3JobNew'],
    ['best', '最佳记录', '/home/dataCenter/frontline4Best'],
    ['map', '地图统计', '/home/dataCenter/frontline5Map'],
    ['mapJob', '地图职业统计', '/home/dataCenter/frontline6MapJob'],
  ],
  ultimate: [
    ['firstClear', '首通记录', '/home/dataCenter/gaoNanFirst1'],
    ['team', '队伍统计', '/home/dataCenter/gaoNanTeam2'],
    ['job', '职业统计', '/home/dataCenter/gaoNanJob3'],
    ['friend', '队友统计', '/home/dataCenter/gaoNanFriend4'],
    ['deadPoint', '倒地点统计', '/home/dataCenter/gaoNanDeadPoint5'],
    ['phase', '阶段统计', '/home/dataCenter/gaoNanPhase6'],
  ],
  fishing: [
    ['total', '总览', '/home/dataCenter/fishTotal1'],
    ['fish', '鱼类统计', '/home/dataCenter/fishNum2'],
    ['bait', '鱼饵统计', '/home/dataCenter/fishBait3'],
    ['bigFish', '大鱼统计', '/home/dataCenter/fishBig4'],
    ['achievement', '成就统计', '/home/dataCenter/fishAchieve5'],
  ],
  savage: [
    ['openStatus', '开放状态', '/home/dataCenter/dataOpenStatus'],
    ['territory', '副本明细', '/home/dataCenter/getLingShi'],
    ['total', '总览', '/home/dataCenter/getLingShiTotal'],
  ],
  glamour: [
    ['race', '种族统计', '/home/dataCenter/getDressRace1'],
    ['color', '染剂统计', '/home/dataCenter/getDressColor2'],
    ['ornament', '饰品统计', '/home/dataCenter/getDressOrnament3'],
    ['vanity', '武具投影统计', '/home/dataCenter/getDressVanity4'],
    ['fullset', '套装统计', '/home/dataCenter/getDressFullset5'],
    ['total', '总览', '/home/dataCenter/getDressTotal7'],
  ],
  occult: [
    ['total', '总览', '/home/dataCenter/getMKDTotal1'],
    ['supportJob', '支援职业统计', '/home/dataCenter/getMKDSupportJob2'],
    ['itemUse', '道具使用统计', '/home/dataCenter/getMKDItemUse3'],
    ['itemGet', '道具获取统计', '/home/dataCenter/getMKDItemGet4'],
    ['itemBox', '宝箱统计', '/home/dataCenter/getMKDItemBox5'],
    ['history', '历史记录', '/home/dataCenter/getMKDIHistory6'],
    ['achievement', '成就统计', '/home/dataCenter/getMKDAchieve7'],
    ['light', '灵光统计', '/home/dataCenter/getMKDLight8'],
  ],
  deepdungeon: [
    ['territory', '迷宫总览', '/home/dataCenter/getDDTerr1'],
    ['ultimate', '高难统计', '/home/dataCenter/getDDGaoNan2'],
    ['item', '道具统计', '/home/dataCenter/getDDItem3'],
    ['history', '历史记录', '/home/dataCenter/getDDHistory4'],
    ['achievement', '成就统计', '/home/dataCenter/getDDAchieve5'],
    ['deadPoint', '倒地点统计', '/home/dataCenter/getDDDeadPoint6'],
    ['firstTeam', '首次队伍', '/home/dataCenter/getDDFirstTeam7'],
  ],
};

const DETAIL_IGNORED_FIELDS = new Set(['character_id', 'characterId', 'uid', 'user_id', 'userId', 'role_id', 'roleId', 'tempsuid']);
const DETAIL_FIELD_ALLOWLISTS = {
  'savage.openStatus': new Set(['lingshi']),
};

function toText(value) {
  const text = String(value ?? '').replaceAll('\u0000', '').trim();
  return text || null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeKind(value) {
  const kind = String(value ?? 'glamour').trim().toLowerCase();
  const keys = STATISTICS.map(([key]) => key);
  if (kind !== 'all' && !keys.includes(kind)) throw new ArgumentError(`kind must be one of: all, ${keys.join(', ')}`);
  return kind;
}

function normalizeView(value) {
  const view = String(value ?? 'summary').trim().toLowerCase();
  if (!VIEWS.has(view)) throw new ArgumentError('view must be one of: summary, detail, routes');
  return view;
}

function normalizeDeepDungeonType(value) {
  const ddType = String(value ?? 'dd4').trim().toLowerCase();
  if (!DEEP_DUNGEON_TYPES.has(ddType)) throw new ArgumentError('ddType must be one of: dd1, dd2, dd3, dd4');
  return ddType;
}

function routeRows(kind) {
  const rows = STATISTICS.map(([key, name, route], index) => ({
    view: 'routes',
    kind: key,
    rank: index + 1,
    metric: 'route',
    label: name,
    value: null,
    unit: null,
    detail: null,
    updatedTime: null,
    url: `${WEB_BASE}${route}`,
  }));
  return kind === 'all' ? rows : rows.filter((row) => row.kind === kind);
}

function statUrl(kind) {
  return `${WEB_BASE}${KIND_ROUTES[kind]}`;
}

function makeMetricRows(kind, metrics) {
  return metrics
    .filter((metric) => metric.value !== null && metric.value !== undefined && metric.value !== '')
    .map((metric, index) => ({
      view: 'summary',
      kind,
      rank: index + 1,
      metric: metric.metric,
      label: metric.label,
      value: metric.value,
      unit: metric.unit ?? null,
      detail: metric.detail ?? KIND_LABELS[kind],
      updatedTime: metric.updatedTime ?? null,
      url: statUrl(kind),
    }));
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function compactObjectText(value) {
  if (!value || typeof value !== 'object') return null;
  const parts = Object.entries(value)
    .filter(([field, entryValue]) => !DETAIL_IGNORED_FIELDS.has(field) && isScalar(entryValue) && entryValue !== null && entryValue !== '')
    .slice(0, 6)
    .map(([key, entryValue]) => `${key}=${entryValue}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === 'object');
  if (!data || typeof data !== 'object') return [];
  for (const key of ['rows', 'list', 'data']) {
    if (Array.isArray(data[key])) return data[key].filter((row) => row && typeof row === 'object');
  }
  return [data];
}

function rowTitle(row, fallback) {
  for (const key of ['name', 'title', 'label', 'job_name', 'territory_name', 'territory_type', 'item_name', 'fish_name', 'map_name', 'achievement_name', 'log_time']) {
    const text = toText(row[key]);
    if (text) return text;
  }
  return fallback;
}

function detailValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : toText(value);
  return toNumber(value) ?? toText(value);
}

function allowedDetailRow(kind, groupKey, row) {
  const allowlist = DETAIL_FIELD_ALLOWLISTS[`${kind}.${groupKey}`];
  if (!allowlist) return row;
  return Object.fromEntries(Object.entries(row).filter(([field]) => allowlist.has(field)));
}

function detailMetricRows(kind, groupKey, groupLabel, rows) {
  return rows.flatMap((row, rowIndex) => {
    const outputRow = allowedDetailRow(kind, groupKey, row);
    return Object.entries(outputRow)
      .filter(([field, value]) => !DETAIL_IGNORED_FIELDS.has(field) && isScalar(value) && value !== null && value !== '')
      .map(([field, value]) => ({
      view: 'detail',
      kind,
      rank: 0,
      metric: `${groupKey}.${rowIndex + 1}.${field}`,
      label: `${groupLabel}：${field}`,
      value: detailValue(value),
      unit: null,
      detail: rowTitle(outputRow, compactObjectText(outputRow) ?? groupLabel),
      updatedTime: toText(outputRow.log_time ?? outputRow.update_time ?? outputRow.updated_at ?? outputRow.create_time),
      url: statUrl(kind),
    }));
  });
}

function firstRow(data) {
  return Array.isArray(data) ? data.find((row) => row && typeof row === 'object') : data;
}

function checkedPayload(payload, commandName) {
  if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
  if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
  if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);
  if ([0, 10000, 10002].includes(payload?.code)) return payload.data;
  const msg = String(payload?.msg ?? 'unexpected response');
  if (/登录|登陆|token|auth|unauthorized/i.test(msg) || payload?.code === 10403) throw new AuthRequiredError(HOST, msg);
  throw new CommandExecutionError(`${commandName} API error: ${msg}`);
}

async function requestLoggedInJson(page, path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  await page.goto(`${WEB_BASE}#/statistics/glamour`, { settleMs: 1500 });
  try {
    return await page.evaluate(`fetch(${JSON.stringify(url.toString())}, { credentials: 'include' }).then(async (resp) => {
      const text = await resp.text();
      if (!resp.ok) return { __opencliHttpError: resp.status, text };
      try { return JSON.parse(text); } catch (error) { return { __opencliJsonError: String(error && error.message || error), text }; }
    })`);
  } catch (error) {
    const message = String(error?.message || error);
    if (/401|403|登录|登陆|login|auth/i.test(message)) throw new AuthRequiredError(HOST, message);
    throw new CommandExecutionError(`ff14risingstones request failed: ${message}`);
  }
}

async function sleep(page, ms) {
  await page.evaluate(`new Promise((resolve) => setTimeout(resolve, ${Number(ms)}))`);
}

async function fetchData(page, kind, path, params) {
  const payload = await requestLoggedInJson(page, path, params);
  const data = checkedPayload(payload, `ff14risingstones statistics ${kind}`);
  const row = firstRow(data);
  if (!row) throw new EmptyResultError('ff14risingstones statistics', `${kind} has no statistics data for the current character`);
  return row;
}

async function detailRowsForKind(page, args, kind) {
  const groups = DETAIL_GROUPS[kind] ?? [];
  const rows = [];
  for (const [groupKey, groupLabel, path] of groups) {
    if (rows.length > 0) await sleep(page, 700);
    const params = kind === 'deepdungeon' ? { dd_type: normalizeDeepDungeonType(args.ddType) } : {};
    const data = checkedPayload(await requestLoggedInJson(page, path, params), `ff14risingstones statistics ${kind} ${groupKey}`);
    rows.push(...detailMetricRows(kind, groupKey, groupLabel, normalizeRows(data)));
  }
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones statistics', `${kind} has no detailed statistics data for the current character`);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

async function detailRows(page, args, kind) {
  const kinds = kind === 'all' ? Object.keys(DETAIL_GROUPS) : [kind];
  const rows = [];
  for (const currentKind of kinds) {
    if (rows.length > 0) await sleep(page, 900);
    try {
      rows.push(...await detailRowsForKind(page, args, currentKind));
    } catch (error) {
      if (kind !== 'all' || !(error instanceof EmptyResultError)) throw error;
    }
  }
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones statistics', 'API returned no detailed statistics rows');
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

async function summaryFrontline(page) {
  const row = await fetchData(page, 'frontline', '/home/dataCenter/frontline1TotalNew');
  return makeMetricRows('frontline', [
    { metric: 'fightTimes', label: '参战次数', value: toNumber(row.fight_times), unit: '次' },
    { metric: 'winTimes', label: '胜利次数', value: toNumber(row.win_times), unit: '次' },
    { metric: 'winRate', label: '胜率', value: toNumber(row.win_rate), unit: '%' },
    { metric: 'kda', label: 'KDA', value: toNumber(row.kda) },
    { metric: 'killTimes', label: '击倒数', value: toNumber(row.kill_times), unit: '次' },
    { metric: 'assistTimes', label: '助攻数', value: toNumber(row.assist_times), unit: '次' },
    { metric: 'deadTimes', label: '倒地数', value: toNumber(row.dead_times), unit: '次' },
    { metric: 'grandCompany', label: '所属势力', value: toText(row.gc_id) },
  ]);
}

async function summaryFishing(page) {
  const row = await fetchData(page, 'fishing', '/home/dataCenter/fishTotal1');
  return makeMetricRows('fishing', [
    { metric: 'totalTimes', label: '钓鱼次数', value: toNumber(row.total_times), unit: '次' },
    { metric: 'successRate', label: '成功率', value: toNumber(row.succ_rate), unit: '%' },
    { metric: 'seaTimes', label: '出海次数', value: toNumber(row.sea_times), unit: '次' },
    { metric: 'maxSeaScore', label: '最高出海分数', value: toNumber(row.max_sea_score), unit: '分' },
  ]);
}

async function summaryUltimate(page) {
  const data = checkedPayload(await requestLoggedInJson(page, '/home/dataCenter/gaoNanFirst1'), 'ff14risingstones statistics ultimate');
  const rows = Array.isArray(data) ? data.filter((row) => row && typeof row === 'object') : [];
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones statistics', 'ultimate has no statistics data for the current character');
  return rows.flatMap((row, index) => makeMetricRows('ultimate', [
    { metric: `clearTimes.${index + 1}`, label: `绝境 ${toText(row.territory_type) ?? index + 1} 通关次数`, value: toNumber(row.clear_times), unit: '次', detail: toText(row.job_name) },
    { metric: `deadTimes.${index + 1}`, label: `绝境 ${toText(row.territory_type) ?? index + 1} 倒地次数`, value: toNumber(row.dead_times), unit: '次', detail: toText(row.job_name) },
    { metric: `firstClear.${index + 1}`, label: `绝境 ${toText(row.territory_type) ?? index + 1} 首通时间`, value: toText(row.log_time), detail: toText(row.job_name), updatedTime: toText(row.log_time) },
  ]));
}

async function summarySavage(page) {
  const row = await fetchData(page, 'savage', '/home/dataCenter/getLingShiTotal');
  return makeMetricRows('savage', [
    { metric: 'territoryCount', label: '已记录副本数', value: toNumber(row.territory_num), unit: '个' },
    { metric: 'enterCount', label: '进入次数', value: toNumber(row.enter_num), unit: '次' },
    { metric: 'finishTimes', label: '完成次数', value: toNumber(row.finish_times), unit: '次' },
    { metric: 'elapsedTime', label: '累计耗时', value: toNumber(row.elapsed_time), unit: '分钟' },
  ]);
}

async function summaryGlamour(page) {
  const row = await fetchData(page, 'glamour', '/home/dataCenter/getDressTotal7');
  return makeMetricRows('glamour', [
    { metric: 'fantasiaTimes', label: '使用幻想药次数', value: toNumber(row.washing_num), unit: '次' },
    { metric: 'gearsetCount', label: '已套装幻影化数量', value: toNumber(row.set_num), unit: '套' },
    { metric: 'dyeCount', label: '装备使用染剂数', value: toNumber(row.color_times), unit: '种' },
    { metric: 'glamourTimes', label: '武具投影次数', value: toNumber(row.vanity_times), unit: '次' },
  ]);
}

async function summaryOccult(page) {
  const row = await fetchData(page, 'occult', '/home/dataCenter/getMKDTotal1');
  return makeMetricRows('occult', [
    { metric: 'currentLevel', label: '当前等级', value: toNumber(row.now_level), unit: '级' },
    { metric: 'fateTimes', label: 'FATE 完成次数', value: toNumber(row.fate_times), unit: '次' },
    { metric: 'ceTimes', label: 'CE 完成次数', value: toNumber(row.ce_times), unit: '次' },
  ]);
}

async function summaryDeepDungeon(page, args) {
  const ddType = normalizeDeepDungeonType(args.ddType);
  const row = await fetchData(page, 'deepdungeon', '/home/dataCenter/getDDTerr1', { dd_type: ddType });
  return makeMetricRows('deepdungeon', [
    { metric: 'clearTimes', label: '通关次数', value: toNumber(row.clearTimes ?? row.clear_times), unit: '次', detail: ddType },
    { metric: 'weaponLevel', label: '魔器武器等级', value: toNumber(row.weapon_level), detail: ddType },
    { metric: 'armorLevel', label: '魔器防具等级', value: toNumber(row.armor_level), detail: ddType },
    { metric: 'enchantedLevel', label: '强化等级', value: toNumber(row.enchantedLevel), detail: ddType },
  ]);
}

const SUMMARY_LOADERS = {
  frontline: summaryFrontline,
  ultimate: summaryUltimate,
  fishing: summaryFishing,
  savage: summarySavage,
  glamour: summaryGlamour,
  occult: summaryOccult,
  deepdungeon: summaryDeepDungeon,
};

async function summaryRows(page, args, kind) {
  const kinds = kind === 'all' ? Object.keys(SUMMARY_LOADERS) : [kind];
  const rows = [];
  for (const currentKind of kinds) {
    if (rows.length > 0) await sleep(page, 900);
    try {
      rows.push(...await SUMMARY_LOADERS[currentKind](page, args));
    } catch (error) {
      if (kind !== 'all' || !(error instanceof EmptyResultError)) throw error;
    }
  }
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones statistics', 'API returned no statistics rows');
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

cli({
  site: 'ff14risingstones',
  name: 'statistics',
  description: 'FF14 国服石之家当前登录角色统计数据',
  access: 'read',
  example: 'opencli ff14risingstones statistics --kind glamour -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'view', type: 'string', default: 'summary', help: '查看内容：summary（统计总览）/ detail（网页细项）/ routes（统计页入口）' },
    { name: 'kind', type: 'string', default: 'glamour', help: '统计类型：all/frontline/ultimate/fishing/savage/glamour/occult/deepdungeon' },
    { name: 'ddType', type: 'string', default: 'dd4', help: 'deepdungeon 使用的深层迷宫类型：dd1/dd2/dd3/dd4' },
  ],
  columns: ['view', 'kind', 'rank', 'metric', 'label', 'value', 'unit', 'detail', 'updatedTime', 'url'],
  func: async (page, args) => {
    const view = normalizeView(args.view);
    const kind = normalizeKind(args.kind);
    if (view === 'routes') return routeRows(kind);
    if (view === 'detail') return detailRows(page, args, kind);
    return summaryRows(page, args, kind);
  },
});
