import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'ff14risingstones.web.sdo.com';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMonth(value) {
  const month = String(value ?? '').trim() || currentMonth();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ArgumentError('month must use YYYY-MM format');
  return month;
}

function toText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function assertLoggedIn(payload, commandName) {
  if (payload?.code === 10000) return payload.data;
  if (payload?.code === 10001) return payload.data;
  const msg = String(payload?.msg ?? 'unexpected response');
  if (/登录|登陆|token|auth|unauthorized/i.test(msg) || payload?.code === 10403) throw new AuthRequiredError(HOST, msg);
  throw new CommandExecutionError(`${commandName} API error: ${msg}`);
}

async function requestLoggedInJson(page, path, options = {}) {
  await page.goto(`${WEB_BASE}#/me/info`, { settleMs: 1500 });
  try {
    return await page.evaluate(
      `fetch(${JSON.stringify(`${API_BASE}${path}`)}, ${JSON.stringify({ credentials: 'include', ...options })}).then(async (resp) => {
        const text = await resp.text();
        if (!resp.ok) return { __opencliHttpError: resp.status, text };
        try { return JSON.parse(text); } catch (error) { return { __opencliJsonError: String(error && error.message || error), text }; }
      })`
    );
  } catch (error) {
    const message = String(error?.message || error);
    if (/401|403|登录|登陆|login|auth/i.test(message)) throw new AuthRequiredError(HOST, message);
    throw new CommandExecutionError(`ff14risingstones request failed: ${message}`);
  }
}

async function fetchLoggedInJson(page, path) {
  return requestLoggedInJson(page, path);
}

async function postLoggedInJson(page, path, body) {
  return requestLoggedInJson(page, path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(body).toString(),
  });
}

function randomUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeAction(value) {
  const action = String(value ?? 'status').trim().toLowerCase();
  if (!['status', 'sign'].includes(action)) throw new ArgumentError('action must be one of: status, sign');
  return action;
}

function normalizeRewardRows(data) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((row, index) => ({
    kind: 'reward',
    rank: index + 1,
    date: toText(row.begin_date && row.end_date ? `${row.begin_date}~${row.end_date}` : row.date ?? row.sign_date ?? row.day ?? row.reward_date),
    name: toText(row.item_name ?? row.name ?? row.reward_name ?? row.title ?? row.goods_name),
    count: toNumber(row.num ?? row.count ?? row.reward_num),
    status: toText(row.is_get ?? row.status ?? row.rewardStatus ?? row.is_receive ?? row.isReceived),
    description: toText(row.item_desc ?? row.desc ?? row.description ?? row.remark),
    url: `${WEB_BASE}#/me/signCalendar`,
  }));
}

function normalizeLogRows(data, month) {
  if (data && !Array.isArray(data) && Number.isFinite(Number(data.count))) {
    return [{
      kind: 'log',
      rank: 1,
      date: month,
      name: '月份签到次数',
      count: Number(data.count),
      status: null,
      description: `${month} 已签到 ${Number(data.count)} 天`,
      url: `${WEB_BASE}#/me/signCalendar`,
    }];
  }
  const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.list) ? data.list : [];
  return rows.map((row, index) => ({
    kind: 'log',
    rank: index + 1,
    date: toText(row.date ?? row.sign_date ?? row.signDate ?? row.created_at ?? row.day),
    name: toText(row.name ?? row.reward_name ?? row.title),
    count: toNumber(row.count ?? row.num),
    status: toText(row.status ?? row.sign_status ?? row.is_sign ?? row.isSign),
    description: toText(row.desc ?? row.description ?? row.remark),
    url: `${WEB_BASE}#/me/signCalendar`,
  }));
}

cli({
  site: 'ff14risingstones',
  name: 'checkin',
  description: 'FF14 国服石之家签到状态查看与显式执行签到',
  access: 'write',
  example: 'opencli ff14risingstones checkin --action sign -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'action', type: 'string', default: 'status', help: '操作：status（查看状态）/ sign（执行每日签到）' },
    { name: 'view', type: 'string', default: 'rewards', help: '查看内容：rewards（签到奖励）/ log（签到日志）' },
    { name: 'month', type: 'string', default: '', help: '签到日志月份，格式 YYYY-MM；view=log 时使用' },
  ],
  columns: ['kind', 'rank', 'date', 'name', 'count', 'status', 'description', 'message', 'url'],
  func: async (page, args) => {
    const action = normalizeAction(args.action);
    if (action === 'sign') {
      const tempsuid = randomUuid();
      const payload = await postLoggedInJson(page, `/home/sign/signIn?tempsuid=${encodeURIComponent(tempsuid)}`, { tempsuid });
      if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
      if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
      if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);
      assertLoggedIn(payload, 'ff14risingstones checkin sign');
      return [{
        kind: 'sign',
        rank: 1,
        date: new Date().toISOString().slice(0, 10),
        name: '每日签到',
        count: null,
        status: String(payload.code),
        description: payload.code === 10000 ? '签到成功' : '可能已签到或无需重复签到',
        message: toText(payload.msg),
        url: `${WEB_BASE}#/me/signCalendar`,
      }];
    }

    const view = String(args.view ?? 'rewards').trim().toLowerCase();
    if (!['log', 'rewards'].includes(view)) throw new ArgumentError('view must be one of: log, rewards');

    const month = view === 'log' ? normalizeMonth(args.month) : currentMonth();
    const path = view === 'rewards' ? '/home/sign/signRewardList' : `/home/sign/mySignLog?month=${encodeURIComponent(month)}`;
    const payload = await fetchLoggedInJson(page, path);
    if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
    if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
    if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);

    const data = assertLoggedIn(payload, 'ff14risingstones checkin');
    const rows = view === 'rewards' ? normalizeRewardRows(data) : normalizeLogRows(data, month);
    if (rows.length === 0) throw new EmptyResultError('ff14risingstones checkin', 'API returned no check-in rows');
    return rows.map((row) => ({ ...row, message: null }));
  },
});
