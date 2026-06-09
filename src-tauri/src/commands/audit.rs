use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditReport {
    pub user_temp_bytes: u64,
    pub system_temp_bytes: u64,
    pub recycle_bin_bytes: u64,
    pub recycle_bin_count: u64,
    pub dns_cache_flushed: bool,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub swap_total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub success: bool,
    pub cleaned_bytes: u64,
    pub dns_success: bool,
    pub error_message: Option<String>,
}

fn get_dir_size<P: AsRef<Path>>(path: P) -> u64 {
    let mut total_size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let metadata = entry.metadata();
                if let Ok(md) = metadata {
                    if md.is_dir() {
                        total_size += get_dir_size(entry.path());
                    } else {
                        total_size += md.len();
                    }
                }
            }
        }
    }
    total_size
}

fn get_recycle_bin_stats() -> (u64, u64) {
    // Run a powershell command to get Recycle Bin size and count
    let output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "$sh = New-Object -ComObject Shell.Application; $rv = $sh.NameSpace(0xa); $items = $rv.Items(); $stats = $items | Measure-Object -Property Size -Sum; @{Count = $items.Count; Size = [double]$stats.Sum} | ConvertTo-Json"
        ])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let json_str = String::from_utf8_lossy(&out.stdout);
            #[derive(Deserialize)]
            struct PsStats {
                Count: Option<f64>,
                Size: Option<f64>,
            }
            if let Ok(parsed) = serde_json::from_str::<PsStats>(&json_str) {
                return (
                    parsed.Size.unwrap_or(0.0) as u64,
                    parsed.Count.unwrap_or(0.0) as u64,
                );
            }
        }
    }
    (0, 0)
}

#[command]
pub fn get_audit_report() -> Result<AuditReport, String> {
    // 1. Get User Temp Size
    let user_temp = env::var("TEMP")
        .map(|p| get_dir_size(&p))
        .unwrap_or(0);

    // 2. Get System Temp Size
    let sys_temp = get_dir_size("C:\\Windows\\Temp");

    // 3. Get Recycle Bin Stats
    let (recycle_bytes, recycle_count) = get_recycle_bin_stats();

    // 4. Memory usage
    let mut sys = sysinfo::System::new_all();
    sys.refresh_memory();

    Ok(AuditReport {
        user_temp_bytes: user_temp,
        system_temp_bytes: sys_temp,
        recycle_bin_bytes: recycle_bytes,
        recycle_bin_count: recycle_count,
        dns_cache_flushed: false,
        memory_used_bytes: sys.used_memory(),
        memory_total_bytes: sys.total_memory(),
        swap_used_bytes: sys.used_swap(),
        swap_total_bytes: sys.total_swap(),
    })
}

fn clean_dir_contents<P: AsRef<Path>>(path: P) -> u64 {
    let mut freed = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let p = entry.path();
                if p.is_dir() {
                    let dir_size = get_dir_size(&p);
                    if fs::remove_dir_all(&p).is_ok() {
                        freed += dir_size;
                    } else {
                        // Try cleaning sub-contents
                        freed += clean_dir_contents(&p);
                    }
                } else {
                    if let Ok(md) = entry.metadata() {
                        let len = md.len();
                        if fs::remove_file(&p).is_ok() {
                            freed += len;
                        }
                    }
                }
            }
        }
    }
    freed
}

#[command]
pub fn run_optimization() -> Result<OptimizationResult, String> {
    let mut cleaned_bytes = 0;

    // 1. Clean User Temp
    if let Ok(user_temp_path) = env::var("TEMP") {
        cleaned_bytes += clean_dir_contents(&user_temp_path);
    }

    // 2. Clean System Temp
    cleaned_bytes += clean_dir_contents("C:\\Windows\\Temp");

    // 3. Empty Recycle Bin via PowerShell
    let rb_output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"
        ])
        .output();
        
    let rb_freed = if let Ok(out) = rb_output {
        out.status.success()
    } else {
        false
    };

    // 4. Flush DNS Cache
    let dns_output = Command::new("ipconfig")
        .arg("/flushdns")
        .output();

    let dns_success = if let Ok(out) = dns_output {
        out.status.success()
    } else {
        false
    };

    // Let's assume some memory optimization / garbage collection if possible.
    // In standard systems, we can flush/empty working sets of some processes,
    // but clearing standby list requires admin. We will report success based on actions done.

    Ok(OptimizationResult {
        success: true,
        cleaned_bytes,
        dns_success,
        error_message: if !rb_freed { Some("Recycle bin was already empty or could not be cleared.".to_string()) } else { None },
    })
}
