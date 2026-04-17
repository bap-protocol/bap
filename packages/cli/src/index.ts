import { readFileSync } from "node:fs";
import { Session } from "@bap-protocol/core";
import type { Action } from "@bap-protocol/spec";

type WaitUntil = "load" | "domcontentloaded" | "networkidle";

interface InspectOptions {
  url: string;
  headed: boolean;
  pretty: boolean;
  waitUntil: WaitUntil;
}

interface ActOptions {
  url: string;
  action: Action;
  headed: boolean;
  pretty: boolean;
  waitUntil: WaitUntil;
}

function printUsage(): void {
  const lines = [
    "bap — Browser Agent Protocol CLI",
    "",
    "Usage:",
    "  bap inspect <url> [--headed] [--raw] [--wait=load|domcontentloaded|networkidle]",
    "  bap act <url> <action-file | -> [--json='{...}'] [--headed] [--raw] [--wait=...]",
    "",
    "Commands:",
    "  inspect <url>                Capture a BrowserState snapshot as JSON.",
    "  act <url> <action-file>      Run a single Action against <url>; prints ActionResult.",
    "                               Use '-' to read the action JSON from stdin, or pass --json='...'.",
    "",
    "Options:",
    "  --headed         Run the browser with a visible window (default: headless).",
    "  --raw            Print compact JSON instead of pretty-printed (default: pretty).",
    "  --wait=<phase>   Navigation wait condition (default: load).",
    "  -h, --help       Show this help.",
  ];
  console.error(lines.join("\n"));
}

function parseInspectArgs(argv: string[]): InspectOptions | null {
  const base = parseCommon(argv);
  if (!base) return null;
  if (!base.url) {
    console.error("Error: inspect requires a <url> argument");
    return null;
  }
  if (base.positional.length > 0) {
    console.error(`Unexpected positional argument: ${base.positional[0]}`);
    return null;
  }
  return { url: base.url, headed: base.headed, pretty: base.pretty, waitUntil: base.waitUntil };
}

function parseActArgs(argv: string[]): ActOptions | null {
  const base = parseCommon(argv);
  if (!base) return null;
  if (!base.url) {
    console.error("Error: act requires a <url> argument");
    return null;
  }

  let actionJson: string | undefined = base.flags["json"];
  const actionPath = base.positional[0];

  if (!actionJson && !actionPath) {
    console.error("Error: act requires either an action file (or '-') or --json='{...}'");
    return null;
  }
  if (base.positional.length > 1) {
    console.error(`Unexpected positional argument: ${base.positional[1]}`);
    return null;
  }

  if (!actionJson) {
    try {
      actionJson =
        actionPath === "-" ? readFileSync(0, "utf8") : readFileSync(actionPath!, "utf8");
    } catch (err) {
      console.error(`Error reading action file: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  let action: Action;
  try {
    action = JSON.parse(actionJson) as Action;
  } catch (err) {
    console.error(`Error parsing action JSON: ${err instanceof Error ? err.message : err}`);
    return null;
  }
  if (typeof action !== "object" || action === null || typeof (action as { type?: unknown }).type !== "string") {
    console.error("Error: action JSON must be an object with a string 'type' field");
    return null;
  }

  return {
    url: base.url,
    action,
    headed: base.headed,
    pretty: base.pretty,
    waitUntil: base.waitUntil,
  };
}

interface CommonArgs {
  url: string | undefined;
  headed: boolean;
  pretty: boolean;
  waitUntil: WaitUntil;
  positional: string[];
  flags: Record<string, string>;
}

function parseCommon(argv: string[]): CommonArgs | null {
  let url: string | undefined;
  let headed = false;
  let pretty = true;
  let waitUntil: WaitUntil = "load";
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (const arg of argv) {
    if (arg === "--headed") headed = true;
    else if (arg === "--raw") pretty = false;
    else if (arg.startsWith("--wait=")) {
      const v = arg.slice("--wait=".length);
      if (v === "load" || v === "domcontentloaded" || v === "networkidle") {
        waitUntil = v;
      } else {
        console.error(`Invalid --wait value: ${v}`);
        return null;
      }
    } else if (arg.startsWith("--") && arg.includes("=")) {
      const eq = arg.indexOf("=");
      const name = arg.slice(2, eq);
      flags[name] = arg.slice(eq + 1);
    } else if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      return null;
    } else if (!url) {
      url = arg;
    } else {
      positional.push(arg);
    }
  }

  return { url, headed, pretty, waitUntil, positional, flags };
}

function printJson(value: unknown, pretty: boolean): void {
  process.stdout.write(JSON.stringify(value, null, pretty ? 2 : 0));
  process.stdout.write("\n");
}

async function runInspect(opts: InspectOptions): Promise<number> {
  const session = await Session.launch({ headless: !opts.headed });
  try {
    await session.goto(opts.url, { waitUntil: opts.waitUntil });
    const state = await session.snapshot();
    printJson(state, opts.pretty);
    return 0;
  } finally {
    await session.close();
  }
}

async function runAct(opts: ActOptions): Promise<number> {
  const session = await Session.launch({ headless: !opts.headed });
  try {
    await session.goto(opts.url, { waitUntil: opts.waitUntil });
    await session.snapshot();
    const result = await session.dispatch(opts.action);
    printJson(result, opts.pretty);
    return result.success ? 0 : 2;
  } finally {
    await session.close();
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    printUsage();
    return argv.length === 0 ? 1 : 0;
  }

  const [command, ...rest] = argv;
  switch (command) {
    case "inspect": {
      const opts = parseInspectArgs(rest);
      if (!opts) {
        printUsage();
        return 1;
      }
      return runInspect(opts);
    }
    case "act": {
      const opts = parseActArgs(rest);
      if (!opts) {
        printUsage();
        return 1;
      }
      return runAct(opts);
    }
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
