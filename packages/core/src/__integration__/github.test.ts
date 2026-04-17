import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

/**
 * Real-world probe: GitHub login page. A small, clean, semantic form —
 * the baseline for "does BAP extract a standard HTML form correctly."
 * Unlike the Amazon / Booking / Google tests this page is server-rendered
 * with stable ARIA, so we can make stricter assertions.
 */

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Real-world: GitHub login", () => {
  it("extracts the login form with editable/required state", async () => {
    await session.goto("https://github.com/login", { waitUntil: "domcontentloaded" });
    const state = await session.snapshot();

    console.log("[gh] title:", JSON.stringify(state.title));
    console.log("[gh] nodes:", state.nodes.length);
    console.log("[gh] widgets:", summarize(state.widgets));

    expect(state.version).toBe("0.1");
    expect(state.url).toMatch(/github\.com\/login/);
    expect(state.title).toMatch(/Sign in|Log in/i);
    expect(state.nodes.length).toBeGreaterThan(30);

    // The username field — named "Username or email address" on github.com
    const username = state.nodes.find(
      (n) => n.editable && /username|email/i.test(n.name ?? ""),
    );
    expect(username, "username/email input detected").toBeDefined();
    expect(username!.editable).toBe(true);
    console.log(`[gh] username field: role=${username!.role} name=${JSON.stringify(username!.name)} required=${username!.state.required}`);

    // The password field.
    const password = state.nodes.find(
      (n) => n.editable && /password/i.test(n.name ?? ""),
    );
    expect(password, "password input detected").toBeDefined();
    console.log(`[gh] password field: role=${password!.role} name=${JSON.stringify(password!.name)} required=${password!.state.required}`);

    // The sign-in submit button.
    const submit = state.nodes.find(
      (n) => n.role === "button" && /sign in|log in/i.test(n.name ?? ""),
    );
    expect(submit, "sign-in button detected").toBeDefined();
    expect(submit!.interactable).toBe(true);

    // No overlays expected on a simple login page.
    expect(state.overlays.length).toBe(0);
  }, 60_000);
});

function summarize(widgets: { type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of widgets) out[w.type] = (out[w.type] ?? 0) + 1;
  return out;
}
