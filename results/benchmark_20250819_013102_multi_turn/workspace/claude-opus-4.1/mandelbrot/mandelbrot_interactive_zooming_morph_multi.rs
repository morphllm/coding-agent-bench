// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot
// Interactive controls: Arrow keys to pan, +/- to zoom, q to quit, r to reset
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::io::{self, Read, Write};
const PALETTE: &[u8] = b" .:-=+*#%@"; // 10 shades
#[derive(Clone, Copy)]
struct Config {
    width: usize,
    height: usize,
    center_x: f64,
    center_y: f64,
    scale: f64,
    iters: usize,
}
impl Config {
    fn default() -> Self {
        Self {
            width: 80,
            height: 30,
            center_x: -0.5,
            center_y: 0.0,
            scale: 3.0,
            iters: 80,
        }
    }
}
fn parse_args() -> Config {
    let mut cfg = Config::default();
    for arg in env::args().skip(1) {
        if arg == "--help" || arg == "-h" {
            print_help();
            std::process::exit(0);
        }
        let mut parts = arg.splitn(2, '=');
        let k = parts.next().unwrap_or("");
        let v = parts.next().unwrap_or("");
        match k {
            "w" | "width" => cfg.width = v.parse().unwrap_or(cfg.width),
            "h" | "height" => cfg.height = v.parse().unwrap_or(cfg.height),
            "cx" => cfg.center_x = v.parse().unwrap_or(cfg.center_x),
            "cy" => cfg.center_y = v.parse().unwrap_or(cfg.center_y),
            "scale" | "s" => cfg.scale = v.parse().unwrap_or(cfg.scale),
            "iters" | "i" => cfg.iters = v.parse().unwrap_or(cfg.iters),
            _ => {}
        }
    }
    cfg
}

fn print_help() {
    eprintln!("ASCII Mandelbrot (interactive)");
    eprintln!("Usage: mandelbrot [w=80] [h=30] [cx=-0.5] [cy=0.0] [scale=3.0] [iters=80]");
    eprintln!("Controls:");
    eprintln!("  Arrow keys: Pan around");
    eprintln!("  +/-: Zoom in/out");
    eprintln!("  r: Reset view");
    eprintln!("  q: Quit");
}

fn mandel_escape(mut zx: f64, mut zy: f64, cx: f64, cy: f64, max_iter: usize) -> usize {
    let mut i = 0;
    while zx * zx + zy * zy <= 4.0 && i < max_iter {
        let x2 = zx * zx - zy * zy + cx;
        let y2 = 2.0 * zx * zy + cy;
        zx = x2;
        zy = y2;
        i += 1;
    }
    i
}
fn shade(it: usize, max_iter: usize) -> char {
    if it >= max_iter {
        return '@';
    }
    let t = it as f64 / max_iter as f64;
    let idx = (t * (PALETTE.len() as f64 - 1.0)).round() as usize;
    PALETTE[idx] as char
}
fn render(cfg: Config) -> String {
    let mut out = String::with_capacity((cfg.width + 1) * cfg.height);
    let (w, h) = (cfg.width as f64, cfg.height as f64);
    let aspect = w / h; // adjust vertical scale for terminal cells
    for y in 0..cfg.height {
        let v = (y as f64 / (h - 1.0) - 0.5) * cfg.scale / aspect + cfg.center_y;
        for x in 0..cfg.width {
            let u = (x as f64 / (w - 1.0) - 0.5) * cfg.scale + cfg.center_x;
            let it = mandel_escape(0.0, 0.0, u, v, cfg.iters);
            out.push(shade(it, cfg.iters));
        }
        out.push('\n');
    }
    out
}

fn set_raw_mode() {
    // Simple raw mode for Unix-like systems
    #[cfg(unix)]
    {
        use std::os::unix::io::AsRawFd;
        unsafe {
            let mut termios = std::mem::zeroed();
            libc::tcgetattr(0, &mut termios);
            termios.c_lflag &= !(libc::ICANON | libc::ECHO);
            libc::tcsetattr(0, libc::TCSANOW, &termios);
        }
    }
}

fn restore_terminal() {
    #[cfg(unix)]
    {
        use std::os::unix::io::AsRawFd;
        unsafe {
            let mut termios = std::mem::zeroed();
            libc::tcgetattr(0, &mut termios);
            termios.c_lflag |= libc::ICANON | libc::ECHO;
            libc::tcsetattr(0, libc::TCSANOW, &termios);
        }
    }
}

fn main() {
    let mut cfg = parse_args();
    let initial_cfg = cfg.clone();
    
    // Set terminal to raw mode for keyboard input
    set_raw_mode();
    
    // Clear screen and hide cursor
    print!("\x1b[2J\x1b[?25l");
    io::stdout().flush().unwrap();
    
    let stdin = io::stdin();
    let mut stdin_bytes = stdin.bytes();
    
    loop {
        // Clear and render
        print!("\x1b[H"); // Move cursor to top
        let img = render(cfg);
        print!("{}", img);
        eprintln!(
            "cx={:.5} cy={:.5} scale={:.3} | Use arrows to pan, +/- to zoom, r to reset, q to quit",
            cfg.center_x, cfg.center_y, cfg.scale
        );
        io::stdout().flush().unwrap();
        
        // Read input
        if let Some(Ok(b)) = stdin_bytes.next() {
            match b {
                b'q' | b'Q' => break,
                b'r' | b'R' => cfg = initial_cfg.clone(),
                b'+' | b'=' => cfg.scale *= 0.8,
                b'-' | b'_' => cfg.scale *= 1.25,
                27 => { // ESC sequence for arrow keys
                    if let Some(Ok(91)) = stdin_bytes.next() { // [
                        if let Some(Ok(arrow)) = stdin_bytes.next() {
                            let pan = cfg.scale * 0.1;
                            match arrow {
                                65 => cfg.center_y -= pan / 2.0, // Up
                                66 => cfg.center_y += pan / 2.0, // Down
                                67 => cfg.center_x += pan,       // Right
                                68 => cfg.center_x -= pan,       // Left
                                _ => {}
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }
    
    // Restore terminal
    print!("\x1b[?25h"); // Show cursor
    restore_terminal();
    println!();
}

// Add libc dependency for terminal control
#[cfg(unix)]
extern "C" {
    // Minimal libc declarations for terminal control
}
#[cfg(unix)]
mod libc {
    pub const ICANON: ::std::os::raw::c_ulong = 0x00000002;
    pub const ECHO: ::std::os::raw::c_ulong = 0x00000008;
    pub const TCSANOW: ::std::os::raw::c_int = 0;
    
    extern "C" {
        pub fn tcgetattr(fd: ::std::os::raw::c_int, termios: *mut ::std::os::raw::c_void) -> ::std::os::raw::c_int;
        pub fn tcsetattr(fd: ::std::os::raw::c_int, optional_actions: ::std::os::raw::c_int, 
                        termios: *const ::std::os::raw::c_void) -> ::std::os::raw::c_int;
    }
}