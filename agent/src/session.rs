use std::ffi::c_void;

#[link(name = "kernel32")]
extern "system" {
    fn ProcessIdToSessionId(dwProcessId: u32, pSessionId: *mut u32) -> i32;
}

#[link(name = "wtsapi32")]
extern "system" {
    fn WTSQuerySessionInformationW(
        hserver: isize,
        sessionid: u32,
        wtsinfoclass: i32,
        ppbuffer: *mut *mut u16,
        pbytesreturned: *mut u32,
    ) -> i32;
    fn WTSFreeMemory(pmemory: *mut c_void);
}

const WTS_CURRENT_SERVER_HANDLE: isize = 0;
const WTS_USERNAME: i32 = 5;

/// Returns None if the PID is gone or belongs to session 0 (services).
pub fn pid_to_session_id(pid: u32) -> Option<u32> {
    let mut sid: u32 = 0;
    let ok = unsafe { ProcessIdToSessionId(pid, &mut sid) };
    if ok != 0 && sid >= 1 {
        Some(sid)
    } else {
        None
    }
}

pub fn session_username(session_id: u32) -> Option<String> {
    let mut buf: *mut u16 = std::ptr::null_mut();
    let mut bytes: u32 = 0;

    let ok = unsafe {
        WTSQuerySessionInformationW(
            WTS_CURRENT_SERVER_HANDLE,
            session_id,
            WTS_USERNAME,
            &mut buf,
            &mut bytes,
        )
    };

    if ok == 0 || buf.is_null() {
        return None;
    }

    let len = (bytes / 2) as usize;
    let slice = unsafe { std::slice::from_raw_parts(buf, len) };
    let end = slice.iter().position(|&c| c == 0).unwrap_or(len);
    let s = String::from_utf16_lossy(&slice[..end]);

    unsafe { WTSFreeMemory(buf as *mut c_void) };

    if s.is_empty() { None } else { Some(s) }
}