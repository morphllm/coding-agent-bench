// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Interactive: Arrow keys to pan, +/- to zoom, q to quit
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::io::{self, Read, Write};
use std::os::unix::io::AsRawFd;
extern crate libc;
use libc::termios;
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
fn setup_raw_mode() -> termios::Termios {
    let stdin_fd = io::stdin().as_raw_fd();
    let mut termios = termios::tcgetattr(stdin_fd).unwrap();
    let orig_termios = termios.clone();
    termios::cfmakeraw(&mut termios);
    termios::tcsetattr(stdin_fd, termios::TCSANOW, &termios).unwrap();
    orig_termios
}

fn restore_terminal(orig: termios::Termios) {
    let stdin_fd = io::stdin().as_raw_fd();
    termios::tcsetattr(stdin_fd, termios::TCSANOW, &orig).unwrap();
}

fn clear_screen() {
    print!("\x1b[2J\x1b[H");
    io::stdout().flush().unwrap();
}

fn main() {
    let mut cfg = parse_args();
    
    // Set up terminal for raw input
    let orig_termios = setup_raw_mode();
    clear_screen();
    
    // Initial render
    let img = render(cfg);
    print!("{}", img);
    eprintln!(
        "w={} h={} cx={:.5} cy={:.5} scale={} iters={}",
        cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
    );
    eprintln!("Controls: Arrow keys to pan, +/- to zoom, q to quit");
    io::stdout().flush().unwrap();
    
    // Interactive loop
    let stdin = io::stdin();
    let mut buffer = [0u8; 3];
    loop {
        if let Ok(n) = stdin.read(&mut buffer) {
            if n == 0 { continue; }
            
            let mut redraw = false;
            let pan_step = cfg.scale * 0.1;
            let zoom_factor = 1.2;
            
            match buffer[0] {
                b'q' | b'Q' => break,
                b'+' | b'=' => {
                    cfg.scale /= zoom_factor;
                    redraw = true;
                }
                b'-' | b'_' => {
                    cfg.scale *= zoom_factor;
                    redraw = true;
                }
                27 if n >= 3 && buffer[1] == b'[' => {
                    match buffer[2] {
                        b'A' => { cfg.center_y -= pan_step; redraw = true; } // Up
                        b'B' => { cfg.center_y += pan_step; redraw = true; } // Down
                        b'C' => { cfg.center_x += pan_step; redraw = true; } // Right
                        b'D' => { cfg.center_x -= pan_step; redraw = true; } // Left
                        _ => {}
                    }
                }
                _ => {}
            }
            
            if redraw {
                clear_screen();
                let img = render(cfg);
                print!("{}", img);
                eprintln!(
                    "w={} h={} cx={:.5} cy={:.5} scale={} iters={}",
                    cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
                );
                eprintln!("Controls: Arrow keys to pan, +/- to zoom, q to quit");
                io::stdout().flush().unwrap();
            }
        }
    }
    
    // Restore terminal
    restore_terminal(orig_termios);
    clear_screen();
}
