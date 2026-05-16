import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'ff14risingstones.web.sdo.com';

const METRICS = [
  ['system', '系统消息', 'sysNum', '#/message/sys'],
  ['at', '@ 我的', 'atMsgNum', '#/message/at'],
  ['comment', '评论', 'commentMsgNum', '#/message/comment'],
  ['like', '赞和收藏', 'beLikedMsgNum', '#/message/like'],
  ['recruit', '我的招募', 'recruitTip', '#/message/recruit'],
  ['recruitResponse', '我的响应', 'recruitNeTip', '#/message/response'],
  ['recruitParty', '副本招募', 'recruitFbTip', '#/recruit/party'],
  ['recruitGuild', '部队招待', 'recruitGuildTip', '#/recruit/guild'],
  ['recruitOther', '其他招募', 'recruitOtherTip', '#/recruit/others'],
  ['newFans', '新粉丝', 'newFensNum', '#/me/info'],
];

function toCount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function assertLoggedIn(payload) {
  if (payload?.code === 10000 && payload.data && typeof payload.data === 'object') return payload.data;
  const msg = String(payload?.msg ?? 'unexpected response');
  if (/登录|登陆|token|auth|unauthorized/i.test(msg)) throw new AuthRequiredError(HOST, msg);
  throw new CommandExecutionError(`ff14risingstones notifications API error: ${msg}`);
}

async function fetchTip(page) {
  await page.goto(WEB_BASE, { settleMs: 1500 });
  try {
    return await page.evaluate(`fetch(${JSON.stringify(`${API_BASE}/home/sysMsg/getTip`)}, { credentials: 'include' }).then(async (resp) => {
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

cli({
  site: 'ff14risingstones',
  name: 'notifications',
  description: 'FF14 国服石之家当前登录账号消息未读计数',
  access: 'read',
  example: 'opencli ff14risingstones notifications -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [],
  columns: ['key', 'name', 'count', 'url'],
  func: async (page) => {
    const payload = await fetchTip(page);
    if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
    if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
    if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);
    const data = assertLoggedIn(payload);
    return METRICS.map(([key, name, field, route]) => ({
      key,
      name,
      count: toCount(data[field]),
      url: `${WEB_BASE}${route}`,
    }));
  },
});
