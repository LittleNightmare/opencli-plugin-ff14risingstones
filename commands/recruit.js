import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'apiff14risingstones.web.sdo.com';

const VIEWS = new Set(['list', 'detail', 'config']);
const TYPES = new Set(['party', 'beginner', 'guild', 'rp', 'other']);
const CONFIG_KINDS = new Set(['all', 'job', 'style', 'party', 'label', 'guildLabel', 'category', 'area']);
const LABEL_MODES = new Set(['all', 'any']);
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off', '']);
const DAY_ALIASES = {
  '0': '0',
  '7': '0',
  日: '0',
  天: '0',
  周日: '0',
  周天: '0',
  星期日: '0',
  星期天: '0',
  '1': '1',
  一: '1',
  周一: '1',
  星期一: '1',
  '2': '2',
  二: '2',
  周二: '2',
  星期二: '2',
  '3': '3',
  三: '3',
  周三: '3',
  星期三: '3',
  '4': '4',
  四: '4',
  周四: '4',
  星期四: '4',
  '5': '5',
  五: '5',
  周五: '5',
  星期五: '5',
  '6': '6',
  六: '6',
  周六: '6',
  星期六: '6',
};

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
  const code = payload?.code ?? payload?.Code;
  const codeText = String(code ?? '');
  if (codeText === '10000' || codeText === '0') return payload.data ?? payload.Data;
  if (codeText === '10403') throw new AuthRequiredError(HOST, payload?.msg || payload?.Msg || '请先登录');
  throw new CommandExecutionError(`${commandName} API error: ${payload?.msg || payload?.Msg || 'unexpected response'}`);
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

function normalizeFetchPageSize(value) {
  const limit = normalizePositiveInteger(value, 100, 'fetchPageSize');
  if (limit > 100) throw new ArgumentError('fetchPageSize must be <= 100');
  return limit;
}

function normalizeMaxPages(value) {
  const maxPages = normalizePositiveInteger(value, 80, 'maxPages');
  if (maxPages > 80) throw new ArgumentError('maxPages must be <= 80');
  return maxPages;
}

function normalizeBoolean(value, defaultValue, label) {
  const text = String(value ?? defaultValue).trim().toLowerCase();
  if (TRUE_VALUES.has(text)) return true;
  if (FALSE_VALUES.has(text)) return false;
  throw new ArgumentError(`${label} must be a boolean: true/false`);
}

function normalizeId(value) {
  return String(normalizePositiveInteger(value, undefined, 'id'));
}

function csv(value) {
  const text = toText(value);
  if (!text) return null;
  return text.split(',').map((item) => item.trim()).filter(Boolean).join(',') || null;
}

function csvItems(value) {
  const text = csv(value);
  return text ? text.split(',') : [];
}

function numericCsv(value) {
  const items = csvItems(value);
  if (items.length === 0 || items.some((item) => !/^\d+$/.test(item))) return null;
  return items.join(',');
}

function names(items, key) {
  if (!Array.isArray(items)) return null;
  return items.map((item) => toText(item?.[key])).filter(Boolean).join(',') || null;
}

function uniqueJoin(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = toText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result.join(',') || null;
}

function firstMeaningfulText(...values) {
  for (const value of values) {
    const text = stripHtml(value);
    if (text && text !== '0') return text;
  }
  return null;
}

function flattenTeamPosition(teamPosition) {
  if (!teamPosition || typeof teamPosition !== 'object') return [];
  const positions = [];
  for (const [teamKey, teamValue] of Object.entries(teamPosition)) {
    if (!teamValue || typeof teamValue !== 'object') continue;
    for (const [positionKey, positionValue] of Object.entries(teamValue)) {
      const value = toText(positionValue);
      if (!value || value === '0') continue;
      positions.push(`${teamKey}.${positionKey}:${value}`);
    }
  }
  return positions;
}

function occupiedJobIds(row) {
  const ids = [];
  const positionLabels = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4', 'T', 'H'];
  for (const key of positionLabels) {
    const value = toText(row[key]);
    if (value && value !== '0') ids.push(value);
  }
  for (const position of flattenTeamPosition(row.team_position)) {
    const [, value] = position.split(':');
    if (value && value !== '0') ids.push(value);
  }
  return [...new Set(ids)];
}

function summarizePartyJobs(row) {
  const jobNames = Array.isArray(row.jobInfo) ? row.jobInfo.map((item) => item?.value) : [];
  const needJobs = Array.isArray(row.need_job) ? row.need_job.map((item) => String(item)) : [];
  const positionLabels = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4', 'T', 'H'];
  const positions = positionLabels
    .map((key) => {
      const value = toText(row[key]);
      return value && value !== '0' ? `${key}:${value}` : null;
    })
    .filter(Boolean);
  const allJobsHint = needJobs.includes('32') ? ['全部职业'] : [];
  return uniqueJoin([...jobNames, ...allJobsHint, ...needJobs.map((job) => `job:${job}`), ...positions, ...flattenTeamPosition(row.team_position)]);
}

