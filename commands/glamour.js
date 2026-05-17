import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const HOST = 'ff14risingstones.web.sdo.com';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/#/glamour';
const VIEWS = new Set(['list', 'detail', 'routes']);
const GENDERS = new Set(['all', 'male', 'female', '1', '2']);
const CREATE_TIMES = new Set(['all', 'last24H', 'lastWeek', 'lastMonth']);
const ORDERS = new Set(['default', 'latest', 'hottest']);

function normalizeView(value) {
  const view = String(value ?? 'list').trim().toLowerCase();
  if (!VIEWS.has(view)) throw new ArgumentError('view must be one of: list, detail, routes');
  return view;
}

function normalizePositiveInteger(value, defaultValue, label) {
  const n = Number(value ?? defaultValue);
  if (!Number.isInteger(n) || n <= 0) throw new ArgumentError(`${label} must be a positive integer`);
  return n;
}

function normalizeLimit(value) {
  const limit = normalizePositiveInteger(value, 20, 'limit');
  if (limit > 100) throw new ArgumentError('limit must be <= 100');
  return limit;
}

function normalizeOptionalText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length > 80) throw new ArgumentError(`${label} must be <= 80 characters`);
  return text;
}

function normalizeOptionalPositiveInteger(value, label) {
  if (value === null || value === undefined || value === '' || Number(value) === 0) return null;
  return String(normalizePositiveInteger(value, 0, label));
}

function normalizeGender(value) {
  const gender = String(value ?? 'all').trim().toLowerCase();
  if (!GENDERS.has(gender)) throw new ArgumentError('gender must be one of: all, male, female, 1, 2');
  if (gender === 'all') return null;
  if (gender === 'male') return '1';
  if (gender === 'female') return '2';
  return gender;
}

function normalizeCreateTime(value) {
  const createTime = String(value ?? 'all').trim();
  if (!CREATE_TIMES.has(createTime)) throw new ArgumentError('createTime must be one of: all, last24H, lastWeek, lastMonth');
  return createTime === 'all' ? null : createTime;
}

function normalizeOrder(value) {
  const order = String(value ?? 'default').trim().toLowerCase();
  if (!ORDERS.has(order)) throw new ArgumentError('order must be one of: default, latest, hottest');
  return order === 'default' ? null : order;
}

function normalizeId(value) {
  const id = normalizePositiveInteger(value, 0, 'id');
  return String(id);
}

function toText(value) {
  const text = String(value ?? '').replaceAll('\u0000', '').trim();
  return text || null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function joinNames(values) {
  const names = parseArray(values)
    .map((entry) => toText(entry?.name ?? entry?.Name ?? entry))
    .filter(Boolean);
  return names.length > 0 ? names.join('/') : null;
}

function genderNames(values) {
  const names = parseArray(values).map((entry) => {
    const value = toNumber(entry?.id ?? entry);
    if (value === 1) return '男';
    if (value === 2) return '女';
    return toText(entry?.name ?? entry);
  }).filter(Boolean);
  return names.length > 0 ? names.join('/') : null;
}

function compactParts(parts) {
  const text = parts.filter(Boolean).join('；');
  return text || null;
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === 'object');
  if (!data || typeof data !== 'object') return [];
  for (const key of ['rows', 'list', 'data']) {
    if (Array.isArray(data[key])) return data[key].filter((row) => row && typeof row === 'object');
  }
  return [data];
}

function checkedPayload(payload, commandName) {
  if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
  if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
  if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);
  if (payload?.code === 10000) return payload.data;
  const msg = String(payload?.msg ?? 'unexpected response');
  if (/登录|登陆|token|auth|unauthorized/i.test(msg) || payload?.code === 10403) throw new AuthRequiredError(HOST, msg);
  throw new CommandExecutionError(`${commandName} API error: ${msg}`);
}

function makeUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function requestLoggedInJson(page, path, params = {}) {
  const url = makeUrl(path, params);
  await page.goto(WEB_BASE, { settleMs: 1500 });
  try {
    return await page.evaluate(`fetch(${JSON.stringify(url)}, { credentials: 'include' }).then(async (resp) => {
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

async function resolveEquipmentIds(page, args) {
  const explicitId = normalizeOptionalPositiveInteger(args.equipmentId, 'equipmentId');
  if (explicitId) return [explicitId];
  const equipment = normalizeOptionalText(args.equipment, 'equipment');
  if (!equipment) return [];
  const payload = await requestLoggedInJson(page, '/home/gameData/searchEquip', { page: 1, limit: 10, name: equipment });
  const data = checkedPayload(payload, 'ff14risingstones glamour equipment search');
  const ids = normalizeRows(data?.rows ?? data)
    .map((row) => toText(row?.id ?? row?.equipment_id ?? row?.equip_id))
    .filter(Boolean);
  if (ids.length === 0) throw new EmptyResultError('ff14risingstones glamour', `no equipment matched ${equipment}`);
  return [...new Set(ids)];
}

function glamourUrl(id = null) {
  return id ? `${WEB_BASE}/detail/${encodeURIComponent(String(id))}` : WEB_BASE;
}

function authorName(row) {
  return toText(row.nickname) ?? toText(row.username) ?? toText(row.character_name) ?? toText(row.userInfo?.character_name);
}

function characterName(row) {
  return toText(row.character_name) ?? toText(row.userInfo?.character_name) ?? authorName(row);
}

function serverName(row) {
  return compactParts([toText(row.area_name ?? row.userInfo?.area_name), toText(row.group_name ?? row.userInfo?.group_name)]);
}

function raceGender(row) {
  return compactParts([joinNames(row.race_ids), genderNames(row.gender_ids)]);
}

function equipmentSummary(row) {
  const names = parseArray(row.equipments)
    .map((entry) => toText(entry?.equipment_info?.name ?? entry?.name))
    .filter(Boolean)
    .slice(0, 8);
  return names.length > 0 ? names.join(' / ') : null;
}

function communityRow(row, index, view) {
  return {
    view,
    rank: index + 1,
    glamourId: toText(row.id),
    title: toText(row.title),
    author: authorName(row),
    characterName: characterName(row),
    server: serverName(row),
    races: raceGender(row),
    jobs: joinNames(row.job_ids),
    itemId: null,
    name: toText(row.title) ?? `幻化 ${toText(row.id) ?? index + 1}`,
    category: view === 'detail' ? '幻化详情' : '幻化投稿',
    value: null,
    unit: null,
    detail: toText(row.desc) ?? equipmentSummary(row),
    imageUrl: toText(row.main_image),
    likeCount: toNumber(row.likes),
    favoriteCount: toNumber(row.favorites),
    createdTime: toText(row.created_at),
    url: glamourUrl(row.id),
  };
}

function equipmentRows(row) {
  return parseArray(row.equipments)
    .filter((entry) => entry && typeof entry === 'object' && entry.equipment_id !== -1)
    .map((entry, index) => ({
      view: 'equipment',
      rank: index + 1,
      glamourId: toText(row.id),
      title: toText(row.title),
      author: authorName(row),
      characterName: characterName(row),
      server: serverName(row),
      races: raceGender(row),
      jobs: joinNames(row.job_ids),
      itemId: toText(entry.equipment_id ?? entry.equipment_info?.equipment_id),
      name: toText(entry.equipment_info?.name ?? entry.display_name ?? entry.slot),
      category: toText(entry.display_name ?? entry.slot),
      value: null,
      unit: null,
      detail: compactParts([
        parseArray(entry.equipment_info?.dye_ids ?? entry.dye_ids).length > 0 ? `染剂=${parseArray(entry.equipment_info?.dye_ids ?? entry.dye_ids).join(',')}` : null,
        toText(entry.equipment_info?.icon_id) ? `图标=${toText(entry.equipment_info.icon_id)}` : null,
      ]),
      imageUrl: toText(row.main_image),
      likeCount: toNumber(row.likes),
      favoriteCount: toNumber(row.favorites),
      createdTime: toText(row.created_at),
      url: glamourUrl(row.id),
    }));
}

async function listRows(page, args) {
  const pageNumber = normalizePositiveInteger(args.page, 1, 'page');
  const limit = normalizeLimit(args.limit);
  const query = normalizeOptionalText(args.query, 'query');
  const equipmentIds = await resolveEquipmentIds(page, args);
  const listParams = {
    page: pageNumber,
    limit,
    order: normalizeOrder(args.order),
    race_id: normalizeOptionalPositiveInteger(args.raceId, 'raceId'),
    gender_id: normalizeGender(args.gender),
    createTime: normalizeCreateTime(args.createTime),
  };
  let payload;
  if (equipmentIds.length > 0) {
    for (const equipmentId of equipmentIds) {
      payload = await requestLoggedInJson(page, '/common/search', { ...listParams, type: 7, keywords: equipmentId, searchByEquipment: 1 });
      const data = checkedPayload(payload, 'ff14risingstones glamour list');
      const rows = normalizeRows(data?.rows ?? data).slice(0, limit);
      if (rows.length > 0) return rows.map((row, index) => communityRow(row, index, 'list'));
    }
    throw new EmptyResultError('ff14risingstones glamour', 'equipment search returned no glamour rows');
  } else if (query) {
    payload = await requestLoggedInJson(page, '/common/search', { ...listParams, type: 7, keywords: query });
  } else {
    payload = await requestLoggedInJson(page, '/home/glamour/glamoursList', listParams);
  }
  const data = checkedPayload(payload, 'ff14risingstones glamour list');
  const rows = normalizeRows(data?.rows ?? data).slice(0, limit);
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones glamour', 'glamour list returned no rows');
  return rows.map((row, index) => communityRow(row, index, 'list'));
}

async function detailRows(page, args) {
  const id = normalizeId(args.id);
  const payload = await requestLoggedInJson(page, '/home/glamour/glamourDetail', { id });
  const row = checkedPayload(payload, 'ff14risingstones glamour detail');
  if (!row || typeof row !== 'object') throw new EmptyResultError('ff14risingstones glamour', `glamour ${id} returned no detail`);
  return [communityRow(row, 0, 'detail'), ...equipmentRows(row).map((entry, index) => ({ ...entry, rank: index + 2 }))];
}

function routeRows() {
  return [
    ['list', '幻化投稿列表', '/home/glamour/glamoursList?page&limit&order&race_id&gender_id&createTime'],
    ['search', '幻化标题/装备搜索', '/common/search?type=7&keywords&searchByEquipment=1'],
    ['equipment', '装备名称转装备 ID', '/home/gameData/searchEquip?name'],
    ['detail', '幻化投稿详情', '/home/glamour/glamourDetail?id=<id>'],
  ].map(([view, label, path], index) => ({
    view: 'routes',
    rank: index + 1,
    glamourId: null,
    title: label,
    author: null,
    characterName: null,
    server: null,
    races: null,
    jobs: null,
    itemId: null,
    name: view,
    category: '幻化接口',
    value: null,
    unit: null,
    detail: path,
    imageUrl: null,
    likeCount: null,
    favoriteCount: null,
    createdTime: null,
    url: WEB_BASE,
  }));
}

cli({
  site: 'ff14risingstones',
  name: 'glamour',
  description: 'FF14 国服石之家幻化投稿列表/详情',
  access: 'read',
  example: 'opencli ff14risingstones glamour --view detail --id 265250 -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'view', type: 'string', default: 'list', help: '查看内容：list（投稿列表）/ detail（投稿详情）/ routes（接口入口）' },
    { name: 'id', type: 'int', default: 265250, help: '幻化投稿 ID；--view detail 时使用' },
    { name: 'page', type: 'int', default: 1, help: '页码，从 1 开始；--view list 使用' },
    { name: 'limit', type: 'int', default: 20, help: '返回条数，范围 1-100；--view list 使用' },
    { name: 'query', type: 'string', default: '', help: '按标题关键词搜索投稿；与 equipment/equipmentId 同时提供时优先装备搜索' },
    { name: 'equipment', type: 'string', default: '', help: '按装备名称搜索相关幻化投稿，会先调用装备搜索取第一个匹配装备 ID' },
    { name: 'equipmentId', type: 'int', default: 0, help: '按装备 ID 搜索相关幻化投稿；优先级高于 equipment' },
    { name: 'raceId', type: 'int', default: 0, help: '按种族 ID 筛选投稿；0 表示全部' },
    { name: 'gender', type: 'string', default: 'all', help: '按性别筛选：all/male/female/1/2' },
    { name: 'createTime', type: 'string', default: 'all', help: '按发布时间筛选：all/last24H/lastWeek/lastMonth' },
    { name: 'order', type: 'string', default: 'default', help: '排序：default/latest/hottest；搜索模式下由站点搜索接口决定' },
  ],
  columns: ['view', 'rank', 'glamourId', 'title', 'author', 'characterName', 'server', 'races', 'jobs', 'itemId', 'name', 'category', 'value', 'unit', 'detail', 'imageUrl', 'likeCount', 'favoriteCount', 'createdTime', 'url'],
  func: async (page, args) => {
    const view = normalizeView(args.view);
    if (view === 'routes') return routeRows();
    if (view === 'detail') return detailRows(page, args);
    return listRows(page, args);
  },
});
