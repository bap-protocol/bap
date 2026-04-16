# @bap-protocol/cli

Command-line tool for the Browser Agent Protocol.

## Install

```bash
npm install -g @bap-protocol/cli
# or run directly without installing:
npx @bap-protocol/cli inspect https://example.com
```

## Commands

### `bap inspect <url>`

Launches a headless Chromium, navigates to the URL, captures a BAP `BrowserState` snapshot, and prints it as JSON to stdout.

```bash
bap inspect https://example.com
bap inspect https://mui.com/material-ui/react-slider/ --wait=networkidle
bap inspect https://example.com --raw > state.json
bap inspect https://example.com --headed    # show the browser window
```

Options:

- `--headed` — show the browser window (default: headless)
- `--raw` — compact JSON output (default: pretty-printed)
- `--wait=<phase>` — navigation wait condition: `load` (default), `domcontentloaded`, or `networkidle`

## Status

Pre-alpha. More commands (`act`, `demo`) planned for v1.0.
