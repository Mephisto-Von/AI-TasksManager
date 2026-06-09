import { invoke } from "@tauri-apps/api/core";

export type ProcessRow = {
  pid: number;
  parent_pid: number | null;
  name: string;
  exe: string | null;
  cpu: number;
  mem_bytes: number;
  virt_bytes: number;
  disk_read_bps: number;
  disk_write_bps: number;
  status: string;
  run_time_s: number;
  user: string | null;
  threat: "green" | "yellow" | "red" | string;
};

export type ProcessDetail = {
  pid: number;
  parent_pid: number | null;
  name: string;
  exe: string | null;
  cwd: string | null;
  cmd: string[];
  environ_count: number;
  mem_bytes: number;
  virt_bytes: number;
  cpu: number;
  status: string;
  run_time_s: number;
  start_time_s: number;
  user: string | null;
  threat: string;
};

export type MetricSample = {
  ts_ms: number;
  cpu_total: number;
  per_core: number[];
  mem_used: number;
  mem_total: number;
  swap_used: number;
  swap_total: number;
  disk_read_bps: number;
  disk_write_bps: number;
  net_rx_bps: number;
  net_tx_bps: number;
};

export type SystemSnapshot = {
  cpu_total: number;
  per_core: number[];
  mem_used: number;
  mem_total: number;
  swap_used: number;
  swap_total: number;
  process_count: number;
  uptime_s: number;
  host_name: string | null;
  os_name: string | null;
  kernel: string | null;
  cpu_brand: string | null;
  cpu_cores: number;
};

export type ServiceRow = {
  name: string;
  display_name: string;
  status: string;
  start_type: string;
  pid: number | null;
  service_type: string;
  description: string | null;
};

export type StartupEntry = {
  source: string;
  scope: string;
  name: string;
  command: string;
  enabled: boolean;
};

export type AiConfig = {
  api_key: string;
  model?: string;
  base_url?: string;
};

export type AiReply = {
  answer: string;
  cached: boolean;
};

export type DiskInfo = {
  name: string;
  mount_point: string;
  total_space: number;
  free_space: number;
  file_system: string;
};

export type FileItem = {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
};

export type FileTypeStat = {
  category: string;
  bytes: number;
  count: number;
};

export type DiskScanResult = {
  scanned_path: string;
  total_files: number;
  total_dirs: number;
  total_size: number;
  top_files: FileItem[];
  top_dirs: FileItem[];
  file_type_stats: FileTypeStat[];
};

export type AuditReport = {
  user_temp_bytes: number;
  system_temp_bytes: number;
  recycle_bin_bytes: number;
  recycle_bin_count: number;
  dns_cache_flushed: boolean;
  memory_used_bytes: number;
  memory_total_bytes: number;
  swap_used_bytes: number;
  swap_total_bytes: number;
};

export type OptimizationResult = {
  success: boolean;
  cleaned_bytes: number;
  dns_success: boolean;
  error_message: string | null;
};

export type NetworkConnection = {
  protocol: string;
  local_address: string;
  foreign_address: string;
  state: string;
  pid: number | null;
};

// Check if running in Tauri container
const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

// Simulated historical buffer for performance sparklines
const mockHistory: MetricSample[] = Array.from({ length: 60 }, (_, i) => ({
  ts_ms: Date.now() - (60 - i) * 1000,
  cpu_total: 10 + Math.random() * 30,
  per_core: [15 + Math.random() * 20, 8 + Math.random() * 25, 20 + Math.random() * 15, 5 + Math.random() * 30],
  mem_used: 6 * 1024 * 1024 * 1024 + Math.random() * 500_000_000,
  mem_total: 16 * 1024 * 1024 * 1024,
  swap_used: 1 * 1024 * 1024 * 1024,
  swap_total: 4 * 1024 * 1024 * 1024,
  disk_read_bps: Math.random() > 0.5 ? Math.random() * 1_500_000 : 0,
  disk_write_bps: Math.random() > 0.7 ? Math.random() * 800_000 : 0,
  net_rx_bps: Math.random() > 0.3 ? Math.random() * 200_000 : 0,
  net_tx_bps: Math.random() > 0.6 ? Math.random() * 50_000 : 0,
}));

