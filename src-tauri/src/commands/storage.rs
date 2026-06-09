use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub free_space: u64,
    pub file_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTypeStat {
    pub category: String,
    pub bytes: u64,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskScanResult {
    pub scanned_path: String,
    pub total_files: u64,
    pub total_dirs: u64,
    pub total_size: u64,
    pub top_files: Vec<FileItem>,
    pub top_dirs: Vec<FileItem>,
    pub file_type_stats: Vec<FileTypeStat>,
}

#[command]
pub fn get_disks() -> Result<Vec<DiskInfo>, String> {
    let mut disks = sysinfo::Disks::new_with_refreshed_list();
    disks.refresh(true);
    
    let mut list = Vec::new();
    for d in disks.iter() {
        let name = d.name().to_string_lossy().into_owned();
        let name = if name.is_empty() {
            d.mount_point().to_string_lossy().into_owned()
        } else {
            name
        };
        list.push(DiskInfo {
            name,
            mount_point: d.mount_point().to_string_lossy().into_owned(),
            total_space: d.total_space(),
            free_space: d.available_space(),
            file_system: d.file_system().to_string_lossy().into_owned(),
        });
    }
    Ok(list)
}

struct ScanState {
    total_files: u64,
    total_dirs: u64,
    total_size: u64,
    top_files: Vec<FileItem>,
    top_dirs: Vec<FileItem>,
    video_bytes: u64, video_count: u64,
    audio_bytes: u64, audio_count: u64,
    image_bytes: u64, image_count: u64,
    doc_bytes: u64, doc_count: u64,
    archive_bytes: u64, archive_count: u64,
    exe_bytes: u64, exe_count: u64,
    other_bytes: u64, other_count: u64,
}

#[command]
pub async fn scan_directory(path: String) -> Result<DiskScanResult, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() {
        return Err("Path does not exist".to_string());
    }

    let mut state = ScanState {
        total_files: 0,
        total_dirs: 0,
        total_size: 0,
        top_files: Vec::with_capacity(200),
        top_dirs: Vec::with_capacity(200),
        video_bytes: 0, video_count: 0,
        audio_bytes: 0, audio_count: 0,
        image_bytes: 0, image_count: 0,
        doc_bytes: 0, doc_count: 0,
        archive_bytes: 0, archive_count: 0,
        exe_bytes: 0, exe_count: 0,
        other_bytes: 0, other_count: 0,
    };

    // Scan using a recursive function that calculates folder sizes
    let _ = scan_dir_recursive(root_path, &mut state, 0);

    // Sort top files and directories by size descending
    state.top_files.sort_by(|a, b| b.size.cmp(&a.size));
    state.top_dirs.sort_by(|a, b| b.size.cmp(&a.size));

    // Keep top 100
    state.top_files.truncate(100);
    state.top_dirs.truncate(100);

    let file_type_stats = vec![
        FileTypeStat { category: "Video".to_string(), bytes: state.video_bytes, count: state.video_count },
        FileTypeStat { category: "Audio".to_string(), bytes: state.audio_bytes, count: state.audio_count },
        FileTypeStat { category: "Images".to_string(), bytes: state.image_bytes, count: state.image_count },
        FileTypeStat { category: "Documents".to_string(), bytes: state.doc_bytes, count: state.doc_count },
        FileTypeStat { category: "Archives".to_string(), bytes: state.archive_bytes, count: state.archive_count },
        FileTypeStat { category: "Executables/Code".to_string(), bytes: state.exe_bytes, count: state.exe_count },
        FileTypeStat { category: "Others".to_string(), bytes: state.other_bytes, count: state.other_count },
    ];

    Ok(DiskScanResult {
        scanned_path: path,
        total_files: state.total_files,
        total_dirs: state.total_dirs,
        total_size: state.total_size,
        top_files: state.top_files,
        top_dirs: state.top_dirs,
        file_type_stats,
    })
}

fn scan_dir_recursive(dir: &Path, state: &mut ScanState, depth: u32) -> u64 {
    // Avoid too deep recursion
    if depth > 12 {
        return 0;
    }

    let mut dir_size = 0;
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return 0,
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().into_owned();

        // Skip system/hidden things like $Recycle.Bin or System Volume Information to avoid hanging/permission errors
        if file_name.starts_with('$') || file_name == "System Volume Information" {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            state.total_dirs += 1;
            let sub_size = scan_dir_recursive(&path, state, depth + 1);
            dir_size += sub_size;

            state.top_dirs.push(FileItem {
                name: file_name,
                path: path.to_string_lossy().into_owned(),
                size: sub_size,
                is_dir: true,
            });
        } else {
            state.total_files += 1;
            let file_size = metadata.len();
            dir_size += file_size;
            state.total_size += file_size;

            // Categorize by extension
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            match ext.as_str() {
                "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" => {
                    state.video_bytes += file_size;
                    state.video_count += 1;
                }
                "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" => {
                    state.audio_bytes += file_size;
                    state.audio_count += 1;
                }
                "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" => {
                    state.image_bytes += file_size;
                    state.image_count += 1;
                }
                "pdf" | "docx" | "doc" | "xlsx" | "xls" | "pptx" | "ppt" | "txt" | "csv" | "md" | "json" | "xml" | "yaml" | "yml" => {
                    state.doc_bytes += file_size;
                    state.doc_count += 1;
                }
                "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "iso" => {
                    state.archive_bytes += file_size;
                    state.archive_count += 1;
                }
                "exe" | "msi" | "bat" | "cmd" | "dll" | "sys" | "rs" | "js" | "ts" | "tsx" | "py" | "go" | "cpp" | "h" | "cs" | "html" | "css" => {
                    state.exe_bytes += file_size;
                    state.exe_count += 1;
                }
                _ => {
                    state.other_bytes += file_size;
                    state.other_count += 1;
                }
            }

            state.top_files.push(FileItem {
                name: file_name,
                path: path.to_string_lossy().into_owned(),
                size: file_size,
                is_dir: false,
            });
        }
    }

    dir_size
}

#[command]
pub fn delete_item(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }

    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete folder: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
    }
}
