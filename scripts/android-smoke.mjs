import { execFileSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { _android as android } from "../frontend/node_modules/playwright-core/index.mjs";

const output = "android-artifacts";
const packageId = "com.ericaystudio.kadi.pilot";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const adb = (...args) =>
  execFileSync("adb", args, { encoding: "utf8", timeout: 30000 }).trim();
const isKadiResumed = () => {
  const lines = adb("shell", "dumpsys", "activity", "activities").split("\n").filter(line => /(?:topResumedActivity=|mResumedActivity:)/.test(line));
  assert.ok(lines.length, "Android must report its resumed activity");
  return lines.some(line => line.includes(packageId + "/"));
};
const screenshot = async (name) => {
  // WebView DOM updates can precede Android's next surface composition.
  await pause(400);
  return writeFile(
    output + "/" + name + ".png",
    execFileSync("adb", ["exec-out", "screencap", "-p"]),
  );
};
await mkdir(output, { recursive: true });
adb(
  "install",
  "-r",
  "frontend/android/smoke-recipient/build/outputs/apk/debug/smoke-recipient-debug.apk",
);
adb("install", "-r", output + "/Kadi-Android-pilote.apk");
adb(
  "shell",
  "am",
  "start",
  "-n",
  packageId + "/com.ericaystudio.kadi.MainActivity",
);
await pause(2000);
await screenshot("android-start");
let device;
try {
  const devices = await android.devices({ omitDriverInstall: true });
  device = devices[0];
  assert.ok(device, "An Android emulator must be attached");
  device.setDefaultTimeout(60000);
  console.log("Connecting to the installed Android WebView");
  const webview = await device.webView({ pkg: packageId });
  const page = await webview.page();
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push({
      url: request.url().split("?")[0],
      error: request.failure()?.errorText,
    }),
  );
  await page.locator('input[type="password"]').waitFor({ state: "visible" });
  // A newly booted emulator can render bundled assets before Android has
  // finished configuring its network. Wait for validated connectivity.
  await page.waitForFunction(
    async () =>
      (await window.Capacitor.nativePromise("Network", "getStatus", {}))
        .connected,
    null,
    { polling: 1000, timeout: 60000 },
  );
  const initial = await page.evaluate(() => ({
    origin: location.origin,
    path: location.pathname,
    native: window.Capacitor.isNativePlatform(),
    platform: window.Capacitor.getPlatform(),
    safe: document.documentElement.dataset.nativePlatform,
    password: !!document.querySelector('input[type="password"]'),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(initial.origin, "https://localhost");
  assert.equal(initial.platform, "android");
  assert.equal(initial.safe, "android");
  assert.equal(initial.password, true);
  assert.equal(initial.overflow, false);
  await screenshot("android-login");
  await page.getByRole("button", { name: "S'inscrire", exact: true }).click();
  await page.getByRole("heading", { name: "Créons votre accès" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot("android-register");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page.getByRole("button", { name: "Se connecter", exact: true }).waitFor();
  console.log("Native login screen and safe layout passed; checking HTTPS API");
  // Real HTTPS requests from the packaged app origin; no identity or business writes.
  const network = await page.evaluate(async () => {
    const base = "https://kadi-facture.onrender.com/api";
    const get = async (path) => {
      let failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await fetch(base + path, {
            signal: AbortSignal.timeout(90000),
          });
        } catch (error) {
          failure = error;
          if (attempt < 2)
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      throw failure;
    };
    const health = await get("/health");
    const privateRoute = await get("/auth/profile");
    return { health: health.status, privateRoute: privateRoute.status };
  });
  await writeFile(
    output + "/network.json",
    JSON.stringify({ network, failedRequests }, null, 2),
  );
  assert.equal(network.health, 200);
  assert.equal(network.privateRoute, 401);
  console.log(
    "HTTPS API and private route denial passed; checking native PDF sharing",
  );
  const share = await page.evaluate(() =>
    window.Capacitor.nativePromise("Share", "canShare", {}),
  );
  assert.equal(share.value, true);
  const file = await page.evaluate(() =>
    window.Capacitor.nativePromise("Filesystem", "writeFile", {
      path: "kadi-pdf/smoke/devis-test.pdf",
      directory: "CACHE",
      data: btoa("%PDF-1.4\nKadi Android smoke test"),
      recursive: true,
    }),
  );
  assert.ok(file.uri.startsWith("file:"));
  await page.evaluate((uri) => {
    window.Capacitor.nativePromise("Share", "share", {
      files: [uri],
      title: "devis-test.pdf",
      dialogTitle: "Partager le PDF",
    }).catch(() => {});
  }, file.uri);
  await pause(1500);
  // Android initially shows only its suggested targets. Expand the sheet so
  // the separate PDF receiver is visible alongside the other installed apps.
  await screenshot("android-share-collapsed");
  const screenSize = adb("shell", "wm", "size").match(/(\d+)x(\d+)/);
  assert.ok(screenSize, "Emulator screen dimensions must be available");
  const screenWidth = Number(screenSize[1]),
    screenHeight = Number(screenSize[2]);
  adb(
    "shell",
    "input",
    "swipe",
    String(Math.round(screenWidth / 2)),
    String(Math.round(screenHeight * 0.61)),
    String(Math.round(screenWidth / 2)),
    String(Math.round(screenHeight * 0.2)),
    "500",
  );
  await pause(500);
  await screenshot("android-share");
  const centerOf = node => {
    const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    return bounds ? [Math.round((Number(bounds[1]) + Number(bounds[3])) / 2), Math.round((Number(bounds[2]) + Number(bounds[4])) / 2)] : null;
  };
  let receipt = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    adb("shell", "uiautomator", "dump", "/sdcard/kadi-share.xml");
    const chooser = adb("shell", "cat", "/sdcard/kadi-share.xml");
    await writeFile(output + "/android-share.xml", chooser);
    const nodes = chooser.match(/<node\b[^>]*>/g) || [];
    const receiver = nodes.find(node => /(?:text|content-desc)="[^"]*Kadi PDF[^"]*"/.test(node));
    const target = centerOf(receiver);
    if (target) {
      // Read current coordinates immediately before the tap. Android can
      // reflow the chooser after accessibility starts or suggestions load.
      adb("shell", "input", "tap", String(target[0]), String(target[1]));
      for (let i = 0; i < 20; i++) {
        receipt = adb("logcat", "-d", "-s", "KadiPdfTest:I", "*:S");
        if (receipt.includes("PDF_READ_OK")) break;
        await pause(250);
      }
      if (receipt.includes("PDF_READ_OK")) break;
    }
    const handle = centerOf(nodes.find(node => /resource-id="android:id\/drag"/.test(node))) || [Math.round(screenWidth / 2), Math.round(screenHeight * .61)];
    adb("shell", "input", "swipe", String(handle[0]), String(handle[1]), String(handle[0]), "120", "700");
    await pause(700);
  }
  assert.match(
    receipt,
    /PDF_READ_OK/,
    "Recipient must read the granted PDF content URI",
  );
  await screenshot("android-pdf-received");
  adb(
    "shell",
    "am",
    "start",
    "-n",
    packageId + "/com.ericaystudio.kadi.MainActivity",
  );
  assert.equal(
    await page.evaluate(() => {
      localStorage.setItem("kadi-smoke-persistence", "1");
      return localStorage.getItem("kadi-smoke-persistence");
    }),
    "1",
  );
  await page.reload();
  await page.locator('input[type="password"]').waitFor({ state: "visible" });
  assert.equal(
    await page.evaluate(() => localStorage.getItem("kadi-smoke-persistence")),
    "1",
  );
  await page.evaluate(() => localStorage.removeItem("kadi-smoke-persistence"));
  // Exercise the actual packaged authenticated UI with isolated response fixtures.
  // No real user's session, production credentials or production writes are used.
  const fixtureId = "11111111-1111-4111-8111-111111111111";
  const fixtureUser = {
    id: fixtureId,
    email: "android-qa@example.invalid",
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { full_name: "Eric Démo" },
  };
  const fixtureProfile = {
    id: fixtureId,
    company: "Atelier Démo",
    manager_name: "Eric Démo",
    email: fixtureUser.email,
    logo_url: null,
  };
  const fixtureClient = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    company_name: "Client Démonstration",
    contact_name: "Contact Démo",
  };
  const paginated = (data) => ({
    data,
    pagination: { page: 1, pageSize: 10, total: data.length, totalPages: 1 },
  });
  const fixtureHeaders = { "access-control-allow-origin": "https://localhost", "access-control-allow-headers": "authorization,apikey,x-client-info,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
  await page.route("https://giksqprkorjbgikprksb.supabase.co/**", (route) =>
    route.fulfill({ headers: fixtureHeaders, json: fixtureUser }),
  );
  await page.route("https://kadi-facture.onrender.com/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses = {
      "/api/auth/profile": fixtureProfile,
      "/api/platform/session": { is_super_admin: false },
      "/api/clients": paginated([fixtureClient]),
      "/api/quotes": paginated([]),
      "/api/products": paginated([]),
      "/api/invoices": paginated([]),
      "/api/invoices/todo": { overdue: [], dueSoon: [], drafts: [] },
      "/api/invoices/summary": {
        totals: {
          revenue: 0,
          outstanding: 0,
          invoiceCount: 0,
          averagePaymentDelay: null,
        },
        charts: {},
        meta: { startDate: "2026-10-01", endDate: "2026-10-31" },
      },
    };
    assert.ok(
      Object.hasOwn(responses, path),
      "Unexpected API request in isolated native UI fixture: " + path,
    );
    return route.fulfill({ headers: fixtureHeaders, json: responses[path] });
  });
  await page.evaluate((user) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value) =>
      btoa(JSON.stringify(value))
        .replaceAll("=", "")
        .replaceAll("+", "-")
        .replaceAll("/", "_");
    const access_token =
      encode({ alg: "HS256", typ: "JWT" }) +
      "." +
      encode({
        sub: user.id,
        aud: "authenticated",
        role: "authenticated",
        exp,
      }) +
      ".unsigned-qa-fixture";
    localStorage.setItem(
      "sb-giksqprkorjbgikprksb-auth-token",
      JSON.stringify({
        access_token,
        refresh_token: "isolated-qa-fixture",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: exp,
        user,
      }),
    );
  }, fixtureUser);
  await page.reload();
  await page.getByRole("navigation", { name: "Navigation Android" }).waitFor();
  await page.locator(".native-balance-card").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Ouvrir la navigation" }).count(),
    0,
  );
  await screenshot("android-home");
  await page.getByRole("button", { name: "Menu du compte" }).click();
  await page.getByRole("dialog", { name: "Mon espace" }).waitFor();
  await screenshot("android-account");
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await page
    .getByRole("dialog", { name: "Mon espace" })
    .waitFor({ state: "hidden" });
  assert.equal(isKadiResumed(), true, "Back closes the account sheet without minimizing");
  for (const label of ["Devis", "Catalogue", "Clients", "Factures"]) {
    await page
      .getByRole("navigation", { name: "Navigation Android" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    await page.locator(".native-list-loading").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(
      await page.getByRole("navigation", { name: "Pagination" }).count(),
      0,
    );
    await screenshot("android-" + label.toLowerCase());
  }
  await page.evaluate(() => {
    localStorage.removeItem("sb-giksqprkorjbgikprksb-auth-token");
    location.href = "/login";
  });
  await page
    .getByRole("button", { name: "Se connecter", exact: true })
    .waitFor();
  await page.unrouteAll({ behavior: "wait" });
  console.log(
    "Packaged Android UI: bottom tabs, compact collections, account sheet and system Back passed with isolated data.",
  );
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await pause(500);
  const minimized = !isKadiResumed();
  assert.equal(minimized, true, "Back at login must minimize the app");
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/verification.json",
    JSON.stringify(
      {
        initial,
        network,
        shareAvailable: true,
        pdfChooser: true,
        recipientReadPdf: true,
        localPersistence: true,
        authenticatedUiWithFixtures: true,
      registrationLayout: true,
        accountBackCloses: true,
        noDuplicateNavigation: true,
        backMinimizes: minimized,
        testedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "Android emulator: native login, safe layout, HTTPS API, private route denial, PDF share, persistence and system back passed.",
  );
} catch (error) {
  await screenshot("android-failure").catch(() => {});
  await writeFile(
    output + "/android-logcat.txt",
    adb("logcat", "-d", "-t", "800"),
  ).catch(() => {});
  await writeFile(output + "/failure.txt", String(error.stack || error));
  throw error;
} finally {
  if (device) await device.close();
}