function getMockData(cmd: string, args?: Record<string, any>): any {
  switch (cmd) {
    case "list_processes":
      return [
        { pid: 0, parent_pid: null, name: "System Idle Process", exe: null, cpu: 75.2, mem_bytes: 8192, virt_bytes: 8192, disk_read_bps: 0, disk_write_bps: 0, status: "Run", run_time_s: 99999, user: "SYSTEM", threat: "green" },
        { pid: 4, parent_pid: null, name: "System", exe: null, cpu: 2.1, mem_bytes: 150_000, virt_bytes: 200_000, disk_read_bps: 1200, disk_write_bps: 45000, status: "Run", run_time_s: 99999, user: "SYSTEM", threat: "green" },
        { pid: 124, parent_pid: 4, name: "Registry", exe: null, cpu: 0.1, mem_bytes: 65_000_000, virt_bytes: 120_000_000, disk_read_bps: 0, disk_write_bps: 2000, status: "Run", run_time_s: 99999, user: "SYSTEM", threat: "green" },
        { pid: 840, parent_pid: 4, name: "explorer.exe", exe: "C:\\Windows\\explorer.exe", cpu: 1.5, mem_bytes: 185_000_000, virt_bytes: 450_000_000, disk_read_bps: 0, disk_write_bps: 0, status: "Run", run_time_s: 12400, user: "Aleena", threat: "green" },
        { pid: 2012, parent_pid: 840, name: "chrome.exe", exe: "C:\\Program Files\\Google\\Chrome\\chrome.exe", cpu: 8.4, mem_bytes: 420_000_000, virt_bytes: 980_000_000, disk_read_bps: 15000, disk_write_bps: 0, status: "Run", run_time_s: 4300, user: "Aleena", threat: "green" },
        { pid: 2110, parent_pid: 2012, name: "chrome.exe (Child Tab)", exe: "C:\\Program Files\\Google\\Chrome\\chrome.exe", cpu: 0.8, mem_bytes: 110_000_000, virt_bytes: 320_000_000, disk_read_bps: 0, disk_write_bps: 0, status: "Run", run_time_s: 4200, user: "Aleena", threat: "green" },
        { pid: 3412, parent_pid: 840, name: "spotify.exe", exe: "C:\\Users\\Aleena\\AppData\\Local\\Spotify\\spotify.exe", cpu: 3.5, mem_bytes: 145_000_000, virt_bytes: 350_000_000, disk_read_bps: 45000, disk_write_bps: 12000, status: "Run", run_time_s: 1800, user: "Aleena", threat: "green" },
        { pid: 9021, parent_pid: null, name: "svchost.exe", exe: "C:\\Windows\\System32\\svchost.exe", cpu: 0.2, mem_bytes: 42_000_000, virt_bytes: 150_000_000, disk_read_bps: 0, disk_write_bps: 0, status: "Run", run_time_s: 99999, user: "SYSTEM", threat: "green" },
        { pid: 8872, parent_pid: 840, name: "miner.exe", exe: "C:\\Users\\Aleena\\Downloads\\miner.exe", cpu: 12.0, mem_bytes: 95_000_000, virt_bytes: 190_000_000, disk_read_bps: 0, disk_write_bps: 0, status: "Run", run_time_s: 150, user: "Aleena", threat: "red" },
      ];
    case "process_detail":
      const pid = args?.pid || 0;
      return {
        pid,
        parent_pid: pid === 2110 ? 2012 : 840,
        name: pid === 8872 ? "miner.exe" : "chrome.exe",
        exe: pid === 8872 ? "C:\\Users\\Aleena\\Downloads\\miner.exe" : "C:\\Program Files\\Google\\Chrome\\chrome.exe",
        cwd: "C:\\",
        cmd: pid === 8872 ? ["C:\\Users\\Aleena\\Downloads\\miner.exe", "--background"] : ["C:\\Program Files\\Google\\Chrome\\chrome.exe", "--type=renderer"],
        environ_count: 35,
        mem_bytes: 250_000_000,
        virt_bytes: 520_000_000,
        cpu: 1.2,
        status: "Run",
        run_time_s: 3000,
        start_time_s: Date.now() / 1000 - 3000,
        user: "Aleena",
        threat: pid === 8872 ? "red" : "green",
      };
    case "system_snapshot":
      const last = mockHistory[mockHistory.length - 1];
      return {
        cpu_total: last.cpu_total,
        per_core: last.per_core,
        mem_used: last.mem_used,
        mem_total: last.mem_total,
        swap_used: last.swap_used,
        swap_total: last.swap_total,
        process_count: 98,
        uptime_s: 184500,
        host_name: "DEMO-PC",
        os_name: "Windows 11 Pro",
        kernel: "10.0.22631",
        cpu_brand: "AMD Ryzen 7 5800X 8-Core Processor",
        cpu_cores: 8,
      };
    case "metrics_history":
      // update timestamp dynamically
      mockHistory.forEach((sample, i) => {
        sample.ts_ms = Date.now() - (60 - i) * 1000;
        // slightly shift variables for animation effect
        sample.cpu_total = Math.max(0, Math.min(100, sample.cpu_total + (Math.random() - 0.5) * 4));
      });
      return mockHistory;
    case "list_services":
      return [
        { name: "wuauserv", display_name: "Windows Update", status: "Running", start_type: "Manual", pid: 9021, service_type: "ShareProcess", description: "Enables the detection, download, and installation of updates for Windows." },
        { name: "Windefend", display_name: "Microsoft Defender Antivirus Service", status: "Running", start_type: "Automatic", pid: 1844, service_type: "OwnProcess", description: "Helps protect users from malware and other security threats." },
        { name: "Spooler", display_name: "Print Spooler", status: "Stopped", start_type: "Automatic", pid: null, service_type: "ShareProcess", description: "Loads files to memory for printing later." },
      ];
    case "list_startup_entries":
      return [
        { source: "Registry Run", scope: "HKCU", name: "Spotify", command: "C:\\Users\\Aleena\\AppData\\Local\\Spotify\\Spotify.exe --minimized", enabled: true },
        { source: "Registry Run", scope: "HKLM", name: "OneDrive", command: "C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe /background", enabled: true },
        { source: "Startup Folder", scope: "User", name: "Discord", command: "C:\\Users\\Aleena\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe", enabled: false },
      ];
    case "get_disks":
      return [
        { name: "Local Disk (C:)", mount_point: "C:\\", total_space: 512_000_000_000, free_space: 184_000_000_000, file_system: "NTFS" },
        { name: "Data Disk (D:)", mount_point: "D:\\", total_space: 1_000_000_000_000, free_space: 620_000_000_000, file_system: "NTFS" },
      ];
    case "scan_directory":
      return {
        scanned_path: args?.path || "C:\\",
        total_files: 41250,
        total_dirs: 8520,
        total_size: 328_000_000_000,
        top_files: [
          { name: "huge_video.mkv", path: (args?.path || "C:\\") + "Downloads\\huge_video.mkv", size: 14_500_000_000, is_dir: false },
          { name: "installer_packages.zip", path: (args?.path || "C:\\") + "Archives\\installer_packages.zip", size: 8_200_000_000, is_dir: false },
          { name: "virtual_disk.vhdx", path: (args?.path || "C:\\") + "VMs\\virtual_disk.vhdx", size: 25_800_000_000, is_dir: false },
        ],
        top_dirs: [
          { name: "Program Files", path: (args?.path || "C:\\") + "Program Files", size: 85_000_000_000, is_dir: true },
          { name: "Users", path: (args?.path || "C:\\") + "Users", size: 120_000_000_000, is_dir: true },
          { name: "Windows", path: (args?.path || "C:\\") + "Windows", size: 32_000_000_000, is_dir: true },
        ],
        file_type_stats: [
          { category: "Video", bytes: 48_000_000_000, count: 120 },
          { category: "Audio", bytes: 4_500_000_000, count: 900 },
          { category: "Images", bytes: 12_000_000_000, count: 5400 },
          { category: "Documents", bytes: 8_000_000_000, count: 18200 },
          { category: "Archives", bytes: 64_000_000_000, count: 85 },
          { category: "Executables/Code", bytes: 92_000_000_000, count: 1540 },
          { category: "Others", bytes: 99_500_000_000, count: 15000 },
        ],
      };
    case "get_network_connections":
      return [
        { protocol: "TCP", local_address: "127.0.0.1:54321", foreign_address: "127.0.0.1:54322", state: "ESTABLISHED", pid: 2012 },
        { protocol: "TCP", local_address: "192.168.1.15:49811", foreign_address: "172.217.16.142:443", state: "ESTABLISHED", pid: 2012 },
        { protocol: "TCP", local_address: "0.0.0.0:8000", foreign_address: "*:*", state: "LISTENING", pid: 4 },
        { protocol: "UDP", local_address: "[::]:5353", foreign_address: "*:*", state: "—", pid: 3412 },
        { protocol: "TCP", local_address: "192.168.1.15:49921", foreign_address: "142.250.190.46:443", state: "ESTABLISHED", pid: 8872 },
      ];
    case "get_audit_report":
      return {
        user_temp_bytes: 420_000_000,
        system_temp_bytes: 150_000_000,
        recycle_bin_bytes: 1_250_000_000,
        recycle_bin_count: 45,
        dns_cache_flushed: false,
        memory_used_bytes: 7 * 1024 * 1024 * 1024,
        memory_total_bytes: 16 * 1024 * 1024 * 1024,
        swap_used_bytes: 1 * 1024 * 1024 * 1024,
        swap_total_bytes: 4 * 1024 * 1024 * 1024,
      };
    case "run_optimization":
      return {
        success: true,
        cleaned_bytes: 1_820_000_000,
        dns_success: true,
        error_message: null,
      };
    case "explain_process":
      return {
        answer: "This is a simulated process explanation for demo mode. In production, this call queries the AI endpoint to parse file headers and process scopes.",
        cached: true,
      };
    case "explain_system":
      return {
        answer: "This is a simulated PC diagnostic. Your CPU is running optimal. Chrome is taking 420MB. Clear your temp files in the Audit tab to free up 1.8GB of space.",
        cached: false,
      };
    default:
      return null;
  }
}

