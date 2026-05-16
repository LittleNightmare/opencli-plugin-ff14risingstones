import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'apiff14risingstones.web.sdo.com';

const VIEWS = new Set(['list', 'detail', 'config']);
const TYPES = new Set(['party', 'beginner', 'guild', 'rp', 'other']);
const CONFIG_KINDS = new Set(['all', 'job', 'style', 'party', 'label', 'guildLabel', 'category', 'area']);

const LIST_ENDPOINTS = {
  party: '/home/recruit/recruitFbList',
  beginner: '/home/recruit/recruitNeList',
  guild: '/home/recruit/recruitGuildList',
  rp: '/home/recruit/recruitRpList',
  other: '/home/recruit/recruitOtherList',
};

const DETAIL_ENDPOINTS = {
  party: '/home/recruit/getRecruitFbDetail',
  beginner: '/home/recruit/getNeDetail',
  guild: '/home/recruit/getRecruitGuildDetail',
  rp: '/home/recruit/getRpDetail',
  other: '/home/recruit/getOtherDetail',
};

async function fetchJson(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  let resp;
  try {
    resp = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': WEB_BASE,
        'User-Agent': 'Mozilla/5.0',
      },
    });
  } catch (error) {
    throw new CommandExecutionError(`ff14risingstones request failed: ${error?.message || error}`);
  }
  if (!resp.ok) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${resp.status}`);
  try {
    return await resp.json();
  } catch (error) {
    throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${error?.message || error}`);
  }
}

function assertSuccess(payload, commandName) {
  if (payload?.code === 10000) return payload.data;
  if (payload?.code === 10403) throw new AuthRequiredError(HOST, payload?.msg || '请先登录');
  throw new CommandExecutionError(`${commandName} API error: ${payload?.msg || 'unexpected response'}`);
}

