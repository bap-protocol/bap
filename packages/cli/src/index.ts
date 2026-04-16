import { Session } from "@bap-protocol/core";

interface InspectOptions {
  url: string;
  headed: boolean;
  pretty: boolean;
  waitUntil: "load" | "domcontentloaded" | "networkidle";
}

function printUsage(): void {
  const lines = [
    "bap — Browser Agent Protocol CLI",
    "",
    "Usage:",
    "  bap inspect <url> [--headed] [--raw] [--wait=load|domcontentloaded|networkidle]",
    "",
    "Commands:",
    "  inspect <url>    Capture a BrowserState snapshot of the given URL and print it as JSON.",
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
  let url: string | undefined;
  let headed = false;
  let pretty = true;
  let waitUntil: InspectOptions["waitUntil"] = "load";

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
    } else if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      return null;
    } else if (!url) {
      url = arg;
    } else {
      console.error(`Unexpected positional argument: ${arg}`);
      return null;
    }
  }

  if (!url) {
    console.error("Error: inspect requires a <url> argument");
    return null;
  }
  return { url, headed, pretty, waitUntil };
}

async function runInspect(opts: InspectOptions): Promise<number> {
  const session = await Session.launch({ headless: !opts.headed });
  try {
    await session.goto(opts.url, { waitUntil: opts.waitUntil });
    const state = await session.snapshot();
    process.stdout.write(JSON.stringify(state, null, opts.pretty ? 2 : 0));
    process.stdout.write("\n");
    return 0;
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