export const ipc = {
  listProcesses: () => (isTauri ? invoke<ProcessRow[]>("list_processes") : Promise.resolve(getMockData("list_processes"))),
  killProcess: (pid: number) => (isTauri ? invoke<boolean>("kill_process", { pid }) : Promise.resolve(true)),
  processDetail: (pid: number) => (isTauri ? invoke<ProcessDetail | null>("process_detail", { pid }) : Promise.resolve(getMockData("process_detail", { pid }))),

  systemSnapshot: () => (isTauri ? invoke<SystemSnapshot>("system_snapshot") : Promise.resolve(getMockData("system_snapshot"))),
  metricsHistory: () => (isTauri ? invoke<MetricSample[]>("metrics_history") : Promise.resolve(getMockData("metrics_history"))),

  listServices: () => (isTauri ? invoke<ServiceRow[]>("list_services") : Promise.resolve(getMockData("list_services"))),
  setServiceState: (name: string, action: string) => (isTauri ? invoke<void>("set_service_state", { name, action }) : Promise.resolve()),

  listStartupEntries: () => (isTauri ? invoke<StartupEntry[]>("list_startup_entries") : Promise.resolve(getMockData("list_startup_entries"))),
  setStartupEnabled: (name: string, scope: string, enabled: boolean) => (isTauri ? invoke<void>("set_startup_enabled", { name, scope, enabled }) : Promise.resolve()),

  explainProcess: (config: AiConfig, input: Record<string, unknown>) => (isTauri ? invoke<AiReply>("explain_process", { config, input }) : Promise.resolve(getMockData("explain_process", input))),
  explainSystem: (config: AiConfig, input: Record<string, unknown>) => (isTauri ? invoke<AiReply>("explain_system", { config, input }) : Promise.resolve(getMockData("explain_system", input))),

  getDisks: () => (isTauri ? invoke<DiskInfo[]>("get_disks") : Promise.resolve(getMockData("get_disks"))),
  scanDirectory: (path: string) => (isTauri ? invoke<DiskScanResult>("scan_directory", { path }) : Promise.resolve(getMockData("scan_directory", { path }))),
  deleteItem: (path: string) => (isTauri ? invoke<void>("delete_item", { path }) : Promise.resolve()),
  getAuditReport: () => (isTauri ? invoke<AuditReport>("get_audit_report") : Promise.resolve(getMockData("get_audit_report"))),
  runOptimization: () => (isTauri ? invoke<OptimizationResult>("run_optimization") : Promise.resolve(getMockData("run_optimization"))),
  getNetworkConnections: () => (isTauri ? invoke<NetworkConnection[]>("get_network_connections") : Promise.resolve(getMockData("get_network_connections"))),
};
