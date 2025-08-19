// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot
// Interactive controls: Arrow keys to pan, +/- to zoom
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::io::{self, Read, Write};
use std::os::unix::io::AsRawFd;
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
    eprintln!("ASCII Mandelbrot (single file)");
    eprintln!("Usage: mandelbrot [w=80] [h=30] [cx=-0.5] [cy=0.0] [scale=3.0] [iters=80]");
    eprintln!("Controls: Arrow keys to pan, +/- to zoom in/out, q to quit");
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
    out.push_str("\x1b[2J\x1b[H"); // Clear screen and move cursor to top
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

fn setup_raw_mode() -> io::Result<libc::termios> {
    unsafe {
        let mut termios = std::mem::zeroed();
        libc::tcgetattr(io::stdin().as_raw_fd(), &mut termios);
        let old_termios = termios;
        
        libc::cfmakeraw(&mut termios);
        libc::tcsetattr(io::stdin().as_raw_fd(), libc::TCSANOW, &termios);
        
        Ok(old_termios)
    }
}

fn restore_terminal(termios: &libc::termios) {
    unsafe {
        libc::tcsetattr(io::stdin().as_raw_fd(), libc::TCSANOW, termios);
    }
}

fn main() {
    let mut cfg = parse_args();
    
    // Setup terminal for raw input
    let old_termios = match setup_raw_mode() {
        Ok(t) => t,
        Err(_) => {
            eprintln!("Failed to setup terminal");
            return;
        }
    };
    
    // Hide cursor
    print!("\x1b[?25l");
    io::stdout().flush().unwrap();
    
    loop {
        let img = render(cfg);
        print!("{}", img);
        print!("\x1b[{}H", cfg.height + 1); // Move cursor below image
        print!("cx={:.5} cy={:.5} scale={:.3} | Arrow keys: pan, +/-: zoom, q: quit",
               cfg.center_x, cfg.center_y, cfg.scale);
        io::stdout().flush().unwrap();
        
        // Read single character
        let mut buf = [0u8; 3];
        let stdin = io::stdin();
        let mut handle = stdin.lock();
        
        if handle.read(&mut buf[..1]).is_err() {
            break;
        }
        
        match buf[0] {
            b'q' | b'Q' => break,
            b'+' | b'=' => {
                cfg.scale *= 0.8;
            }
            b'-' | b'_' => {
                cfg.scale *= 1.25;
            }
            27 => { // ESC sequence
                if handle.read(&mut buf[1..]).is_ok() && buf[1] == b'[' {
                    let pan_amount = cfg.scale * 0.1;
                    match buf[2] {
                        b'A' => cfg.center_y -= pan_amount, // Up
                        b'B' => cfg.center_y += pan_amount, // Down
                        b'C' => cfg.center_x += pan_amount, // Right
                        b'D' => cfg.center_x -= pan_amount, // Left
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    
    // Restore terminal
    print!("\x1b[?25h"); // Show cursor
    print!("\x1b[2J\x1b[H"); // Clear screen
    io::stdout().flush().unwrap();
    restore_terminal(&old_termios);
}