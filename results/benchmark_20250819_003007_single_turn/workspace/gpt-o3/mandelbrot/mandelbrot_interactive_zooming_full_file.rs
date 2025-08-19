// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Arrow keys to pan, +/- to zoom, q to quit.
// Enjoy!
//
use std::env;
use std::io::{Read, Write};
use std::process::Command;

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
    eprintln!("Controls in interactive mode:");
    eprintln!("  Arrow keys - pan");
    eprintln!("  +/-        - zoom in/out");
    eprintln!("  q          - quit");
}
// Enable/disable raw mode without external crates by invoking `stty`.
struct RawMode;
impl RawMode {
    fn new() -> Self {
        // Ignore errors (e.g., when not on a TTY).
        let _ = Command::new("stty").arg("raw").arg("-echo").status();
        RawMode
    }
}
impl Drop for RawMode {
    fn drop(&mut self) {
        let _ = Command::new("stty").arg("sane").status();
    }
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
fn clear_screen() {
    // ANSI clear and cursor home.
    print!("\x1b[2J\x1b[H");
}
fn main() {
    let mut cfg = parse_args();

    // Enter raw mode so we can read single key presses.
    let _raw = RawMode::new();
    let mut stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    loop {
        clear_screen();
        let img = render(cfg);
        print!("{}", img);
        println!(
            "w={} h={} cx={:.5} cy={:.5} scale={:.5} iters={}  (+/- zoom, arrows pan, q quit)",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );
        stdout.flush().unwrap();

        // Read next byte
        let mut buf = [0u8; 1];
        if stdin.read_exact(&mut buf).is_err() {
            break;
        }
        match buf[0] {
            b'q' | b'Q' => break,
            b'+' | b'=' => {
                cfg.scale *= 0.8;
            }
            b'-' => {
                cfg.scale /= 0.8;
            }
            0x1B => {
                // Potential escape sequence.
                let mut seq = [0u8; 2];
                if stdin.read_exact(&mut seq).is_ok() && seq[0] == b'[' {
                    match seq[1] {
                        b'A' => cfg.center_y -= cfg.scale * 0.1, // Up
                        b'B' => cfg.center_y += cfg.scale * 0.1, // Down
                        b'C' => cfg.center_x += cfg.scale * 0.1, // Right
                        b'D' => cfg.center_x -= cfg.scale * 0.1, // Left
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    // RawMode drops here and restores terminal settings.
}