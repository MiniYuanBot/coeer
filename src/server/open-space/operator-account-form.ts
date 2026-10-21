import type { Page, BrowserContext, Frame, Locator } from "playwright-core";
import { stdin, stdout } from "node:process";
import { AdapterError } from "./adapters/adapter.js";

export class OperatorUIError extends Error {
  constructor(readonly stage: "LOAD" | "ACCOUNT" | "PASSWORD" | "REMEMBER" | "SUBMIT" | "PROFILE") {
    super(`OFFICIAL_LOGIN_UI_${stage}_FAILED`);
  }
}

/** Use the newly authenticated business page, not a different proxy client. */
export async function loginProfile(context: BrowserContext, baseURL: string, timeout: number) {
  const base = new URL(baseURL);
  if (base.origin !== "http://smart.coe.pku.edu.cn:9091" || base.pathname !== "/meeting/")
    throw new AdapterError("CONFIGURATION");
  const frame = context.pages().flatMap(page => page.frames()).find(frame => {
    try { const url = new URL(frame.url()); return url.origin === base.origin && url.pathname.startsWith(base.pathname); }
    catch { return false; }
  });
  if (!frame) throw new AdapterError("AUTH_EXPIRED");
  return frame.evaluate(async ({ endpoint, timeout }) => {
    const response = await fetch(endpoint, {
      method: "POST", credentials: "same-origin", redirect: "manual", body: "",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      signal: AbortSignal.timeout(timeout),
    });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2097152) throw new Error("RESPONSE_LIMIT");
    return { status: response.status, body: new TextDecoder("utf-8").decode(bytes) };
  }, { endpoint: new URL("head/getList.do", base).href, timeout }).catch(() => { throw new OperatorUIError("PROFILE"); });
}

/** Operator terminal only: neither argv/env nor a file contains the password. */
export async function readHidden(label: string, maximum: number): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) throw new AdapterError("AUTHORIZATION_REQUIRED");
  const previousRaw = stdin.isRaw;
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const timer = setTimeout(() => finish(new AdapterError("TIMEOUT")), 5 * 60000);
    function finish(error?: Error) {
      clearTimeout(timer);
      stdin.removeListener("data", receive);
      stdin.setRawMode(previousRaw);
      stdin.pause();
      stdout.write("\n");
      const result = value;
      value = "";
      if (error) reject(error); else resolve(result);
    }
    function receive(chunk: Buffer) {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\x03" || character === "\x04") {
          finish(new AdapterError("AUTHORIZATION_REQUIRED")); return;
        }
        if (character === "\x7f" || character === "\b") value = value.slice(0, -1);
        else if (character.codePointAt(0)! >= 32 && value.length < maximum) value += character;
        else { finish(new AdapterError("CONFIGURATION")); return; }
      }
    }
    stdin.on("data", receive);
  });
}

/** The observed normal 8500 portal UI, never a constructed credential request. */
export async function submitAccountForm(page: Page, account: string, password: string) {
  const url = new URL(page.url());
  if (url.protocol !== "http:" || url.hostname !== "smart.coe.pku.edu.cn" ||
      url.port !== "8500" || url.pathname !== "/show/" || url.search ||
      !account || account.length > 128 || !password || password.length > 512 ||
      /[\r\n\x00]/.test(account + password)) throw new AdapterError("CONFIGURATION");
  const username = page.locator('input[placeholder="学号/职工号/北大邮箱/手机号"]');
  const secret = page.locator('input[type="password"]');
  const submit = page.locator(".input-btn-row").filter({ hasText: /^\s*登录\s*$/ });
  if (await secret.count() > 1) throw new AdapterError("INVALID_RESPONSE");
  await username.waitFor({ state: "visible", timeout: 30000 }).catch(() => { throw new OperatorUIError("LOAD"); });
  if (await username.count() !== 1 || await secret.count() !== 1 ||
      await submit.count() !== 1) throw new AdapterError("INVALID_RESPONSE");
  // A fresh context has no remembered account. Do not opt into storage.
  const remember = page.locator('input[type="checkbox"]');
  if (await remember.count() === 1 && await remember.isChecked())
    await remember.uncheck().catch(() => { throw new OperatorUIError("REMEMBER"); });
  await username.fill(account).catch(() => { throw new OperatorUIError("ACCOUNT"); });
  await secret.fill(password).catch(() => { throw new OperatorUIError("PASSWORD"); });
  await submit.click().catch(() => { throw new OperatorUIError("SUBMIT"); }); // Exactly once.
}

export const meetingEntryLabels = ["预约会议室", "会议管理", "空间预约", "空间预订",
  ...["会议", "会议室"].flatMap(noun => ["预约", "预定", "预订"].flatMap(verb =>
    [noun + verb, noun + verb + "系统"]))];
