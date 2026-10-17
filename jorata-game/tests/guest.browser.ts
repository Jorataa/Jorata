import { chromium, expect, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base = process.env.GUEST_TEST_URL || "http://localhost:3101";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const demo = process.env.GUEST_TEST_DEMO === "true";
const context = await browser.newContext({
  permissions: ["camera"],
  viewport: { width: 1440, height: 950 },
});
const a = await context.newPage(),
  b = demo
    ? await context.newPage()
    : await (
        await browser.newContext({
          permissions: ["camera"],
          viewport: { width: 1440, height: 950 },
        })
      ).newPage();
const errors: string[] = [],
  requests: string[] = [];
for (const page of [a, b]) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/supabase\.(co|com)/.test(r.url())) requests.push(r.url());
  });
}
const tag = Date.now().toString().slice(-7),
  nameA = `Tester A ${tag}`,
  nameB = `Tester B ${tag}`;
async function rename(page: Page, name: string) {
  await page.getByRole("button", { name: "Edit guest", exact: true }).click();
  const d = page.getByRole("dialog", { name: "Temporary profile" });
  await d.getByLabel("Display name").fill(name);
  await d.getByRole("button", { name: "Save profile" }).click();
  await expect(d).toHaveCount(0);
}
async function send(page: Page, body: string) {
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}
async function messageAction(page: Page, message: Locator, name: string) {
  await message.hover();
  await message.getByRole("button", { name: "Message options", exact: true }).click();
  await page
    .getByRole("menu", { name: "Message options", exact: true })
    .getByRole("menuitem", { name, exact: true })
    .click();
}
async function newDM(page: Page, name: string) {
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  const d = page.getByRole("dialog", { name: "Start a conversation" });
  await d.getByPlaceholder("Search username").fill(name);
  await d.getByRole("button", { name: "Find people" }).click();
  await d.getByRole("button", { name: `Message ${name}`, exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.getByRole("button", { name: "Close side panel" }).click();
}
try {
  await a.goto(base);
  await b.goto(base);
  await expect(
    a.getByRole("heading", { name: "Guest lounge · test data", exact: true }),
  ).toBeVisible();
  await rename(a, nameA);
  await rename(b, nameB);
  await expect(
    a.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await expect(
    a.getByRole("button", { name: "Sign up", exact: true }),
  ).toHaveCount(0);
  await send(a, `Lobby ${tag}`);
  await expect(b.getByText(`Lobby ${tag}`, { exact: true })).toBeVisible();
  await newDM(a, nameB);
  await expect(
    b.locator(".social-room").filter({ hasText: nameA }),
  ).toBeVisible();
  await b.locator(".social-room").filter({ hasText: nameA }).click();
  await a.getByRole("textbox", { name: "Message", exact: true }).fill("typing");
  await expect(b.locator(".social-typing")).toContainText(nameA);
  await send(a, `Direct ${tag}`);
  const direct = b
    .locator("article.social-message")
    .filter({ hasText: `Direct ${tag}` });
  await expect(direct).toBeVisible();
  const directId = await direct.getAttribute("data-message-id");
  await messageAction(b, direct, "React 👍");
  await expect(
    a
      .locator("article.social-message")
      .filter({ hasText: `Direct ${tag}` })
      .getByRole("button", { name: "React 👍", exact: true }),
  ).toHaveText("👍1");
  await messageAction(b, direct, "Reply");
  await send(b, `Reply ${tag}`);
  await expect(a.locator("blockquote")).toContainText(`Direct ${tag}`);
  const own = a.locator(`article.social-message[data-message-id="${directId}"]`);
  await messageAction(a, own, "Edit message");
  await a.getByLabel("Edit message text").fill(`Edited ${tag}`);
  await a.getByRole("button", { name: "Save edit" }).click();
  await expect(
    b.locator(".social-message-body").filter({ hasText: `Edited ${tag}` }),
  ).toBeVisible();
  await a.reload();
  await expect(
    a.locator(".social-room").filter({ hasText: nameB }),
  ).toBeVisible();
  await a.locator(".social-room").filter({ hasText: nameB }).click();
  await expect(
    a.locator(".social-message-body").filter({ hasText: `Edited ${tag}` }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Tasks", exact: true }).click();
  await a.getByLabel("Task title").fill(`Shared task ${tag}`);
  await a.getByLabel("Deadline").fill("2026-12-01");
  await a
    .getByRole("combobox", { name: "Assign to", exact: true })
    .selectOption({ label: nameB });
  await a.getByRole("button", { name: "Add task", exact: true }).click();
  await b.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    b.getByText(`Shared task ${tag}`, { exact: true }),
  ).toBeVisible();
  await b
    .getByRole("checkbox", { name: `Complete Shared task ${tag}` })
    .click();
  await expect(
    a.getByRole("checkbox", { name: `Complete Shared task ${tag}` }),
  ).toBeChecked();
  await a.getByRole("button", { name: "Close side panel" }).click();
  await b.getByRole("button", { name: "Close side panel" }).click();
  await a.getByRole("button", { name: "New chat", exact: true }).click();
  const newDialog = a.getByRole("dialog", { name: "Start a conversation" });
  await newDialog.getByLabel("Group name").fill(`Team ${tag}`);
  await newDialog
    .getByRole("button", { name: "Create group", exact: true })
    .click();
  const usernameB = await b
    .locator(".social-topbar .social-profile-button")
    .textContent();
  void usernameB;
  await a.getByRole("button", { name: "New chat", exact: true }).click();
  const find = a.getByRole("dialog", { name: "Start a conversation" });
  await find.getByPlaceholder("Search username").fill(nameB);
  await find.getByRole("button", { name: "Find people" }).click();
  const userB = (await find
    .locator(".social-person small")
    .textContent())!.slice(1);
  await find.getByRole("button", { name: "Close dialog" }).click();
  await a.getByRole("textbox", { name: "Invite username" }).fill(userB);
  await a.getByRole("button", { name: "Invite member", exact: true }).click();
  await expect(
    b.locator(".social-room").filter({ hasText: `Team ${tag}` }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Close side panel" }).click();
  await b
    .locator(".social-room")
    .filter({ hasText: `Team ${tag}` })
    .click();
  await send(a, `Group ${tag}`);
  await expect(b.getByText(`Group ${tag}`, { exact: true })).toBeVisible();
  await a
    .getByRole("button", { name: "Discover communities →", exact: true })
    .click();
  const communities = a.getByRole("dialog", {
    name: "Communities",
    exact: true,
  });
  await communities.getByLabel("Community name").fill(`Community ${tag}`);
  await communities
    .getByRole("button", { name: "Create community", exact: true })
    .click();
  await b
    .getByRole("button", { name: "Discover communities →", exact: true })
    .click();
  await b
    .getByRole("dialog", { name: "Communities", exact: true })
    .locator(".social-person")
    .filter({ hasText: `Community ${tag}` })
    .getByRole("button", { name: "Join", exact: true })
    .click();
  await b
    .locator(".social-room")
    .filter({ hasText: `Community ${tag}` })
    .click();
  await send(a, `Channel ${tag}`);
  await expect(b.getByText(`Channel ${tag}`, { exact: true })).toBeVisible();
  await a.getByRole("button", { name: "Members", exact: true }).click();
  await a.getByLabel("Channel name").fill(`Plans ${tag}`);
  await a.getByRole("button", { name: "Create channel", exact: true }).click();
  await expect(
    b.locator(".social-room").filter({ hasText: `Plans ${tag}` }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Close side panel" }).click();
  await b
    .locator(".social-room")
    .filter({ hasText: `Plans ${tag}` })
    .click();
  await a.getByRole("button", { name: "Attach or capture photo" }).click();
  const editor = a.getByRole("dialog", { name: "Make a moment" });
  await editor.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(editor.getByLabel("Camera preview")).toBeVisible();
  await expect
    .poll(() =>
      editor
        .getByLabel("Camera preview")
        .evaluate((v: HTMLVideoElement) => v.videoWidth),
    )
    .toBeGreaterThan(0);
  await editor
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await expect(editor.getByLabel("Edited photo preview")).toBeVisible();
  await editor.getByLabel("Filter", { exact: true }).selectOption("Vintage");
  await editor.getByLabel("Frame background").selectOption("Meadow");
  await editor.getByLabel("Caption").fill("Guest photo");
  await editor.getByLabel("Sticker").selectOption("🌿");
  await editor.getByRole("button", { name: "Send photo", exact: true }).click();
  await expect(editor).toHaveCount(0, { timeout: 20000 });
  await expect(
    b.getByRole("img", { name: `Photo from ${nameA}` }),
  ).toBeVisible();
  await expect
    .poll(() =>
      b
        .getByRole("img", { name: `Photo from ${nameA}` })
        .evaluate((v: HTMLImageElement) => v.naturalWidth),
    )
    .toBeGreaterThan(0);
  await a
    .getByRole("button", { name: "✳ Visit the Meadow", exact: false })
    .click();
  await b
    .getByRole("button", { name: "✳ Visit the Meadow", exact: false })
    .click();
  await expect(a.getByTestId("world-players")).toContainText(nameB);
  await expect(b.getByTestId("world-players")).toContainText(nameA);
  const canvas = a.locator("#game-canvas");
  await expect.poll(() => canvas.getAttribute("data-player-x")).not.toBeNull();
  const start = Number(await canvas.getAttribute("data-player-x"));
  await canvas.focus();
  await a.keyboard.down("d");
  await a.waitForTimeout(650);
  await a.keyboard.up("d");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-player-x")))
    .toBeGreaterThan(start + 1);
  await a.getByRole("button", { name: "Emote 👋", exact: true }).click();
  await expect(
    b.getByRole("status", { name: "Latest Meadow moment" }),
  ).toContainText("👋");
  await a.getByLabel("Meadow message").fill(`Hello meadow ${tag}`);
  await a.getByRole("button", { name: "Say", exact: true }).click();
  await expect(
    b.getByRole("status", { name: "Latest Meadow moment" }),
  ).toContainText(`Hello meadow ${tag}`);
  await a
    .getByRole("button", { name: "← Back to messages", exact: true })
    .click();
  await a
    .getByRole("textbox", { name: "Search conversations" })
    .fill(`Plans ${tag}`);
  await expect(a.locator(".social-room")).toHaveCount(1);
  await a.getByRole("textbox", { name: "Search conversations" }).fill("");
  await mkdir("artifacts", { recursive: true });
  await a.screenshot({
    path: `artifacts/guest-${demo ? "demo" : "local"}.png`,
    fullPage: true,
  });
  await a.getByRole("button", { name: "New guest", exact: true }).click();
  await expect(a.locator(".social-profile-button")).not.toContainText(nameA);
  await a
    .getByRole("combobox", { name: "Switch test identity" })
    .selectOption({ label: nameA });
  await expect(a.locator(".social-profile-button")).toContainText(nameA);
  await expect(
    a.locator(".social-room").filter({ hasText: nameB }),
  ).toBeVisible();
  await a.setViewportSize({ width: 390, height: 844 });
  await expect(
    a.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Back to conversations", exact: true }).click();
  await expect(
    a.getByRole("textbox", { name: "Search conversations" }),
  ).toBeVisible();
  await a.screenshot({
    path: `artifacts/guest-${demo ? "demo" : "local"}-mobile.png`,
    fullPage: true,
  });
  if (demo) {
    const isolated = await browser.newContext(),
      third = await isolated.newPage();
    await third.goto(base);
    await expect(
      third.getByRole("heading", {
        name: "Guest lounge · test data",
        exact: true,
      }),
    ).toBeVisible();
    await expect(third.getByText(`Lobby ${tag}`, { exact: true })).toHaveCount(
      0,
    );
    const disabled = await third.request.post(`${base}/api/dev/session`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(disabled.status()).toBe(404);
    await isolated.close();
  }
  assertNoErrors();
  console.log(
    JSON.stringify({
      mode: demo ? "browser-demo" : "development-socket",
      verified: [
        "direct entry",
        "distinct guest identities",
        "live lobby and direct messages",
        "typing",
        "reactions",
        "replies",
        "edits",
        "refresh history",
        "shared tasks and assignment",
        "groups and invites",
        "community join and channel creation",
        "camera permission/capture with simulated device",
        "filters/frame/caption/sticker",
        "image delivery",
        "two-player world, movement, emote and bubble delivery",
        "conversation search",
        "identity creation/switching",
        "mobile navigation",
      ],
      errors,
    }),
  );
  function assertNoErrors() {
    if (errors.length) throw new Error(errors.join("\n"));
    if (requests.length) throw new Error("Guest app contacted Supabase.");
  }
} catch (e) {
  await mkdir("artifacts", { recursive: true });
  await a.screenshot({ path: "artifacts/guest-failure-a.png", fullPage: true });
  await b.screenshot({ path: "artifacts/guest-failure-b.png", fullPage: true });
  console.error("Browser errors:", errors);
  throw e;
} finally {
  await browser.close();
}
