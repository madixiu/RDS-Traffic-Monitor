use anyhow::Result;
use crossbeam_channel::Sender;
use dashmap::DashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, BOOLEAN};
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, GetPerTcpConnectionEStats, SetPerTcpConnectionEStats, MIB_TCPROW_LH, MIB_TCPTABLE_OWNER_PID,
    TCP_ESTATS_DATA_ROD_v0, TCP_ESTATS_DATA_RW_v0, TCP_TABLE_OWNER_PID_ALL, TcpConnectionEstatsData,
};
use windows::Win32::Networking::WinSock::AF_INET;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};

use crate::session;
use shared::TrafficEvent;

pub fn spawn_collector(
    tx: Sender<TrafficEvent>,
    shutdown: Arc<AtomicBool>,
    hostname: String,
) -> Result<()> {
    std::thread::Builder::new()
        .name("tcp-poller".into())
        .spawn(move || {
            log::info!("Starting Win32 TCP Poller...");
            
            let connections: DashMap<(u32, u32, u32, u32), (u32, u64, u64)> = DashMap::new();

            while !shutdown.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_secs(2));

                let mut size = 0;
                unsafe {
                    GetExtendedTcpTable(
                        None, &mut size, false, AF_INET.0 as u32, TCP_TABLE_OWNER_PID_ALL, 0,
                    );
                }

                if size == 0 { continue; }

                let mut buffer = vec![0u8; size as usize];
                let res = unsafe {
                    GetExtendedTcpTable(
                        Some(buffer.as_mut_ptr() as *mut _),
                        &mut size, false, AF_INET.0 as u32, TCP_TABLE_OWNER_PID_ALL, 0,
                    )
                };

                if res != 0 { continue; }

                let table = unsafe { &*(buffer.as_ptr() as *const MIB_TCPTABLE_OWNER_PID) };
                let rows = unsafe {
                    std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize)
                };

                let mut active_keys = std::collections::HashSet::new();

                for row in rows {
                    if row.dwState != 5 { continue; } // 5 = ESTABLISHED

                    let pid = row.dwOwningPid;
                    if pid == 0 { continue; }

                    let local_addr = row.dwLocalAddr;
                    let local_port = row.dwLocalPort;
                    let remote_addr = row.dwRemoteAddr;
                    let remote_port = row.dwRemotePort;

                    let key = (local_addr, local_port, remote_addr, remote_port);
                    active_keys.insert(key);

                    let tcp_row_ptr = row as *const _ as *const MIB_TCPROW_LH;

                    let mut rw = TCP_ESTATS_DATA_RW_v0 { EnableCollection: BOOLEAN(1) };
                    let mut rod = TCP_ESTATS_DATA_ROD_v0::default();

                    let rw_slice = unsafe {
                        std::slice::from_raw_parts_mut(&mut rw as *mut _ as *mut u8, std::mem::size_of_val(&rw))
                    };
                    let rod_slice = unsafe {
                        std::slice::from_raw_parts_mut(&mut rod as *mut _ as *mut u8, std::mem::size_of_val(&rod))
                    };

                    // MUST enable collection first! (Corrected to 5 arguments)
                    unsafe {
                        SetPerTcpConnectionEStats(
                            tcp_row_ptr, 
                            TcpConnectionEstatsData, 
                            rw_slice, 
                            0, 
                            0
                        );
                    }

                    let stat_res = unsafe {
                        GetPerTcpConnectionEStats(
                            tcp_row_ptr, TcpConnectionEstatsData, None, 0, None, 0, Some(rod_slice), 0,
                        )
                    };

                    if stat_res != 0 { continue; }

                    let bytes_in = rod.DataBytesIn;
                    let bytes_out = rod.DataBytesOut;

                    if let Some(mut prev) = connections.get_mut(&key) {
                        let prev_pid = prev.0;
                        let prev_in = prev.1;
                        let prev_out = prev.2;

                        prev.1 = bytes_in;
                        prev.2 = bytes_out;

                        if prev_pid == pid {
                            let delta_in = bytes_in.saturating_sub(prev_in);
                            let delta_out = bytes_out.saturating_sub(prev_out);

                            // SANITY CHECK: Ignore values over 100MB in 2 seconds (garbage memory)
                            if delta_in > 100_000_000 || delta_out > 100_000_000 {
                                continue;
                            }

                            if delta_in > 0 || delta_out > 0 {
                                if let Some(session_id) = session::pid_to_session_id(pid) {
                                    let username = session::session_username(session_id)
                                        .unwrap_or_else(|| "UNKNOWN".into());
                                    
                                    let process_name = get_process_name(pid);

                                    let event = TrafficEvent {
                                        ts: chrono::Utc::now().timestamp(),
                                        pid,
                                        session_id,
                                        username,
                                        process_name,
                                        process_start_ts: 0,
                                        bytes_sent: delta_out,
                                        bytes_recv: delta_in,
                                        remote_ip: Some(remote_addr),
                                        remote_port: Some(u16::from_be(remote_port as u16)),
                                        is_udp: false,
                                        hostname: hostname.clone(),
                                    };
                                    let _ = tx.try_send(event);
                                }
                            }
                        }
                    } else {
                        connections.insert(key, (pid, bytes_in, bytes_out));
                    }
                }
                connections.retain(|k, _| active_keys.contains(k));
            }
        })?;
    Ok(())
}

fn get_process_name(pid: u32) -> String {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if let Ok(h) = handle {
            let mut buf = [0u16; 1024];
            let mut size = buf.len() as u32;
            if QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut size).is_ok() {
                let name = String::from_utf16_lossy(&buf[..size as usize]);
                let _ = CloseHandle(h);
                return name.rsplit('\\').next().unwrap_or(&name).to_string();
            }
            let _ = CloseHandle(h);
        }
    }
    "UNKNOWN".into()
}