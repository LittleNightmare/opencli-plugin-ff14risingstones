import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';

const KIND_TO_TYPE = {
  post: '1',
  strat: '2',
};

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

function normalizeKind(value) {
  const kind = String(value ?? 'post').trim().toLowerCase();
  if (!Object.hasOwn(KIND_TO_TYPE, kind)) throw new ArgumentError('kind must be one of: post, strat');
  return kind;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoLike(value) {
  const text = String(value ?? '').trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return text || null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`;
}

function detailUrl(kind, row) {
  const id = String(row.posts_id ?? '').trim();
  const route = kind === 'strat' || String(row.type ?? '') === '2' ? 'strat' : 'post';
  return `${WEB_BASE}#/${route}/detail/${encodeURIComponent(id)}`;
}

async function fetchJson(url) {
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

function extractRows(payload, commandName) {
  if (payload?.code !== 10000) {
    throw new CommandExecutionError(`ff14risingstones API error: ${payload?.msg || 'unexpected response'}`);
  }
  const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
  if (rows.length === 0) throw new EmptyResultError(commandName, 'API returned no posts');
  return rows;
}

cli({
  site: 'ff14risingstones',
  name: 'posts',
  description: 'FF14 国服石之家社区帖子/攻略列表，支持关键词搜索',
  access: 'read',
  example: 'opencli ff14risingstones posts --kind post --limit 10 -f yaml',
  domain: 'apiff14risingstones.web.sdo.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'kind', type: 'string', default: 'post', help: '内容类型：post（社区帖子）/ strat（攻略）' },
    { name: 'query', type: 'string', default: '', help: '关键词；留空时返回对应列表页' },
    { name: 'page', type: 'int', default: 1, help: '页码（1-based）' },
    { name: 'limit', type: 'int', default: 10, help: '返回条数（1-50）' },
  ],
  columns: ['rank', 'postId', 'kind', 'title', 'category', 'author', 'server', 'commentCount', 'readCount', 'likeCount', 'createdTime', 'url'],
  func: async (args) => {
    const kind = normalizeKind(args.kind);
    const type = KIND_TO_TYPE[kind];
    const page = normalizePositiveInteger(args.page, 1, 'page');
    const limit = normalizeLimit(args.limit);
    const query = String(args.query ?? '').trim();

    const url = query ? new URL(`${API_BASE}/common/search`) : new URL(`${API_BASE}/home/posts/postsList`);
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    if (query) {
      url.searchParams.set('keywords', query);
      url.searchParams.set('part_id', '');
      url.searchParams.set('orderBy', 'comment');
      url.searchParams.set('pageTime', '');
    } else {
      url.searchParams.set('is_top', '0');
      url.searchParams.set('is_refine', '0');
      url.searchParams.set('part_id', '');
      url.searchParams.set('hotType', kind === 'post' ? 'postsHotNow' : '');
      url.searchParams.set('order', '');
    }

    const payload = await fetchJson(url);
    const rows = extractRows(payload, 'ff14risingstones posts');
    return rows.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      postId: String(row.posts_id ?? ''),
      kind: String(row.type ?? type) === '2' ? 'strat' : 'post',
      title: String(row.title ?? '').trim(),
      category: String(row.part_name ?? '').trim() || null,
      author: String(row.character_name ?? '').trim() || null,
      server: String(row.area_name ?? '').trim() || null,
      commentCount: toNumber(row.comment_count),
      readCount: toNumber(row.read_count),
      likeCount: toNumber(row.like_count),
      createdTime: toIsoLike(row.created_at),
      url: detailUrl(kind, row),
    }));
  },
});
