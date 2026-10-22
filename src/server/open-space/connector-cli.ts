/** Operator-only CLI. Never connects to MCP/CDP or an existing browser profile. */
import { existsSync } from "node:fs";
import { assertBookingEnvironment } from './environment.js';
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomUUID } from "node:crypto";
import { loadOfficialConfig } from "./adapters/official/config.js";
import {
  ManagedSession,
  ensureSessionKey,
  saveSession,
  atomicPrivateJSON,
  safeBusinessCookies,
} from "./adapters/official/session.js";
import { OfficialHTTP } from "./adapters/official/http.js";
import { parseJSON, object, text } from "./adapters/official/parsers.js";
import { AdapterError } from "./adapters/adapter.js";
import { operatorLoginProxy, operatorLoginURL } from "./operator-proxy.js";
import {
  readHidden,
  submitAccountForm,
  loginUIStatus,
  OperatorUIError,
  meetingEntry,
  contextUIStatus,
  loginProfile,
} from "./operator-account-form.js";
import {
  AuthenticationRecovery,
  loadAccountCredentials,
  loginAuthorizedAccount,
  saveAccountCredentials,
} from "./adapters/official/recovery.js";
if (process.env.BOOKING_EXTRA_ENV_FILE)
  process.loadEnvFile(process.env.BOOKING_EXTRA_ENV_FILE);
assertBookingEnvironment();
const configPath = process.env.CAMPUS_API_CONFIG_FILE,
  sessionPath = process.env.CAMPUS_COOKIE_FILE,
  keyPath = process.env.CAMPUS_COOKIE_KEY_FILE;
