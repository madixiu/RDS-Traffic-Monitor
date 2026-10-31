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
    // Use Strings for IPs to avoid ANY endianness issues between pcap and Windows API
    // Key: (Server IP, Server Port, Client IP, Client Port) -> Domain
    let dns_cache: Arc<DashMap<(String, u16, String, u16), String>> = Arc::new(DashMap::new());
    
    // 1. Start the Packet Sniffer
    let dns_cache_clone = dns_cache.clone();
    let shutdown_dns = shutdown.clone();
    std::thread::Builder::new()
        .name("sni-sniffer".into())
        .spawn(move || {
            let device = pcap::Device::list().unwrap_or_default().into_iter()
                .find(|d| {
                    !d.name.contains("Loopback") && 
                    !d.name.contains("Npcap_Loopback") && 
                    d.addresses.iter().any(|a| a.addr.is_ipv4())
                })
                .unwrap_or_else(|| pcap::Device::lookup().unwrap().unwrap());

            let mut cap = match pcap::Capture::from_device(device)
                .unwrap().promisc(false).snaplen(4096).timeout(1000).immediate_mode(true).open() 
            {
                Ok(c) => c,
                Err(e) => { log::error!("FAILED to open capture: {:?}", e); return; }
            };

            if let Err(e) = cap.filter("udp port 53 or tcp dst port 443", true) {
                log::error!("FAILED to set pcap filter: {:?}", e);
                return;
            }
            
            log::info!("Sniffer attached. Waiting for traffic...");

            let mut tcp_buffers: std::collections::HashMap<(String, u16, String, u16), Vec<u8>> = std::collections::HashMap::new();

            while !shutdown_dns.load(Ordering::Relaxed) {
                match cap.next_packet() {
                    Ok(packet) => {
                        if let Some((src_ip, dest_ip, src_port, dest_port, protocol, payload)) = parse_packet(packet.data) {
                            
                            if protocol == 17 && src_port == 53 {
                                if let Some((domain, ips)) = parse_dns_ips(payload) {
                                    let root_domain = match psl::domain_str(&domain) {
                                        Some(d) => d.to_string(),
                                        None => domain.clone(),
                                    };
                                    for ip_str in ips {
                                        // Map domain to IP (Port 0 means "any port")
                                        dns_cache_clone.insert((ip_str.clone(), 0, "".to_string(), 0), root_domain.clone());
                                        log::info!("*** DNS CAUGHT: {} -> {} ***", root_domain, ip_str);
                                    }
                                }
                            } else if protocol == 6 && dest_port == 443 && !payload.is_empty() {
                                let key = (dest_ip.clone(), dest_port, src_ip.clone(), src_port);
                                let buf = tcp_buffers.entry(key.clone()).or_insert_with(Vec::new);
                                buf.extend_from_slice(payload);
                                
                                if let Some(sni) = extract_sni_from_stream(buf) {
                                    let root_domain = match psl::domain_str(&sni) {
                                        Some(d) => d.to_string(),
                                        None => sni.clone(),
                                    };
                                    // CLONE the key here so we can use it again below
                                    dns_cache_clone.insert(key.clone(), root_domain.clone());
                                    // Also map the IP alone just in case
                                    dns_cache_clone.insert((dest_ip.clone(), 0, "".to_string(), 0), root_domain.clone());
                                    log::info!("*** TLS SNI CAUGHT: {} -> {} ***", root_domain, dest_ip);
                                    tcp_buffers.remove(&key);
                                } else if buf.len() > 4096 {
                                    tcp_buffers.remove(&key);
                                }
                            }
                        }
                    }
                    Err(pcap::Error::TimeoutExpired) => { continue; }
                    Err(e) => { log::error!("pcap error: {:?}", e); break; }
                }
            }
        })?;

    // 2. Start the TCP Poller
    let dns_cache_poller = dns_cache.clone();
    std::thread::Builder::new()
        .name("tcp-poller".into())
        .spawn(move || {
            let connections: DashMap<(u32, u32, u32, u32), (u32, u64, u64)> = DashMap::new();

            while !shutdown.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_secs(2));

                let mut size = 0;
                unsafe { GetExtendedTcpTable(None, &mut size, false, AF_INET.0 as u32, TCP_TABLE_OWNER_PID_ALL, 0); }
                if size == 0 { continue; }

                let mut buffer = vec![0u8; size as usize];
                let res = unsafe {
                    GetExtendedTcpTable(Some(buffer.as_mut_ptr() as *mut _), &mut size, false, AF_INET.0 as u32, TCP_TABLE_OWNER_PID_ALL, 0)
                };
                if res != 0 { continue; }

                let table = unsafe { &*(buffer.as_ptr() as *const MIB_TCPTABLE_OWNER_PID) };
                let rows = unsafe { std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize) };
                let mut active_keys = std::collections::HashSet::new();

                for row in rows {
                    if row.dwState != 5 { continue; }
                    let pid = row.dwOwningPid;
                    if pid == 0 { continue; }

                    let remote_addr = row.dwRemoteAddr;
                    let local_addr = row.dwLocalAddr;
                    let local_port = row.dwLocalPort;
                    let remote_port = row.dwRemotePort;

                    let remote_ip_str = format!("{}", std::net::Ipv4Addr::from(u32::from_be(remote_addr)));
                    let local_ip_str = format!("{}", std::net::Ipv4Addr::from(u32::from_be(local_addr)));

                    if remote_ip_str.starts_with("127.") || remote_ip_str.starts_with("0.") || remote_ip_str.starts_with("192.168.") { continue; }

                    let local_port_host = u16::from_be(local_port as u16);
                    let remote_port_host = u16::from_be(remote_port as u16);

                    let key = (local_addr, local_port, remote_addr, remote_port);
                    active_keys.insert(key);

                    let tcp_row_ptr = row as *const _ as *const MIB_TCPROW_LH;
                    let mut rw = TCP_ESTATS_DATA_RW_v0 { EnableCollection: BOOLEAN(1) };
                    let mut rod = TCP_ESTATS_DATA_ROD_v0::default();

                    let rw_slice = unsafe { std::slice::from_raw_parts_mut(&mut rw as *mut _ as *mut u8, std::mem::size_of_val(&rw)) };
                    let rod_slice = unsafe { std::slice::from_raw_parts_mut(&mut rod as *mut _ as *mut u8, std::mem::size_of_val(&rod)) };

                    unsafe { SetPerTcpConnectionEStats(tcp_row_ptr, TcpConnectionEstatsData, rw_slice, 0, 0); }
                    let stat_res = unsafe { GetPerTcpConnectionEStats(tcp_row_ptr, TcpConnectionEstatsData, None, 0, None, 0, Some(rod_slice), 0) };
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

                            if delta_in > 100_000_000 || delta_out > 100_000_000 { continue; }

                            if delta_in > 0 || delta_out > 0 {
                                if let Some(session_id) = session::pid_to_session_id(pid) {
                                    let username = session::session_username(session_id).unwrap_or_else(|| "UNKNOWN".into());
                                    let process_name = get_process_name(pid);
                                    
                                    // Look up using the exact same String keys the sniffer used
                                    let tuple_key = (remote_ip_str.clone(), remote_port_host, local_ip_str.clone(), local_port_host);
                                    let ip_key = (remote_ip_str.clone(), 0, "".to_string(), 0);
                                    
                                    let website = dns_cache_poller.get(&tuple_key)
                                        .or_else(|| dns_cache_poller.get(&ip_key))
                                        .map(|d| d.clone())
                                        .unwrap_or_else(|| remote_ip_str.clone());

                                    let event = TrafficEvent {
                                        ts: chrono::Utc::now().timestamp(),
                                        pid, session_id, username, process_name,
                                        process_start_ts: 0,
                                        bytes_sent: delta_out,
                                        bytes_recv: delta_in,
                                        remote_ip: Some(remote_addr),
                                        remote_port: Some(remote_port_host),
                                        is_udp: false,
                                        hostname: hostname.clone(),
                                        website,
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

fn parse_packet(packet: &[u8]) -> Option<(String, String, u16, u16, u8, &[u8])> {
    if packet.len() < 14 { return None; }
    let mut ip_offset = 14;
    let mut ether_type = u16::from_be_bytes([packet[12], packet[13]]);
    
    if ether_type == 0x8100 {
        ip_offset += 4;
        if packet.len() < ip_offset + 2 { return None; }
        ether_type = u16::from_be_bytes([packet[ip_offset - 2], packet[ip_offset - 1]]);
    }
    if ether_type != 0x0800 { return None; }
    if packet.len() < ip_offset + 20 { return None; }
    
    let ip_header_len = (packet[ip_offset] & 0x0F) as usize * 4;
    let protocol = packet[ip_offset + 9];
    
    let src_ip = format!("{}.{}.{}.{}", packet[ip_offset+12], packet[ip_offset+13], packet[ip_offset+14], packet[ip_offset+15]);
    let dest_ip = format!("{}.{}.{}.{}", packet[ip_offset+16], packet[ip_offset+17], packet[ip_offset+18], packet[ip_offset+19]);
    
    let transport_offset = ip_offset + ip_header_len;
    if packet.len() < transport_offset { return None; }

    if protocol == 6 {
        if packet.len() < transport_offset + 20 { return None; }
        let src_port = u16::from_be_bytes([packet[transport_offset], packet[transport_offset + 1]]);
        let dest_port = u16::from_be_bytes([packet[transport_offset + 2], packet[transport_offset + 3]]);
        let tcp_header_len = ((packet[transport_offset + 12] >> 4) & 0x0F) as usize * 4;
        let payload = &packet[transport_offset + tcp_header_len..];
        Some((src_ip, dest_ip, src_port, dest_port, protocol, payload))
    } else if protocol == 17 {
        if packet.len() < transport_offset + 8 { return None; }
        let src_port = u16::from_be_bytes([packet[transport_offset], packet[transport_offset + 1]]);
        let dest_port = u16::from_be_bytes([packet[transport_offset + 2], packet[transport_offset + 3]]);
        let payload = &packet[transport_offset + 8..];
        Some((src_ip, dest_ip, src_port, dest_port, protocol, payload))
    } else {
        None
    }
}

fn extract_sni_from_stream(buf: &[u8]) -> Option<String> {
    if buf.len() < 50 || buf[0] != 0x16 || buf[5] != 0x01 { return None; } 
    let mut i = 43;
    if i >= buf.len() { return None; }
    i += 1 + buf[i] as usize;
    if i + 2 > buf.len() { return None; }
    let ciphers_len = u16::from_be_bytes([buf[i], buf[i+1]]) as usize;
    i += 2 + ciphers_len;
    if i + 1 > buf.len() { return None; }
    i += 1 + buf[i] as usize;
    if i + 2 > buf.len() { return None; }
    let ext_len = u16::from_be_bytes([buf[i], buf[i+1]]) as usize;
    i += 2;
    let end = i + ext_len;

    while i + 4 <= end && i + 4 <= buf.len() {
        let ext_type = u16::from_be_bytes([buf[i], buf[i+1]]);
        let ext_size = u16::from_be_bytes([buf[i+2], buf[i+3]]) as usize;
        i += 4;
        if ext_type == 0x0000 {
            if i + 5 <= end && i + 5 <= buf.len() {
                let name_len = u16::from_be_bytes([buf[i+3], buf[i+4]]) as usize;
                if i + 5 + name_len <= buf.len() {
                    if let Ok(name) = std::str::from_utf8(&buf[i+5 .. i+5+name_len]) {
                        return Some(name.to_string());
                    }
                }
            }
        }
        i += ext_size;
    }
    None
}

fn parse_dns_ips(payload: &[u8]) -> Option<(String, Vec<String>)> {
    if payload.len() < 12 { return None; }
    let flags = u16::from_be_bytes([payload[2], payload[3]]);
    if (flags & 0x8000) == 0 { return None; }
    let qdcount = u16::from_be_bytes([payload[4], payload[5]]);
    let ancount = u16::from_be_bytes([payload[6], payload[7]]);
    if qdcount == 0 || ancount == 0 { return None; }
    
    let mut i = 12;
    let mut domain = String::new();
    while i < payload.len() {
        let len = payload[i] as usize;
        if len == 0 { i += 1; break; }
        if len & 0xC0 != 0 { break; }
        if i + 1 + len > payload.len() { return None; }
        if !domain.is_empty() { domain.push('.'); }
        domain.push_str(std::str::from_utf8(&payload[i+1 .. i+1+len]).ok()?);
        i += 1 + len;
    }
    i += 4; 
    let mut ips = Vec::new();
    for _ in 0..ancount {
        if i >= payload.len() { break; }
        if payload[i] & 0xC0 == 0xC0 {
            i += 2;
        } else {
            while i < payload.len() {
                let len = payload[i] as usize;
                if len == 0 { i += 1; break; }
                i += 1 + len;
            }
        }
        if i + 10 > payload.len() { break; }
        let rtype = u16::from_be_bytes([payload[i], payload[i+1]]);
        let rdlength = u16::from_be_bytes([payload[i+8], payload[i+9]]) as usize;
        i += 10;
        if i + rdlength > payload.len() { break; }
        if rtype == 1 && rdlength == 4 {
            let ip = format!("{}.{}.{}.{}", payload[i], payload[i+1], payload[i+2], payload[i+3]);
            ips.push(ip);
        }
        i += rdlength;
    }
    if ips.is_empty() { None } else { Some((domain, ips)) }
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