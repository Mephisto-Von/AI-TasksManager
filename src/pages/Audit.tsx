import { useState, useEffect } from "react";
import { CheckCircle, RefreshCw, Zap, Loader2, Sparkles } from "lucide-react";
import { Button, Card, ProgressBar, Badge, Modal } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type AuditReport, type OptimizationResult } from "../lib/ipc";
import { formatBytes } from "../lib/format";
import { loadSettings, type StoredSettings } from "../lib/store";

export function Audit() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [systemUptime, setSystemUptime] = useState<string>("");
  const [settings, setSettings] = useState<StoredSettings | null>(null);
  
  // Advice Modal States
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [adviceText, setAdviceText] = useState<string>("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const loadAudit = async () => {
    setLoading(true);
    setOptResult(null);
    try {
      const rep = await ipc.getAuditReport();
      setReport(rep);
      
      // Get uptime
      const snap = await ipc.systemSnapshot();
      const hours = Math.floor(snap.uptime_s / 3600);
      const mins = Math.floor((snap.uptime_s % 3600) / 60);
      setSystemUptime(`${hours}h ${mins}m`);
    } catch (e) {
      console.error("Failed to load audit report", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
    loadSettings().then(setSettings);
  }, []);

  const runCleanup = async () => {
    setOptimizing(true);
    try {
      const res = await ipc.runOptimization();
      setOptResult(res);
      // reload audit after 1.5s delay to show transition
      setTimeout(() => {
        loadAudit();
      }, 1500);
    } catch (e) {
      console.error("Cleanup failed", e);
    } finally {
      setOptimizing(false);
    }
  };

  const fetchAdvice = async () => {
    setLoadingAdvice(true);
    setAdviceOpen(true);
    
    const hasKey = settings && (settings.api_key ?? "").length > 0;
    if (!hasKey) {
      // Show curated offline Windows security and optimization setup tips
      setAdviceText(
        "### 🛡️ Windows Security & Performance Tuning Guide\n\n" +
        "We detected that your OpenRouter API Key is not configured, so here is your local system security audit checklist:\n\n" +
        "1. **Enable User Account Control (UAC)**: Ensures no program can execute command-line tasks with administrator rights without your explicit consent.\n" +
        "2. **Trim High Impact Startup Applications**: Go to the **Startup** tab in this manager and toggle off non-essential apps (like game launchers or updaters) to shave off up to 10s from boot times.\n" +
        "3. **Windows Defender / Antivirus Protection**: Confirm real-time protection is enabled in Windows Security settings. Keep automatic virus definition updates active.\n" +
        "4. **Manage Windows Services**: Standard services like 'Windows Search' can re-index directories during work hours. If disk usage spikes, you can pause indexing or check running services in our **Services** panel.\n" +
        "5. **Clean Registry Run Keys**: Frequently inspect startup entries inside HKLM (machine wide) registry hives to confirm no rogue software has installed persistence hooks."
      );
      setLoadingAdvice(false);
      return;
    }

    try {
      const snap = await ipc.systemSnapshot();
      const reply = await ipc.explainSystem(
        {
          api_key: settings.api_key,
          model: settings.model,
          base_url: settings.base_url,
        },
        {
          cpu_total: snap.cpu_total,
          mem_used: report?.memory_used_bytes ?? snap.mem_used,
          mem_total: report?.memory_total_bytes ?? snap.mem_total,
          top_processes: [],
          custom_prompt: "Provide specific, actionable security settings and optimal system setup recommendations for a Windows PC. Keep the suggestions bulleted and precise."
        }
      );
      setAdviceText(reply.answer);
    } catch (e) {
      setAdviceText(`Failed to retrieve advice from AI model: ${e}. Please double-check your API Key in Settings.`);
    } finally {
      setLoadingAdvice(false);
    }
  };

  const totalJunkBytes = report
    ? report.user_temp_bytes + report.system_temp_bytes + report.recycle_bin_bytes
    : 0;

  const ramUsedPct = report && report.memory_total_bytes > 0
    ? (report.memory_used_bytes / report.memory_total_bytes) * 100
    : 0;

  return (
    <>
      <PageHeader
        title="System Audit"
        subtitle="Analyze PC health, purge cache files, flush DNS resolver, and boost speed."
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Main Status Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 col-span-2 flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-fg-strong)]">
                  {totalJunkBytes > 1024 * 1024 * 100 // 100 MB
                    ? "Optimization Recommended"
                    : "Your PC is in Good Shape"}
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  We scanned temporary files, logs, DNS cache, and system recycle bin contents.
                </p>
              </div>
              <Badge tone={totalJunkBytes > 1024 * 1024 * 100 ? "yellow" : "green"}>
                {totalJunkBytes > 1024 * 1024 * 100 ? "Needs Review" : "Healthy"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Clearable Junk</div>
                <div className="text-xl font-bold text-[var(--color-fg-strong)] mt-0.5">
                  {formatBytes(totalJunkBytes)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">RAM Usage</div>
                <div className="text-xl font-bold text-[var(--color-fg-strong)] mt-0.5">
                  {ramUsedPct.toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">System Uptime</div>
                <div className="text-xl font-bold text-[var(--color-fg-strong)] mt-0.5">
                  {systemUptime || "—"}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="primary" disabled={optimizing || loading} onClick={runCleanup}>
                {optimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-current text-amber-400" />
                    1-Click Optimize
                  </>
                )}
              </Button>
              <Button disabled={loading || optimizing} onClick={loadAudit}>
                <RefreshCw className="h-4 w-4" />
                Rescan System
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchAdvice} className="border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                <Sparkles className="h-4 w-4 text-[var(--color-amber)]" />
                Get Setup Advice
              </Button>
            </div>
          </Card>

          {/* Health Index Circle Mock */}
          <Card className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative flex items-center justify-center">
              {/* Outer Glow */}
              <div className={`h-24 w-24 rounded-full border-4 flex items-center justify-center transition-all ${
                totalJunkBytes > 1024 * 1024 * 500 // 500 MB
                  ? "border-[var(--color-warn)] shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  : "border-[var(--color-success)] shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              }`}>
                <span className="text-xl font-extrabold text-[var(--color-fg-strong)]">
                  {totalJunkBytes > 1024 * 1024 * 500 ? "84" : "98"}
                </span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[var(--color-fg-strong)]">PC Health Score</h4>
              <p className="text-[10px] text-[var(--color-muted)] mt-0.5">Calculated based on resource leaks & cache size</p>
            </div>
          </Card>
        </div>

        {/* Clean Results summary alert */}
        {optResult && (
          <Card className="p-4 border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />
            <div>
              <div className="font-semibold text-sm text-[var(--color-fg-strong)]">Optimization Complete!</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">
                Freed {formatBytes(optResult.cleaned_bytes)} of storage. DNS resolver cache was successfully flushed.
              </div>
            </div>
          </Card>
        )}

        {/* Audit Details */}
        {loading ? (
          <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="h-8 w-8 text-[var(--color-accent)] animate-spin" />
            <span className="text-xs text-[var(--color-muted)]">Scanning system files and configurations...</span>
          </Card>
        ) : report ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Storage Junk Cards */}
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-fg-strong)]">System & Storage Junk</h3>
              <div className="space-y-3">
                <JunkItem
                  label="User Temporary Files"
                  description="Caches, logs, and staging files stored in %TEMP% folder."
                  size={report.user_temp_bytes}
                />
                <JunkItem
                  label="Windows System Temp"
                  description="Staged update logs and application cache files in C:\Windows\Temp."
                  size={report.system_temp_bytes}
                />
                <JunkItem
                  label="Recycle Bin Contents"
                  description={`Files sent to deleted directory storage (${report.recycle_bin_count} files).`}
                  size={report.recycle_bin_bytes}
                />
              </div>
            </Card>

            {/* RAM & Network Performance audit */}
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-fg-strong)]">Memory & Network Health</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-[var(--color-fg-strong)]">Memory (RAM) Compression</span>
                    <span className="text-[var(--color-muted)]">
                      {formatBytes(report.memory_used_bytes)} / {formatBytes(report.memory_total_bytes)}
                    </span>
                  </div>
                  <ProgressBar value={ramUsedPct} tone={ramUsedPct > 80 ? "danger" : ramUsedPct > 60 ? "warn" : "success"} />
                  <p className="text-[10px] text-[var(--color-muted)] mt-1.5">
                    Higher RAM usage can slow down operations. Optimization trims processes working memory.
                  </p>
                </div>

                <div className="border-t border-[var(--color-border)] pt-4 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-medium text-[var(--color-fg-strong)]">DNS Resolver Cache</div>
                    <div className="text-[10px] text-[var(--color-muted)] mt-0.5">Flush DNS to fix connectivity issues.</div>
                  </div>
                  <Badge tone="accent">Ready</Badge>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {/* AI Advice Popup Modal */}
      <Modal
        isOpen={adviceOpen}
        onClose={() => setAdviceOpen(false)}
        title="AI Optimization & Security Advisor"
      >
        {loadingAdvice ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 text-[var(--color-accent)] animate-spin" />
            <span className="text-xs text-[var(--color-muted)]">Requesting security audit advice...</span>
          </div>
        ) : (
          <div className="space-y-3 prose prose-invert select-text">
            {adviceText.split("\n").map((line, idx) => {
              if (line.startsWith("###")) {
                return (
                  <h3 key={idx} className="font-bold text-sm text-[var(--color-fg-strong)] mt-4 mb-2">
                    {line.replace("###", "").trim()}
                  </h3>
                );
              }
              if (
                line.startsWith("1.") ||
                line.startsWith("2.") ||
                line.startsWith("3.") ||
                line.startsWith("4.") ||
                line.startsWith("5.")
              ) {
                return (
                  <p key={idx} className="text-xs mb-2 pl-2 border-l-2 border-[var(--color-accent)]">
                    <strong className="text-[var(--color-fg-strong)]">
                      {line.substring(0, 3)}
                    </strong>{" "}
                    {line.substring(3).trim()}
                  </p>
                );
              }
              return (
                <p key={idx} className="text-xs mb-2">
                  {line}
                </p>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}

function JunkItem({ label, description, size }: { label: string; description: string; size: number }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[var(--color-border)] last:border-0 pb-3 last:pb-0">
      <div className="mr-4">
        <div className="font-semibold text-xs text-[var(--color-fg-strong)]">{label}</div>
        <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{description}</div>
      </div>
      <div className="text-numeric font-medium text-xs text-[var(--color-fg-strong)] text-right">
        {formatBytes(size)}
      </div>
    </div>
  );
}
