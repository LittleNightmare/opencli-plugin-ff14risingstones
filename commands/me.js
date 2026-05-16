import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const API_BASE = 'https://apiff14risingstones.web.sdo.com/api';
const WEB_BASE = 'https://ff14risingstones.web.sdo.com/pc/index.html';
const HOST = 'ff14risingstones.web.sdo.com';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function assertLoggedIn(payload, commandName) {
  if (payload?.code === 10000 && payload.data && typeof payload.data === 'object') return payload.data;
  const msg = String(payload?.msg ?? 'unexpected response');
  if (/登录|登陆|token|auth|unauthorized/i.test(msg)) throw new AuthRequiredError(HOST, msg);
  throw new CommandExecutionError(`${commandName} API error: ${msg}`);
}

async function fetchLoggedInJson(page, path) {
  await page.goto(`${WEB_BASE}#/me/info`, { settleMs: 1500 });
  try {
    return await page.evaluate(`fetch(${JSON.stringify(`${API_BASE}${path}`)}, { credentials: 'include' }).then(async (resp) => {
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
  name: 'me',
  description: 'FF14 国服石之家当前登录角色档案',
  access: 'read',
  example: 'opencli ff14risingstones me -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [],
  columns: ['uuid', 'characterName', 'areaName', 'groupName', 'experience', 'followCount', 'fanCount', 'likedCount', 'createDate', 'lastLoginDate', 'playTime', 'url'],
  func: async (page) => {
    const payload = await fetchLoggedInJson(page, '/home/userInfo/getUserInfo');
    if (payload?.__opencliHttpError === 401 || payload?.__opencliHttpError === 403) throw new AuthRequiredError(HOST, `HTTP ${payload.__opencliHttpError}`);
    if (payload?.__opencliHttpError) throw new CommandExecutionError(`ff14risingstones request failed: HTTP ${payload.__opencliHttpError}`);
    if (payload?.__opencliJsonError) throw new CommandExecutionError(`ff14risingstones returned invalid JSON: ${payload.__opencliJsonError}`);
    const data = assertLoggedIn(payload, 'ff14risingstones me');
    const detail = Array.isArray(data.characterDetail) ? data.characterDetail[0] : null;
    if (!data.uuid || !data.character_name) throw new EmptyResultError('ff14risingstones me', 'Current login has no bound character profile');

    return [{
      uuid: String(data.uuid),
      characterName: toText(data.character_name),
      areaName: toText(data.area_name),
      groupName: toText(data.group_name),
      experience: toNumber(data.experience),
      followCount: toNumber(data.followFansiNum?.followNum),
      fanCount: toNumber(data.followFansiNum?.fansNum),
      likedCount: toNumber(data.beLikedNum),
      createDate: toText(detail?.create_time),
      lastLoginDate: toText(detail?.last_login_time),
      playTime: toText(detail?.play_time),
      url: `${WEB_BASE}#/me/info`,
    }];
  },
});