async function main() {
  if (!configPath || !sessionPath || !keyPath)
    throw new AdapterError("CONFIGURATION");
  const config = loadOfficialConfig(configPath);
  if (config.allowHTTP && process.env.CAMPUS_ALLOW_HTTP !== "true")
    throw new AdapterError("AUTHORIZATION_REQUIRED");
  const command = process.argv[2];
  const proxy = operatorLoginProxy(
    process.env.CAMPUS_LOGIN_PROXY_URL,
    command,
  );
  const enroll = process.argv.includes("--enroll");
  if (!config.account.profileUserId && !(command === "login" && enroll))
    throw new AdapterError("CONFIGURATION");
  if (command === "credentials") {
    if (
      !stdin.isTTY ||
      process.env.CAMPUS_AUTO_RELOGIN !== "true" ||
      !process.env.CAMPUS_ACCOUNT_FILE ||
      !process.env.CAMPUS_ACCOUNT_KEY_FILE
    )
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    let username = await readHidden("自动恢复的官方账号（不回显）：", 128);
    let password = await readHidden(
      "自动恢复的官方密码（不回显，加密保存）：",
      512,
    );
    try {
      ensureSessionKey(process.env.CAMPUS_ACCOUNT_KEY_FILE);
      saveAccountCredentials(
        process.env.CAMPUS_ACCOUNT_FILE,
        process.env.CAMPUS_ACCOUNT_KEY_FILE,
        { accountAlias: config.account.alias, username, password },
      );
    } finally {
      username = "";
      password = "";
    }
    console.log('{"event":"connector.credentials_enrolled"}');
  } else if (command === "login") {
    if (!stdin.isTTY || process.env.CAMPUS_ALLOW_INTERACTIVE_LOGIN !== "true")
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      headless:
        process.argv.includes("--headless") &&
        process.argv.includes("--account-form"),
      executablePath: process.env.CAMPUS_BROWSER_EXECUTABLE || undefined,
      channel: process.env.CAMPUS_BROWSER_EXECUTABLE
        ? undefined
        : existsSync("/Applications/Google Chrome.app")
          ? "chrome"
          : undefined,
    });
    try {
      const context = await browser.newContext({
        acceptDownloads: false,
        proxy,
      });
      const socketPaths = new Set<string>();
      context.setDefaultTimeout(10000);
      const page = await context.newPage();
      page.on("websocket", (socket) => {
        const url = new URL(socket.url());
        if (
          url.hostname === "smart.coe.pku.edu.cn" &&
          url.port === "8500" &&
          /^\/[A-Za-z0-9-]+-service\/apiSvc\/_ws$/.test(url.pathname)
        )
          socketPaths.add(url.pathname);
      });
      await page.goto(
        operatorLoginURL(
          config.baseURL,
          process.env.CAMPUS_LOGIN_URL,
          process.env.CAMPUS_LOGIN_ORIGIN,
        ),
        {
          waitUntil: "domcontentloaded",
        },
      );
      if (process.argv.includes("--account-form")) {
        if (!config.allowHTTP)
          throw new AdapterError("AUTHORIZATION_REQUIRED");
        await page
          .locator('input[placeholder="学号/职工号/北大邮箱/手机号"]')
          .waitFor({
            state: "visible",
            timeout: 30000,
          })
          .catch(() => {
            throw new OperatorUIError("LOAD");
          });
        let account = await readHidden("官方业务账号（不回显）：", 128);
        let password = await readHidden(
          "官方业务密码（不回显，仅本次内存使用）：",
          512,
        );
        try {
          await submitAccountForm(page, account, password);
        } finally {
          account = "";
          password = "";
        }
        console.log(
          "正常登录表单已提交一次；验证码或 MFA 请在官方页面人工完成。",
        );
        const formHidden = await page
          .locator('input[type="password"]')
          .waitFor({ state: "hidden", timeout: 15000 })
          .then(
            () => true,
            () => false,
          );
        const state = await loginUIStatus(page);
        console.log(JSON.stringify(state));
        if (
          formHidden &&
          !state.challengeVisible &&
          !state.passwordChangeRequired &&
          !state.accountRejected
        ) {
          const entry = await meetingEntry(context);
          if (entry) {
            await entry.click();
            console.log("已通过正常门户导航打开会议系统；尚未执行预约操作。");
          }
        }
      }
      console.log(
        "请在新打开的独立浏览器中，使用获准服务账号完成官方登录、验证码或 MFA。不要进行预约操作。",
      );
      const prompt = createInterface({ input: stdin, output: stdout });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15 * 60000);
      try {
        let action: string;
        do {
          action = await prompt.question(
            "进入会议列表后按 Enter 核对；STATUS 只查页面状态；MEETING 打开唯一会议预约入口：",
            { signal: controller.signal },
          );
          if (action === "STATUS")
            console.log(
              JSON.stringify({
                ...(await loginUIStatus(page)),
                ...(await contextUIStatus(context)),
                socketPaths: [...socketPaths],
              }),
            );
          else if (action === "MEETING") {
            const entry = await meetingEntry(context);
            if (entry) await entry.click();
            else console.log("MEETING_ENTRY_REQUIRES_OPERATOR");
          } else if (
            action === "REFRESH" &&
            new URL(page.url()).origin === process.env.CAMPUS_LOGIN_ORIGIN
          ) {
            await page.reload({ waitUntil: "domcontentloaded" });
          } else if (action) throw new AdapterError("CONFIGURATION");
        } while (action);
        if (
          enroll &&
          !config.account.profileUserId &&
          (await prompt.question(
            "确认这是管理方获准的原测试账号？输入 ENROLL 登记此账号的内部 ID：",
            { signal: controller.signal },
          )) !== "ENROLL"
        )
          throw new AdapterError("AUTHORIZATION_REQUIRED");
      } finally {
        clearTimeout(timer);
        prompt.close();
      }
      // Same verified read endpoint; no guessed credential POST or automatic MFA handling.
      const profile = await loginProfile(
        context,
        config.baseURL,
        config.requestTimeoutMs,
      );
      const body = profile.body;
      if ((profile.status >= 300 && profile.status < 400) || /^\s*</.test(body))
        throw new AdapterError("AUTH_EXPIRED");
      const json = parseJSON(body);
      if (
        profile.status !== 200 ||
        !Array.isArray(json.list) ||
        json.list.length !== 1
      )
        throw new AdapterError("AUTH_EXPIRED");
      const identity = object(json.list[0]),
        userId = text(identity.USER_ID);
      if (
        config.account.profileUserId &&
        userId !== config.account.profileUserId
      )
        throw new AdapterError("FORBIDDEN");
      if (!config.account.profileUserId) {
        if (
          config.writes.enabled ||
          config.writes.authorization ||
          !/^[-A-Za-z0-9_.:]{1,128}$/.test(userId)
        )
          throw new AdapterError("CONFIGURATION");
        config.account.profileUserId = userId;
        const staffId =
          typeof identity.STAFF_ID === "string" ? identity.STAFF_ID : "";
        if (/^[-A-Za-z0-9_.:]{1,128}$/.test(staffId))
          config.account.bookingPersonId = staffId;
        atomicPrivateJSON(configPath, config);
      }
      const host = new URL(config.baseURL).hostname;
      const applicableCookies = (await context.cookies(config.baseURL))
        .filter((c) => c.domain.replace(/^\./, "") === host)
        .map(
          ({
            name,
            value,
            domain,
            path,
            expires,
            secure,
            httpOnly,
            sameSite,
          }) => ({
            name,
            value,
            domain,
            path,
            expires,
            secure,
            httpOnly,
            sameSite,
          }),
        );
      const cookies = safeBusinessCookies(applicableCookies, host);
      console.log(
        JSON.stringify({
          authenticationIdentityVerified: true,
          retainedBusinessCookieCount: cookies.length,
          excludedUnsafeCookieCount: applicableCookies.length - cookies.length,
        }),
      );
      if (!cookies.length) throw new AdapterError("AUTH_EXPIRED");
      ensureSessionKey(keyPath);
      const now = Date.now();
      saveSession(sessionPath, keyPath, {
        version: 1,
        revision: randomUUID(),
        accountAlias: config.account.alias,
        issuedAt: now,
        expiresAt: now + 8 * 3600000,
        cookies,
      });
      console.log(
        "身份匹配，会话已加密保存。服务器需执行只读连接检查；自动写入不会因此开启。",
      );
    } finally {
      await browser.close();
    }
  } else if (command === "auto-probe") {
    if (
      process.env.CAMPUS_AUTO_RELOGIN !== "true" ||
      !process.env.CAMPUS_ACCOUNT_FILE ||
      !process.env.CAMPUS_ACCOUNT_KEY_FILE ||
      !process.env.CAMPUS_RELOGIN_STATE_FILE
    )
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    const manager = new ManagedSession(config, sessionPath, keyPath, true),
      http = new OfficialHTTP(config, manager.provider);
    const probe = async () => {
      manager.provider.reset!();
      const response = await (await http.session()).request("profile", {}, {}),
        json = parseJSON(response.body);
      if (
        !Array.isArray(json.list) ||
        json.list.length !== 1 ||
        text(object(json.list[0]).USER_ID) !== config.account.profileUserId
      )
        throw new AdapterError("FORBIDDEN");
      http.verified();
    };
    const credentials = loadAccountCredentials(
      process.env.CAMPUS_ACCOUNT_FILE,
      process.env.CAMPUS_ACCOUNT_KEY_FILE,
      config.account.alias,
    );
    const recovery = new AuthenticationRecovery({
      config,
      manager,
      sessionPath,
      keyPath,
      statePath: process.env.CAMPUS_RELOGIN_STATE_FILE,
      probe,
      login: () => loginAuthorizedAccount(config, credentials),
    });
    await recovery.beforeRead();
    console.log(
      JSON.stringify({
        event: "connector.automatic_probe",
        authentication: manager.diagnostics().authentication,
        automaticLoginOccurred: recovery.diagnostics().lastRecoveredAt !== null,
      }),
    );
  } else if (command === "probe") {
    const manager = new ManagedSession(config, sessionPath, keyPath),
      http = new OfficialHTTP(config, manager.provider);
    const response = await (await http.session()).request("profile", {}, {});
    const json = parseJSON(response.body);
    if (
      !Array.isArray(json.list) ||
      json.list.length !== 1 ||
      text(object(json.list[0]).USER_ID) !== config.account.profileUserId
    )
      throw new AdapterError("FORBIDDEN");
    http.verified();
    console.log(JSON.stringify(http.diagnostics()));
  } else throw new AdapterError("CONFIGURATION");
}
try {
  await main();
} catch (e) {
  console.error(
    e instanceof AdapterError
      ? e.code
      : e instanceof OperatorUIError
        ? e.message
        : "CONNECTOR_OPERATION_FAILED",
  );
  process.exitCode = 1;
}