function approvedFrames(context: BrowserContext): Frame[] {
  return context.pages().flatMap(page => page.frames()).filter(frame => {
    try {
      const url = new URL(frame.url());
      return url.protocol === "http:" && url.hostname === "smart.coe.pku.edu.cn" &&
        ((url.port === "8500" && (url.pathname === "/show" || url.pathname.startsWith("/show/"))) ||
         (url.port === "9091" && url.pathname.startsWith("/meeting/")));
    } catch { return false; }
  });
}
export async function meetingEntry(context: BrowserContext): Promise<Locator | null> {
  // The observed portal entry reads “预约会议室” (verb before noun).
  // Match the normal page directly as portal routing may change its path.
  const exact: Locator[] = [];
  for (const page of context.pages()) {
    if (new URL(page.url()).origin !== "http://smart.coe.pku.edu.cn:8500") continue;
    const entry = page.getByText("预约会议室", { exact: true });
    for (const match of await entry.all()) if (await match.isVisible()) exact.push(match);
  }
  if (exact.length) return exact.length === 1 ? exact[0]! : null;
  const frames = approvedFrames(context).filter(frame => new URL(frame.url()).port === "8500");
  const found: Locator[] = [];
  for (const frame of frames) for (const label of meetingEntryLabels) {
    const entry = frame.getByText(label, { exact: true });
    if (await entry.count() === 1 && await entry.isVisible()) found.push(entry);
  }
  if (found.length) return found.length === 1 ? found[0]! : null;
  for (const role of ["link", "button", "img"] as const) {
    for (const frame of frames) for (const label of meetingEntryLabels) {
      const entry = frame.getByRole(role, { name: label, exact: true });
      if (await entry.count() === 1 && await entry.isVisible()) found.push(entry);
    }
    if (found.length) return found.length === 1 ? found[0]! : null;
  }
  // Labels vary by portal deployment. Inspect normal visible navigation only;
  // never inspect or manufacture a login URL / ticket.
  for (const frame of frames) {
    const candidates = frame.getByText(/会议|空间/);
    for (const candidate of await candidates.all()) {
      const label = (await candidate.textContent() ?? "").replace(/\s+/g, "");
      if (label.length <= 32 && /^[\u4e00-\u9fff\s（）()]+$/.test(label) &&
          /^(?:会议室?|空间)(?:预约|预定|预订|使用申请|使用预约|申请|管理|借用|资源|服务|系统)*$/.test(label) &&
          await candidate.isVisible()) found.push(candidate);
    }
  }
  return found.length === 1 ? found[0]! : null;
}
export async function contextUIStatus(context: BrowserContext) {
  const frames = approvedFrames(context);
  return { pages: context.pages().length, approvedFrames: frames.length,
    meetingPagePresent: frames.some(frame => new URL(frame.url()).port === "9091"),
    bodyCharacterCounts: await Promise.all(frames.map(frame => frame.locator("body").evaluate(n => (n.textContent ?? "").length))),
    meetingNavigation: await Promise.all(frames.map(async frame =>
      await frame.getByText(/会议|空间/).evaluateAll(nodes => nodes.flatMap(n => {
        const text = (n.textContent ?? "").replace(/\s+/g, "");
        // Return only generic navigation words, never personnel / booking text.
        return text.length <= 32 && /^(?:会议室?|空间)(?:预约|预定|预订|使用申请|使用预约|申请|管理|借用|资源|服务|系统)*$/.test(text) ? [text] : [];
      })))),
    entries: await Promise.all(meetingEntryLabels.map(async label => ({ label,
      count: (await Promise.all(frames.map(frame => frame.getByText(label, { exact: true }).count())))
        .reduce((sum, n) => sum + n, 0) }))),
  };
}
export async function loginUIStatus(page: Page) {
  // Fixed categories only; never return form values, profile text or URL parameters.
  return {
    loginFormVisible: await page.locator('input[type="password"]').isVisible().catch(() => false),
    passwordFieldCount: await page.locator('input[type="password"]').count(),
    passwordChangeRequired: await page.locator("body").evaluate(n =>
      /修改密码|设置新密码|密码过期|初始密码/.test(n.textContent ?? "")),
    portalCategories: await page.locator("body").evaluate(n => {
      const text = n.textContent ?? "";
      return ["首页", "工作台", "应用中心", "个人中心", "账户设置", "修改密码", "空间", "会议", "教室",
        "预约", "登录", "欢迎", "服务", "错误", "网络", "权限", "暂无应用", "暂无数据", "请联系管理员"]
        .filter(word => text.includes(word));
    }),
    meetingEntryCount: await page.getByText("会议预约", { exact: true }).count(),
    networkError: await page.getByText("网络错误", { exact: true }).count() > 0,
    challengeVisible: await page.getByText(/^(验证码|二次验证|MFA)$/).count() > 0,
    accountRejected: await page.locator("body").evaluate(n =>
      /(账号|用户).{0,8}(错误|不存在)|密码.{0,8}(错误|不正确)|登录失败/.test(n.textContent ?? "")),
    entries: await Promise.all(meetingEntryLabels.map(async label => ({ label,
      count: await page.getByText(label, { exact: true }).count() }))),
  };
}
