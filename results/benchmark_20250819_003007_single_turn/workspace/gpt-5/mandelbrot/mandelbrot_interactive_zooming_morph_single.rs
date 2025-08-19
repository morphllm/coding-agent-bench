// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::io::{self, Read, Write};
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
    eprintln!("Controls (interactive, Unix terminals): arrows to pan, +/- to zoom, q to quit");
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
// Interactive helpers (Unix terminals via `stty`)
#[derive(Debug)]
enum Key { Left, Right, Up, Down, ZoomIn, ZoomOut, Quit, Other }

struct TermGuard;
impl TermGuard {
    fn new() -> Self {
        set_raw_mode(true);
        hide_cursor(true);
        Self
    }
}
impl Drop for TermGuard {
    fn drop(&mut self) {
        hide_cursor(false);
        set_raw_mode(false);
    }
}

fn set_raw_mode(enable: bool) {
    if cfg!(unix) {
        let cmd = if enable { "stty -echo -icanon min 1 time 0" } else { "stty sane" };
        let _ = Command::new("sh").arg("-c").arg(cmd).status();
    }
}

fn hide_cursor(hide: bool) {
    if hide { print!("\x1b[?25l"); } else { print!("\x1b[?25h"); }
    let _ = io::stdout().flush();
}

fn clear_screen() {
    print!("\x1b[2J\x1b[H");
    let _ = io::stdout().flush();
}

fn read_key() -> io::Result<Key> {
    let mut stdin = io::stdin();
    let mut buf = [0u8; 3];
    stdin.read_exact(&mut buf[..1])?;
    match buf[0] {
        b'q' | b'Q' => Ok(Key::Quit),
        b'+' | b'=' => Ok(Key::ZoomIn),
        b'-' | b'_' => Ok(Key::ZoomOut),
        0x1B => {
            // ESC sequence for arrows: ESC [ A/B/C/D
            if stdin.read_exact(&mut buf[1..2]).is_ok() && buf[1] == b'[' {
                if stdin.read_exact(&mut buf[2..3]).is_ok() {
                    return Ok(match buf[2] {
                        b'A' => Key::Up,
                        b'B' => Key::Down,
                        b'C' => Key::Right,
                        b'D' => Key::Left,
                        _ => Key::Other,
                    });
                }
            }
            Ok(Key::Other)
        }
        _ => Ok(Key::Other),
    }
}
fn main() {
    let mut cfg = parse_args();
    if cfg!(unix) {
        let _guard = TermGuard::new();
        loop {
            clear_screen();
            let img = render(cfg);
            print!("{}", img);
            println!(
                "arrows=pan  +/-=zoom  q=quit  |  w={} h={} cx={:.6} cy={:.6} scale={:.6} iters={}",
                cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
            );
            let aspect = cfg.width as f64 / cfg.height as f64;
            let pan_x = cfg.scale * 0.1;
            let pan_y = (cfg.scale / aspect) * 0.1;
            match read_key().unwrap_or(Key::Other) {
                Key::Left => cfg.center_x -= pan_x,
                Key::Right => cfg.center_x += pan_x,
                Key::Up => cfg.center_y -= pan_y,
                Key::Down => cfg.center_y += pan_y,
                Key::ZoomIn => cfg.scale *= 0.8,
                Key::ZoomOut => cfg.scale /= 0.8,
                Key::Quit => break,
                Key::Other => {}
            }
        }
    } else {
        // Fallback for non-Unix: single render and hint
        let img = render(cfg);
        println!("{}", img);
        eprintln!("Interactive mode requires a Unix-like terminal supporting stty.");
    }
}