function toText(value) {
  const text = String(value ?? '').replaceAll('\u0000', '').trim();
  return text || null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toTimeText(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^\d{10}$/.test(text)) {
    const date = new Date(Number(text) * 1000 + 8 * 60 * 60 * 1000);
    return `${date.toISOString().slice(0, 19)}+08:00`;
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
  return text;
}

function stripHtml(value) {
  const text = toText(value);
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null;
}

function normalizeEnum(value, defaultValue, allowed, label) {
  const normalized = String(value ?? defaultValue).trim();
  if (!allowed.has(normalized)) throw new ArgumentError(`${label} must be one of: ${[...allowed].join(', ')}`);
  return normalized;
}

function normalizePositiveInteger(value, defaultValue, label) {
  const raw = value ?? defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ArgumentError(`${label} must be a positive integer`);
  return n;
}

function normalizeLimit(value) {
  const limit = normalizePositiveInteger(value, 10, 'limit');
  if (limit > 50) throw new ArgumentError('limit must be <= 50');
  return limit;
}

function normalizeId(value) {
  return String(normalizePositiveInteger(value, undefined, 'id'));
}

function csv(value) {
  const text = toText(value);
  if (!text) return null;
  return text.split(',').map((item) => item.trim()).filter(Boolean).join(',') || null;
}

function names(items, key) {
  if (!Array.isArray(items)) return null;
  return items.map((item) => toText(item?.[key])).filter(Boolean).join(',') || null;
}

function joinText(...values) {
  return values.map((value) => stripHtml(value)).filter(Boolean).join('\n\n') || null;
}

function route(type, id = null) {
  const suffix = id ? `?id=${encodeURIComponent(id)}` : '';
  if (type === 'guild') return id ? `${WEB_BASE}#/recruit/guild/detail/${encodeURIComponent(id)}` : `${WEB_BASE}#/recruit/guild`;
  if (type === 'rp') return id ? `${WEB_BASE}#/recruit/roleplay/detail/${encodeURIComponent(id)}` : `${WEB_BASE}#/recruit/roleplay`;
  if (type === 'beginner') return `${WEB_BASE}#/recruit/beginner${suffix}`;
  if (type === 'other') return `${WEB_BASE}#/recruit/others${suffix}`;
  return `${WEB_BASE}#/recruit/party${suffix}`;
}

function pushConfigRow(rows, row) {
  if (!row.recruitId || !row.title) return;
  rows.push(row);
}

function makeRow({ view, type, rank, row }) {
  const recruitId = toText(row.id);
  const userInfo = row.userInfo && typeof row.userInfo === 'object' ? row.userInfo : {};
  const styleNames = names(row.styleInfo, 'style');
  const labelNames = names(row.labelInfo, 'name');
  const jobNames = names(row.jobInfo, 'value');
  const title = toText(row.title ?? row.fb_name ?? row.guild_name ?? row.rp_name ?? row.category_name);
  const schedule = [toText(row.fb_time ?? row.open_time), toText(row.weekday_time), toText(row.weekend_time)]
    .filter(Boolean)
    .join(' / ') || null;

  return {
    view,
    type,
    rank,
    recruitId,
    title,
    category: toText(row.fb_type ?? row.category_name ?? row.team_composition ?? row.identity ?? row.rp_type),
    author: toText(row.character_name ?? userInfo.character_name),
    server: [toText(row.area_name ?? userInfo.area_name), toText(row.group_name ?? userInfo.group_name)].filter(Boolean).join('/') || null,
    targetServer: [toText(row.target_area_name ?? row.rp_area_name), toText(row.target_group_name ?? row.rp_group_name)].filter(Boolean).join('/') || null,
    summary: stripHtml(row.progress ?? row.profile ?? row.detail_mask ?? row.strategy ?? row.fb_time),
    detail: joinText(row.team_detail_mask, row.detail_mask),
    requirements: joinText(row.recruit_require_mask, row.strategy_desc_mask),
    schedule,
    tags: labelNames ?? styleNames ?? toText(row.custom_label),
    jobs: jobNames,
    responseCount: toNumber(row.response_num ?? row.star_count ?? row.comment_count),
    updatedTime: toTimeText(row.updated_at ?? row.sort_updated_time ?? row.polish_time ?? row.created_at),
    url: route(type, recruitId),
  };
}

function buildListParams(type, args, page, limit) {
  const params = { page, limit };
  const query = toText(args.query);
  const areaId = toText(args.areaId);
  const groupId = toText(args.groupId);

  if (type === 'party') {
    params.fb_name = toText(args.partyName) ?? query;
    params.fb_type = toText(args.partyType);
    params.position = csv(args.position);
    params.label = csv(args.label);
    params.team_composition = toText(args.team);
    if (areaId) params.target_area_id = areaId;
    if (groupId) params.target_group_id = groupId;
  } else if (type === 'beginner') {
    params.style = csv(args.style);
    params.identity = toText(args.identity);
    if (areaId) params.target_area_id = areaId;
    if (groupId) params.target_group_id = groupId;
  } else if (type === 'guild') {
    params.guild_name = query;
    params.active_member_num = csv(args.activeMemberNum);
    params.label = csv(args.label);
    if (areaId) params.target_area_id = areaId;
    if (groupId) params.target_group_id = groupId;
  } else if (type === 'rp') {
    params.rp_name = query;
    params.rp_type = csv(args.rpType);
    params.act_status = csv(args.rpStatus);
    params.order = toText(args.order);
    if (areaId) params.rp_area_id = areaId;
    if (groupId) params.rp_group_id = groupId;
  } else if (type === 'other') {
    params.category = csv(args.category);
    if (areaId) params.target_area_id = areaId;
    if (groupId) params.target_group_id = groupId;
  }

  return params;
}

function matchesJob(row, jobFilter) {
  if (!jobFilter) return true;
  const wanted = jobFilter.split(',').map((item) => item.trim()).filter(Boolean);
  if (wanted.length === 0) return true;
  const jobIds = Array.isArray(row.need_job) ? row.need_job.map((item) => String(item)) : [];
  const jobNames = Array.isArray(row.jobInfo) ? row.jobInfo.map((item) => String(item?.value ?? '')) : [];
  return wanted.some((item) => jobIds.includes(item) || jobNames.some((name) => name.includes(item)));
}

async function listRecruit(args) {
  const type = normalizeEnum(args.type, 'party', TYPES, 'type');
  if (type === 'guild') throw new ArgumentError('type guild requires login; use recruit-guild instead');
  const page = normalizePositiveInteger(args.page, 1, 'page');
  const limit = normalizeLimit(args.limit);
  const localJobFilter = type === 'party' ? csv(args.job) : null;
  const fetchLimit = localJobFilter ? 50 : limit;
  const payload = await fetchJson(LIST_ENDPOINTS[type], buildListParams(type, args, page, fetchLimit));
  const data = assertSuccess(payload, `ff14risingstones recruit ${type} list`);
  const rows = (Array.isArray(data?.rows) ? data.rows : []).filter((row) => matchesJob(row, localJobFilter));
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones recruit', 'API returned no recruit rows');
  return rows.slice(0, limit).map((row, index) => makeRow({ view: 'list', type, rank: index + 1, row }));
}

async function detailRecruit(args) {
  const type = normalizeEnum(args.type, 'party', TYPES, 'type');
  if (type === 'guild') throw new ArgumentError('type guild requires login; use recruit-guild instead');
  const id = normalizeId(args.id);
  const payload = await fetchJson(DETAIL_ENDPOINTS[type], { id });
  const row = assertSuccess(payload, `ff14risingstones recruit ${type} detail`);
  if (!row?.id) throw new EmptyResultError('ff14risingstones recruit', 'API returned no recruit detail');
  return [makeRow({ view: 'detail', type, rank: 1, row })];
}

function appendJobConfigRows(rows, jobData) {
  for (const [group, items] of Object.entries(jobData ?? {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      pushConfigRow(rows, {
        view: 'config',
        type: 'job',
        rank: rows.length + 1,
        recruitId: toText(item.id),
        title: toText(item.value),
        category: toText(item.job_type ?? group),
        author: null,
        server: null,
        targetServer: null,
        summary: null,
        detail: null,
        requirements: null,
        schedule: null,
        tags: null,
        jobs: null,
        responseCount: null,
        updatedTime: null,
        url: route('party'),
      });
    }
  }
}

function appendSimpleConfigRows(rows, type, data, titleKey, category) {
  if (!Array.isArray(data)) return;
  for (const item of data) {
    pushConfigRow(rows, {
      view: 'config',
      type,
      rank: rows.length + 1,
      recruitId: toText(item.id ?? item.AreaID),
      title: toText(item[titleKey] ?? item.AreaName),
      category,
      author: null,
      server: null,
      targetServer: null,
      summary: null,
      detail: null,
      requirements: null,
      schedule: null,
      tags: null,
      jobs: null,
      responseCount: null,
      updatedTime: null,
      url: type === 'style' ? route('guild') : route('party'),
    });
  }
}

function appendAreaConfigRows(rows, data) {
  if (!Array.isArray(data)) return;
  for (const area of data) {
    pushConfigRow(rows, {
      view: 'config',
      type: 'area',
      rank: rows.length + 1,
      recruitId: toText(area.AreaID),
      title: toText(area.AreaName),
      category: '大区',
      author: null,
      server: null,
      targetServer: null,
      summary: null,
      detail: null,
      requirements: null,
      schedule: null,
      tags: null,
      jobs: null,
      responseCount: null,
      updatedTime: null,
      url: route('party'),
    });
    if (!Array.isArray(area.vGroup)) continue;
    for (const group of area.vGroup) {
      pushConfigRow(rows, {
        view: 'config',
        type: 'area',
        rank: rows.length + 1,
        recruitId: `${toText(group.AreaID)}:${toText(group.GroupID)}`,
        title: toText(group.GroupName),
        category: `服务器:${toText(group.AreaName)}`,
        author: null,
        server: null,
        targetServer: null,
        summary: `areaId=${toText(group.AreaID)}, groupId=${toText(group.GroupID)}`,
        detail: null,
        requirements: null,
        schedule: null,
        tags: null,
        jobs: null,
        responseCount: null,
        updatedTime: null,
        url: route('party'),
      });
    }
  }
}

async function configRecruit(args) {
  const kind = normalizeEnum(args.kind, 'all', CONFIG_KINDS, 'kind');
  const query = String(args.query ?? '').trim().toLowerCase();
  const rows = [];

  if (kind === 'all' || kind === 'job') appendJobConfigRows(rows, assertSuccess(await fetchJson('/home/recruit/getJobConfigList'), 'ff14risingstones recruit jobs'));
  if (kind === 'all' || kind === 'style') appendSimpleConfigRows(rows, 'style', assertSuccess(await fetchJson('/home/recruit/styleConfigList'), 'ff14risingstones recruit styles'), 'style', '玩法风格');
  if (kind === 'all' || kind === 'party') appendSimpleConfigRows(rows, 'party', assertSuccess(await fetchJson('/home/recruit/getFbConfigList'), 'ff14risingstones recruit party config'), 'fb_name', '副本');
  if (kind === 'all' || kind === 'label') appendSimpleConfigRows(rows, 'label', assertSuccess(await fetchJson('/home/recruit/fbLabelList'), 'ff14risingstones recruit labels'), 'name', '副本标签');
  if (kind === 'all' || kind === 'guildLabel') appendSimpleConfigRows(rows, 'guildLabel', assertSuccess(await fetchJson('/home/recruit/guildLabelList'), 'ff14risingstones recruit guild labels'), 'name', '部队标签');
  if (kind === 'all' || kind === 'category') appendSimpleConfigRows(rows, 'category', assertSuccess(await fetchJson('/home/recruit/categoryConfigList'), 'ff14risingstones recruit categories'), 'name', '其他招募分类');
  if (kind === 'all' || kind === 'area') appendAreaConfigRows(rows, assertSuccess(await fetchJson('/home/groupAndRole/getAreaAndGroupList'), 'ff14risingstones area config'));

  const filteredRows = rows.filter((row) => !query || [row.type, row.category, row.recruitId, row.title].some((value) => String(value ?? '').toLowerCase().includes(query)));
  if (filteredRows.length === 0) throw new EmptyResultError('ff14risingstones recruit', 'API returned no matching recruit config rows');
  return filteredRows.map((row, index) => ({ ...row, rank: index + 1 }));
}

cli({
  site: 'ff14risingstones',
  name: 'recruit',
  description: 'FF14 国服石之家真实招募列表/详情查询，兼容配置字典查看',
  access: 'read',
  example: 'opencli ff14risingstones recruit --view list --type party --partyType 绝境战 --limit 5 -f yaml',
  domain: HOST,
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'view', type: 'string', default: 'list', help: '查看内容：list（真实招募列表）/detail（单条详情）/config（筛选配置字典）' },
    { name: 'type', type: 'string', default: 'party', help: '招募类型：party/beginner/guild/rp/other；guild 可能需要登录态' },
    { name: 'id', type: 'int', default: 0, help: '招募 ID；view=detail 时必填' },
    { name: 'page', type: 'int', default: 1, help: '页码（1-based）；view=list 使用' },
    { name: 'limit', type: 'int', default: 10, help: '返回条数（1-50）；view=list 使用' },
    { name: 'query', type: 'string', default: '', help: '关键词；party 匹配副本名，guild 匹配部队名，rp 匹配 RP 名称，config 做本地过滤' },
    { name: 'kind', type: 'string', default: 'all', help: 'view=config 使用：all/job/style/party/label/guildLabel/category/area' },
    { name: 'areaId', type: 'string', default: '', help: '目标大区 ID；用 --view config --kind area 查看' },
    { name: 'groupId', type: 'string', default: '', help: '目标服务器 ID；配合 areaId 使用' },
    { name: 'job', type: 'string', default: '', help: 'party 职业/位置 ID，多个用逗号分隔；用 --view config --kind job 查看' },
    { name: 'label', type: 'string', default: '', help: 'party/guild 标签 ID，多个用逗号分隔' },
    { name: 'style', type: 'string', default: '', help: 'beginner 玩法风格 ID，多个用逗号分隔；用 --view config --kind style 查看' },
    { name: 'category', type: 'string', default: '', help: 'other 分类 ID，多个用逗号分隔；用 --view config --kind category 查看' },
    { name: 'partyType', type: 'string', default: '', help: 'party 副本类型，如 绝境战/零式' },
    { name: 'partyName', type: 'string', default: '', help: 'party 副本名；优先于 query' },
    { name: 'team', type: 'string', default: '', help: 'party 队伍构成，如 满编小队/轻锐小队/团队/其他' },
    { name: 'position', type: 'string', default: '', help: 'party 位置筛选，多个用逗号分隔；未填时使用 job' },
    { name: 'identity', type: 'string', default: '', help: 'beginner 身份筛选' },
    { name: 'activeMemberNum', type: 'string', default: '', help: 'guild 活跃人数区间，多个用逗号分隔' },
    { name: 'rpType', type: 'string', default: '', help: 'rp 类型 ID，多个用逗号分隔' },
    { name: 'rpStatus', type: 'string', default: '', help: 'rp 活动状态筛选' },
    { name: 'order', type: 'string', default: '', help: 'rp 排序参数，如 hottest' },
  ],
  columns: ['view', 'type', 'rank', 'recruitId', 'title', 'category', 'author', 'server', 'targetServer', 'summary', 'detail', 'requirements', 'schedule', 'tags', 'jobs', 'responseCount', 'updatedTime', 'url'],
  func: async (args) => {
    const view = normalizeEnum(args.view, 'list', VIEWS, 'view');
    if (view === 'detail') return detailRecruit(args);
    if (view === 'config') return configRecruit(args);
    return listRecruit(args);
  },
});
