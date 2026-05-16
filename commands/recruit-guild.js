import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'ff14risingstones.web.sdo.com';
const VIEWS = new Set(['list', 'detail']);

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

function normalizeView(value) {
  const view = String(value ?? 'list').trim().toLowerCase();
  if (!VIEWS.has(view)) throw new ArgumentError('view must be one of: list, detail');
  return view;
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

function csv(value) {
  const text = toText(value);
  if (!text) return null;
  return text.split(',').map((item) => item.trim()).filter(Boolean).join(',') || null;
}

function names(items, key) {
  if (!Array.isArray(items)) return null;
  return items.map((item) => toText(item?.[key])).filter(Boolean).join(',') || null;
}

function assertLoggedIn(payload, commandName) {
  if (payload?.code === 10000) return payload.data;
  const msg = String(payload?.msg ?? 'unexpected response');
  if (/登录|登陆|token|auth|unauthorized/i.test(msg) || payload?.code === 10403) throw new AuthRequiredError(HOST, msg);
  throw new CommandExecutionError(`${commandName} API error: ${msg}`);
}

async function requestLoggedInJson(page, path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  await page.goto(`${WEB_BASE}#/recruit/guild`, { settleMs: 1500 });
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

function checkedPayload(payload) {
  if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
  if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
  if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);
  return payload;
}

function detailUrl(id) {
  return `${WEB_BASE}#/recruit/guild/detail/${encodeURIComponent(id)}`;
}

function makeGuildRow(view, row, rank) {
  const recruitId = toText(row.id);
  const title = toText(row.guild_name ?? row.title);
  const labelNames = names(row.labelInfo, 'name');
  const schedule = [toText(row.weekday_time), toText(row.weekend_time)].filter(Boolean).join(' / ') || null;

  return {
    view,
    type: 'guild',
    rank,
    recruitId,
    title,
    category: toText(row.guild_tag ?? row.active_member_num ?? row.target_recruit_num),
    author: toText(row.character_name),
    server: [toText(row.area_name), toText(row.group_name)].filter(Boolean).join('/') || null,
    targetServer: [toText(row.target_area_name), toText(row.target_group_name)].filter(Boolean).join('/') || null,
    summary: stripHtml(row.detail_mask ?? row.guild_address),
    detail: stripHtml(row.detail_mask),
    requirements: null,
    schedule,
    tags: labelNames ?? toText(row.custom_label),
    jobs: null,
    responseCount: toNumber(row.response_num ?? row.target_recruit_num),
    updatedTime: toTimeText(row.updated_at ?? row.sort_updated_time ?? row.polish_time ?? row.created_at),
    url: recruitId ? detailUrl(recruitId) : `${WEB_BASE}#/recruit/guild`,
  };
}

function buildListParams(args, page, limit) {
  const params = {
    page,
    limit,
    guild_name: toText(args.query),
    active_member_num: csv(args.activeMemberNum),
    label: csv(args.label),
  };
  const areaId = toText(args.areaId);
  const groupId = toText(args.groupId);
  if (areaId) {
    params.target_area_id = areaId;
    if (groupId) params.target_group_id = groupId;
  }
  return params;
}

async function listGuild(page, args) {
  const pageNumber = normalizePositiveInteger(args.page, 1, 'page');
  const limit = normalizeLimit(args.limit);
  const payload = checkedPayload(await requestLoggedInJson(page, '/home/recruit/recruitGuildList', buildListParams(args, pageNumber, limit)));
  const data = assertLoggedIn(payload, 'ff14risingstones recruit-guild list');
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  if (rows.length === 0) throw new EmptyResultError('ff14risingstones recruit-guild', 'API returned no guild recruit rows');
  return rows.slice(0, limit).map((row, index) => makeGuildRow('list', row, index + 1));
}

async function detailGuild(page, args) {
  const id = String(normalizePositiveInteger(args.id, undefined, 'id'));
  const payload = checkedPayload(await requestLoggedInJson(page, '/home/recruit/getRecruitGuildDetail', { id }));
  const row = assertLoggedIn(payload, 'ff14risingstones recruit-guild detail');
  if (!row?.id) throw new EmptyResultError('ff14risingstones recruit-guild', 'API returned no guild recruit detail');
  return [makeGuildRow('detail', row, 1)];
}

cli({
  site: 'ff14risingstones',
  name: 'recruit-guild',
  description: 'FF14 国服石之家部队招待列表/详情（需要 Chrome 登录态）',
  access: 'read',
  example: 'opencli ff14risingstones recruit-guild --view list --query 部队 --limit 5 -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'view', type: 'string', default: 'list', help: '查看内容：list（部队招待列表）/ detail（单条详情）' },
    { name: 'id', type: 'int', default: 0, help: '部队招待 ID；view=detail 时必填' },
    { name: 'page', type: 'int', default: 1, help: '页码（1-based）；view=list 使用' },
    { name: 'limit', type: 'int', default: 10, help: '返回条数（1-50）；view=list 使用' },
    { name: 'query', type: 'string', default: '', help: '按部队名称过滤' },
    { name: 'areaId', type: 'string', default: '', help: '目标大区 ID；可用 recruit --view config --kind area 查看' },
    { name: 'groupId', type: 'string', default: '', help: '目标服务器 ID；配合 areaId 使用' },
    { name: 'label', type: 'string', default: '', help: '部队标签 ID，多个用逗号分隔；可用 recruit --view config --kind guildLabel 查看' },
    { name: 'activeMemberNum', type: 'string', default: '', help: '活跃人数区间，多个用逗号分隔，例如 1-5,6-20' },
  ],
  columns: ['view', 'type', 'rank', 'recruitId', 'title', 'category', 'author', 'server', 'targetServer', 'summary', 'detail', 'requirements', 'schedule', 'tags', 'jobs', 'responseCount', 'updatedTime', 'url'],
  func: async (page, args) => {
    const view = normalizeView(args.view);
    if (view === 'detail') return detailGuild(page, args);
    return listGuild(page, args);
  },
});
