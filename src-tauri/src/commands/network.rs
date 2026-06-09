use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub protocol: String,
    pub local_address: String,
    pub foreign_address: String,
    pub state: String,
    pub pid: Option<u32>,
}

#[command]
pub fn get_network_connections() -> Result<Vec<NetworkConnection>, String> {
    let output = Command::new("netstat")
        .arg("-ano")
        .output()
        .map_err(|e| format!("Failed to execute netstat: {}", e))?;

    if !output.status.success() {
        return Err("netstat command failed".to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut connections = Vec::new();

    for line in stdout_str.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() || parts[0].to_uppercase() == "PROTO" || parts[0].starts_with("Active") {
            continue;
        }

        // Protocol, Local, Foreign, State (only TCP has state), PID
        // TCP typically has 5 parts: [ "TCP", "127.0.0.1:49673", "127.0.0.1:49674", "ESTABLISHED", "1234" ]
        // UDP typically has 4 parts: [ "UDP", "[::]:5353", "*:*", "2048" ]
        let protocol = parts[0].to_string();
        if protocol != "TCP" && protocol != "UDP" {
            continue;
        }

        let local_address = parts[1].to_string();
        let foreign_address = parts[2].to_string();

        let (state, pid_str) = if protocol == "TCP" && parts.len() >= 5 {
            (parts[3].to_string(), parts[4])
        } else if parts.len() >= 4 {
            ("—".to_string(), parts[3])
        } else {
            continue;
        };

        let pid = pid_str.parse::<u32>().ok();

        connections.push(NetworkConnection {
            protocol,
            local_address,
            foreign_address,
            state,
            pid,
        });
    }

    Ok(connections)
}