function joinText(...values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = stripHtml(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result.join('\n\n') || null;
}

function rowTextBlob(row) {
  const labels = Array.isArray(row.labelInfo) ? row.labelInfo.flatMap((label) => [label?.id, label?.name]) : [];
  const jobs = Array.isArray(row.jobInfo) ? row.jobInfo.flatMap((job) => [job?.id, job?.value]) : [];
  return [
    row.fb_name,
    row.fb_type,
    row.team_composition,
    row.progress,
    row.strategy,
    row.fb_time,
    row.character_name,
    row.area_name,
    row.group_name,
    row.target_area_name,
    row.target_group_name,
    row.custom_label,
    row.team_detail,
    row.team_detail_mask,
    row.recruit_require,
    row.recruit_require_mask,
    row.strategy_desc,
    row.strategy_desc_mask,
    row.contact_info_mask,
    ...labels,
    ...jobs,
    ...(Array.isArray(row.need_job) ? row.need_job : []),
    ...occupiedJobIds(row),
  ]
    .map((value) => stripHtml(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function rowLabelValues(row) {
  return [
    ...(Array.isArray(row.label) ? row.label : []),
    ...(Array.isArray(row.labelInfo) ? row.labelInfo.flatMap((label) => [label?.id, label?.name]) : []),
    row.custom_label,
  ]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function matchesLabelMode(row, labels, mode) {
  if (labels.length === 0) return true;
  const values = rowLabelValues(row);
  const matchesOne = (label) => values.some((value) => (/^\d+$/.test(label) ? value === label : value === label || value.includes(label)));
  return mode === 'any' ? labels.some(matchesOne) : labels.every(matchesOne);
}

function matchesTextFilter(row, filterText, fields) {
  const tokens = csvItems(filterText).map((item) => item.toLowerCase());
  if (tokens.length === 0) return true;
  const text = fields.map((field) => stripHtml(row[field])).filter(Boolean).join(' ').toLowerCase();
  return tokens.every((token) => text.includes(token));
}

function matchesExcludeText(row, excludeText) {
  const tokens = csvItems(excludeText).map((item) => item.toLowerCase());
  if (tokens.length === 0) return true;
  const text = rowTextBlob(row);
  return tokens.every((token) => !text.includes(token));
}

function normalizeDay(value) {
  return DAY_ALIASES[String(value ?? '').trim()] ?? null;
}

function normalizeTimeDays(value) {
  const items = csvItems(value);
  const days = [];
  for (const item of items) {
    const day = normalizeDay(item);
    if (!day) throw new ArgumentError(`timeDays contains invalid day: ${item}`);
    days.push(day);
  }
  return days;
}

function parseHour(value, label, mode) {
  const text = toText(value);
  if (!text) return null;
  const n = Number(text.replace(':00', ''));
  if (!Number.isFinite(n) || n < 0 || n > 30) throw new ArgumentError(`${label} must be an hour between 0 and 30`);
  if (mode === 'end' && n > 0 && n <= 6) return n + 24;
  if (mode === 'end' && n === 0) return 24;
  return n;
}

function parseTimeRanges(value) {
  const text = String(value ?? '').replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248));
  const ranges = [];
  const pattern = /(凌晨|早上|上午|中午|下午|晚上|晚|夜里|夜)?\s*(\d{1,2})(?:[:：.](\d{1,2}))?(?:点)?\s*(?:-|—|–|~|～|到|至)\s*(\d{1,2})(?:[:：.](\d{1,2}))?(?:点)?/g;
  for (const match of text.matchAll(pattern)) {
    const prefix = match[1] ?? '';
    const start = normalizeRangeHour(Number(match[2]), Number(match[3] ?? 0), prefix, true);
    const endRaw = normalizeRangeHour(Number(match[4]), Number(match[5] ?? 0), prefix, false);
    const end = endRaw <= start ? endRaw + 24 : endRaw;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 16) ranges.push({ start, end });
  }
  return ranges;
}

function normalizeRangeHour(hour, minute, prefix, isStart) {
  if (hour > 24 || minute >= 60) return Number.NaN;
  const afternoon = ['下午', '晚上', '晚', '夜里', '夜'].includes(prefix);
  if (afternoon && (hour < 12 || (!isStart && hour === 12))) return hour + 12 + minute / 60;
  if (prefix === '中午' && hour < 11) return hour + 12 + minute / 60;
  return hour + minute / 60;
}

function rowMentionsDay(text, day) {
  if (!day) return true;
  if (day === '0') return /周日|周天|星期日|星期天|礼拜日|礼拜天|周末|双休|每天|每日|每晚|天天/.test(text);
  const cn = ['日', '一', '二', '三', '四', '五', '六'][Number(day)];
  if (new RegExp(`周${cn}|星期${cn}|礼拜${cn}|每天|每日|每晚|天天`).test(text)) return true;
  if (['1', '2', '3', '4', '5'].includes(day) && /工作日|平日|周一到周五|周一至周五/.test(text)) return true;
  if (['6', '0'].includes(day) && /周末|双休/.test(text)) return true;
  return false;
}

function matchesTimeFilters(row, args) {
  const rawTime = String(row.fb_time ?? row.open_time ?? row.weekday_time ?? row.weekend_time ?? '');
  const timeText = toText(args.timeText);
  if (timeText && !rawTime.toLowerCase().includes(timeText.toLowerCase())) return false;
  const timeDays = normalizeTimeDays(args.timeDays);
  if (timeDays.length > 0 && !timeDays.some((day) => rowMentionsDay(rawTime, day))) return false;
  const start = parseHour(args.timeStart, 'timeStart', 'start');
  const end = parseHour(args.timeEnd, 'timeEnd', 'end');
  const dailyMaxHours = toText(args.dailyMaxHours) ? Number(args.dailyMaxHours) : null;
  const wantsParsedTime = start !== null || end !== null || dailyMaxHours !== null;
  if (!wantsParsedTime) return true;
  if (dailyMaxHours !== null && (!Number.isFinite(dailyMaxHours) || dailyMaxHours <= 0 || dailyMaxHours > 24)) {
    throw new ArgumentError('dailyMaxHours must be a positive number <= 24');
  }
  const ranges = parseTimeRanges(rawTime);
  if (ranges.length === 0) return normalizeBoolean(args.showUnparsedTime, false, 'showUnparsedTime');
  return ranges.every((range) => {
    if (start !== null && range.start < start) return false;
    if (end !== null && range.end > end) return false;
    if (dailyMaxHours !== null && range.end - range.start > dailyMaxHours) return false;
    return true;
  });
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
  const jobNames = type === 'party' ? summarizePartyJobs(row) : names(row.jobInfo, 'value');
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
    summary: firstMeaningfulText(row.progress, row.profile, row.strategy, row.detail_mask, row.fb_time),
    detail: joinText(row.team_detail, row.team_detail_mask, row.detail_mask),
    requirements: joinText(row.recruit_require, row.recruit_require_mask, row.strategy_desc, row.strategy_desc_mask, row.contact_info_mask),
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
    params.label = numericCsv(args.label);
    params.team_composition = toText(args.team);
    params.son_team_key = toText(args.sonTeamKey) ?? toText(args.alliance);
    params.son_team_position = toText(args.sonTeamPosition);
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

function matchesNoDuplicateJobs(row, jobFilter, enabled) {
  if (!enabled) return true;
  const selectedIds = csvItems(jobFilter).filter((item) => /^\d+$/.test(item));
  if (selectedIds.length === 0) return true;
  const occupied = occupiedJobIds(row);
  return selectedIds.every((id) => !occupied.includes(id));
}

function applyPartyLocalFilters(rows, args) {
  const labelMode = normalizeEnum(args.labelMode, 'all', LABEL_MODES, 'labelMode');
  const localLabels = csvItems(args.label).map((item) => item.toLowerCase());
  const noDuplicateJobs = normalizeBoolean(args.noDuplicateJobs, false, 'noDuplicateJobs');
  return rows.filter((row) => {
    if (!matchesJob(row, csv(args.job))) return false;
    if (!matchesNoDuplicateJobs(row, args.job, noDuplicateJobs)) return false;
    if (!matchesLabelMode(row, localLabels, labelMode)) return false;
    if (!matchesTextFilter(row, args.progressText, ['progress'])) return false;
    if (!matchesTextFilter(row, args.strategyText, ['strategy', 'strategy_desc', 'strategy_desc_mask', 'recruit_require', 'recruit_require_mask'])) return false;
    if (!matchesExcludeText(row, args.excludeText)) return false;
    if (!matchesTimeFilters(row, args)) return false;
    return true;
  });
}

function uniqueRowsById(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = toText(row.id) ?? JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

async function fetchListRows(type, args, page, fetchLimit) {
  const payload = await fetchJson(LIST_ENDPOINTS[type], buildListParams(type, args, page, fetchLimit));
  const data = assertSuccess(payload, `ff14risingstones recruit ${type} list`);
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    count: toNumber(data?.count),
  };
}

async function collectListRows(type, args, page, limit) {
  const allPages = type === 'party' && normalizeBoolean(args.allPages, false, 'allPages');
  if (!allPages) return fetchListRows(type, args, page, limit);

  const fetchPageSize = normalizeFetchPageSize(args.fetchPageSize);
  const maxPages = normalizeMaxPages(args.maxPages);
  const collected = [];
  let expectedCount = null;
  let expectedRemaining = null;
  for (let currentPage = page; currentPage < page + maxPages; currentPage += 1) {
    const { rows, count } = await fetchListRows(type, args, currentPage, fetchPageSize);
    if (expectedCount === null && count !== null) {
      expectedCount = count;
      expectedRemaining = Math.max(count - (page - 1) * fetchPageSize, 0);
    }
    if (rows.length === 0) break;
    collected.push(...rows);
    if (expectedRemaining !== null && collected.length >= expectedRemaining) break;
  }
  return { rows: uniqueRowsById(collected), count: expectedCount };
}

async function listRecruit(args) {
  const type = normalizeEnum(args.type, 'party', TYPES, 'type');
  if (type === 'guild') throw new ArgumentError('type guild requires login; use recruit-guild instead');
  const page = normalizePositiveInteger(args.page, 1, 'page');
  const limit = normalizeLimit(args.limit);
  const localOnlyFilter = type === 'party' && (csv(args.job) || toText(args.label) || toText(args.excludeText) || toText(args.progressText) || toText(args.strategyText) || toText(args.timeText) || toText(args.timeStart) || toText(args.timeEnd) || toText(args.timeDays) || toText(args.dailyMaxHours) || normalizeBoolean(args.noDuplicateJobs, false, 'noDuplicateJobs'));
  const fetchLimit = localOnlyFilter ? Math.max(limit, 50) : limit;
  const data = await collectListRows(type, args, page, fetchLimit);
  const rows = type === 'party' ? applyPartyLocalFilters(data.rows, args) : data.rows;
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
    const rowCategory = toText(item.fb_type ?? item.team_composition ?? item.category ?? item.type) ?? category;
    const summary = [
      item.team_composition ? `team=${toText(item.team_composition)}` : null,
      item.weight !== undefined ? `weight=${toText(item.weight)}` : null,
    ].filter(Boolean).join(', ') || null;
    pushConfigRow(rows, {
      view: 'config',
      type,
      rank: rows.length + 1,
      recruitId: toText(item.id ?? item.AreaID),
      title: toText(item[titleKey] ?? item.AreaName),
      category: rowCategory,
      author: null,
      server: null,
      targetServer: null,
      summary,
      detail: null,
      requirements: null,
      schedule: null,
      tags: null,
      jobs: null,
      responseCount: null,
      updatedTime: null,
      url: type === 'style' ? route('beginner') : route('party'),
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
    { name: 'sonTeamKey', type: 'string', default: '', help: 'party 团队阵营键，如 A/B/C；参考网页 team_position 矩阵' },
    { name: 'alliance', type: 'string', default: '', help: 'sonTeamKey 的别名，如 A/B/C' },
    { name: 'sonTeamPosition', type: 'string', default: '', help: 'party 团队阵营内位置编号；配合 sonTeamKey 使用' },
    { name: 'allPages', type: 'string', default: 'false', help: 'party 是否按 count 自动翻页聚合后再本地筛选：true/false' },
    { name: 'fetchPageSize', type: 'int', default: 100, help: 'party allPages 每页抓取条数（1-100）' },
    { name: 'maxPages', type: 'int', default: 80, help: 'party allPages 最多抓取页数（1-80）' },
    { name: 'labelMode', type: 'string', default: 'all', help: 'party 本地标签匹配模式：all/any；配合 label 使用' },
    { name: 'progressText', type: 'string', default: '', help: 'party 本地过滤进度文本，多个关键词用逗号分隔且都需命中' },
    { name: 'strategyText', type: 'string', default: '', help: 'party 本地过滤攻略/要求文本，多个关键词用逗号分隔且都需命中' },
    { name: 'excludeText', type: 'string', default: '', help: 'party 本地排除关键词，多个用逗号分隔，命中任一关键词即排除' },
    { name: 'timeText', type: 'string', default: '', help: 'party 本地活动时间文本过滤' },
    { name: 'timeStart', type: 'string', default: '', help: 'party 本地时间下限小时，如 20 或 20:00' },
    { name: 'timeEnd', type: 'string', default: '', help: 'party 本地时间上限小时，如 24 或 1（凌晨会按次日处理）' },
    { name: 'timeDays', type: 'string', default: '', help: 'party 本地星期过滤，如 1,3,5 或 周一,周三' },
    { name: 'dailyMaxHours', type: 'string', default: '', help: 'party 本地每日活动时长上限（小时）' },
    { name: 'showUnparsedTime', type: 'string', default: 'false', help: 'party 时间条件存在但无法解析时是否保留：true/false' },
    { name: 'noDuplicateJobs', type: 'string', default: 'false', help: 'party 配合 job 使用，排除队内位置已占用相同职业 ID 的招募：true/false' },
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
