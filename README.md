# AI Task Manager

A faster, smarter replacement for Windows Task Manager. Live process insight, performance graphs over a rolling 60-second window, startup and service management, network connection inspector, storage analyzer, system optimization, and on-demand AI explanations for any process or system state. Built with Rust + Tauri v2 + React.

## Features

- **Processes** — sortable, filterable, searchable list/tree view with PID, name, CPU%, RAM, disk I/O, status, user, runtime, and a rule-based trust badge (green/yellow/red). Per-process detail panel with command line, working directory, environment count, and parent PID. End process with one click.
- **Performance** — CPU (total + per-core), memory, disk, and network sparkline graphs over a rolling 60-second window. 1 Hz sampling in a background Rust thread.
- **Startup** — registry Run keys (HKCU / HKLM, both 64-bit and WOW64) plus the user and system Startup folders. Enable/disable entries via Explorer's StartupApproved keys.
- **Services** — enumerate all Windows services with display name, status, start type, and PID. Start/stop services or change their startup type.
- **Network Inspector** — live view of active TCP/UDP connections via `netstat -ano` with local/foreign addresses, state, PID, and resolved process name. Auto-refreshes every 4 seconds.
- **Storage Analyzer** — WizTree-like visual directory scanner. Select a drive or folder, scan recursively, view total size, file/dir counts, and file-type distribution (video, audio, images, documents, archives, executables) with a stacked bar. Browse and delete large files/directories.
- **System Audit** — PC health analyzer showing temp file sizes, Recycle Bin stats, DNS cache status, and RAM usage. One-click optimization flushes DNS, purges temp files/logs, and empties the Recycle Bin.
- **AI Insights** — bring your own OpenRouter API key (Gemini Flash by default). Ask "what is this process?" for any selected process, or diagnose "why is it slow?" with the top processes as context. Explanations are cached locally by process signature for instant repeat lookups.
- **Settings** — configure API key, model, base URL, and UI refresh rate (1–4 Hz). Everything stored locally via the Tauri store plugin.

## Prerequisites

- **Rust** (stable, edition 2021, minimum 1.77)
- **Bun** (package manager and runtime)
- **Windows** (required for full functionality — service, startup, and network commands use Windows-specific APIs)
- **WebView2** (included on Windows 11 / modern Windows 10)

## Tech Stack

- **Rust** stable + **Tauri v2** (desktop framework)
- **sysinfo** for cross-platform process and resource sampling
- **windows-service** and **winreg** for Windows service/startup management
- **React 18** + **TypeScript** + **Tailwind CSS v4** + **lucide-react** icons
- **recharts** for performance graphs
- **Bun** as the package manager and dev server

## Develop

```pwsh
bun install
bun run tauri dev
```

## Build

```pwsh
bun run tauri build
```

Produces `.msi` and `.exe` installers for Windows. The release pipeline auto-bumps the patch version, builds installers, and publishes a GitHub Release on every push to `main`. See `.github/workflows/release.yml`.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Vite dev server only |
| `bun run build` | TypeScript check + Vite production build |
| `bun run tauri dev` | Full Tauri dev mode |
| `bun run tauri build` | Build production Tauri installer |

## Configuration

- **AI features**: Go to Settings → OpenRouter, add an API key from [openrouter.ai/keys](https://openrouter.ai/keys). Default model: `google/gemini-2.0-flash-001`. Default base URL: `https://openrouter.ai/api/v1`.
- **Refresh rate**: Adjust the slider in Settings (1–4 Hz, default 2 Hz).

## Project Layout

```
src/                  React frontend (Vite + Tailwind v4)
  pages/              Page components (Processes, Performance, Services, etc.)
  components/         Shared UI components (Shell, Sparkline, Logo, ui primitives)
  lib/                IPC layer, settings store, formatting utilities
src-tauri/            Rust backend
  src/commands/       Tauri IPC commands (process, services, startup, metrics, AI, storage, audit, network)
  src/state.rs        Shared AppState + 1 Hz metrics sampler thread
  src/lib.rs          App setup, plugin registration, IPC handler wiring
.github/workflows/    CI + Release pipelines
```

## License

MIT.
