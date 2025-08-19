// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Interactive: Arrow keys to pan, +/- to zoom, q to quit
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::io::{self, Read, Write};
use std::os::unix::io::AsRawFd;
extern "C" {
    fn tcgetattr(fd: i32, termios: *mut Termios) -> i32;
    fn tcsetattr(fd: i32, optional_actions: i32, termios: *const Termios) -> i32;
}
#[repr(C)]
struct Termios {
    c_iflag: u32,
    c_oflag: u32,
    c_cflag: u32,
    c_lflag: u32,
    c_line: u8,
    c_cc: [u8; 32],
    c_ispeed: u32,
    c_ospeed: u32,
}
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
fn set_raw_mode(fd: i32) -> io::Result<Termios> {
    let mut termios = unsafe { std::mem::zeroed::<Termios>() };
    if unsafe { tcgetattr(fd, &mut termios) } != 0 {
        return Err(io::Error::last_os_error());
    }
    let orig = termios;
    termios.c_lflag &= !(0x00000002 | 0x00000008); // ICANON | ECHO
    if unsafe { tcsetattr(fd, 0, &termios) } != 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(orig)
}
fn main() {
    let mut cfg = parse_args();
    let stdin_fd = io::stdin().as_raw_fd();
    let orig_termios = set_raw_mode(stdin_fd).ok();
    
    loop {
        // Clear screen and render
        print!("\x1b[2J\x1b[H");
        let img = render(cfg);
        println!("{}", img);
        eprintln!(
            "w={} h={} cx={:.5} cy={:.5} scale={} iters={}",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );
        eprintln!("Controls: ↑↓←→ pan, +/- zoom, q quit");
        
        // Read single key
        let mut buf = [0u8; 3];
        let _ = io::stdout().flush();
        let n = io::stdin().read(&mut buf).unwrap_or(0);
        if n == 0 { break; }
        
        // Handle input
        let pan = cfg.scale * 0.1;
        match &buf[..n] {
            b"q" | b"Q" => break,
            b"+" | b"=" => cfg.scale *= 0.7,  // zoom in
            b"-" | b"_" => cfg.scale *= 1.4,  // zoom out
            b"\x1b[A" => cfg.center_y -= pan, // up arrow
            b"\x1b[B" => cfg.center_y += pan, // down arrow
            b"\x1b[C" => cfg.center_x += pan, // right arrow
            b"\x1b[D" => cfg.center_x -= pan, // left arrow
            _ => {}
        }
    }
    
    // Restore terminal
    if let Some(orig) = orig_termios {
        unsafe { tcsetattr(stdin_fd, 0, &orig) };
    }
    print!("\x1b[?25h"); // show cursor
}
