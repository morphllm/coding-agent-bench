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
    eprintln!("Interactive controls: arrows pan, +/- zoom, q quit");
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
// Minimal raw-mode via `stty` (Unix). Falls back silently if unavailable.
struct RawMode {
    orig: Option<String>,
}
impl RawMode {
    fn new() -> Self {
        let orig = Command::new("stty").arg("-g").output().ok().and_then(|o| {
            String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
        });
        let _ = Command::new("stty").args(["-echo", "-icanon", "min", "1"]).status();
        Self { orig }
    }
}
impl Drop for RawMode {
    fn drop(&mut self) {
        if let Some(ref s) = self.orig {
            let _ = Command::new("stty").arg(s).status();
        }
    }
}

fn clear_and_home() {
    print!("\x1b[2J\x1b[H");
}
fn hide_cursor() {
    print!("\x1b[?25l");
}
fn show_cursor() {
    print!("\x1b[?25h");
}

enum Key {
    Up,
    Down,
    Left,
    Right,
    Plus,
    Minus,
    Quit,
    Other,
}

fn read_key(stdin: &mut io::StdinLock<'_>) -> io::Result<Key> {
    let mut b0 = [0u8; 1];
    stdin.read_exact(&mut b0)?;
    match b0[0] {
        b'q' | b'Q' => Ok(Key::Quit),
        b'+' | b'=' => Ok(Key::Plus),
        b'-' | b'_' => Ok(Key::Minus),
        b'h' => Ok(Key::Left),
        b'j' => Ok(Key::Down),
        b'k' => Ok(Key::Up),
        b'l' => Ok(Key::Right),
        0x1b => {
            let mut seq = [0u8; 2];
            // Read the rest of a typical CSI sequence: ESC [ A/B/C/D
            if stdin.read_exact(&mut seq).is_ok() && seq[0] == b'[' {
                match seq[1] {
                    b'A' => Ok(Key::Up),
                    b'B' => Ok(Key::Down),
                    b'C' => Ok(Key::Right),
                    b'D' => Ok(Key::Left),
                    _ => Ok(Key::Other),
                }
            } else {
                Ok(Key::Other)
            }
        }
        _ => Ok(Key::Other),
    }
}

fn interactive_loop(mut cfg: Config) {
    let _raw = RawMode::new();
    hide_cursor();
    let mut stdout = io::stdout();
    let stdin = io::stdin();
    let mut lock = stdin.lock();
    loop {
        clear_and_home();
        let img = render(cfg);
        print!("{}", img);
        println!(
            "Controls: arrows pan, +/- zoom, q quit | w={} h={} cx={:.5} cy={:.5} scale={:.5} iters={}",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );
        let _ = stdout.flush();

        // Compute pan steps relative to current scale and aspect
        let aspect = cfg.width as f64 / cfg.height as f64;
        let step_x = cfg.scale * 0.1;
        let step_y = (cfg.scale / aspect) * 0.1;
        match read_key(&mut lock) {
            Ok(Key::Quit) => break,
            Ok(Key::Left) => cfg.center_x -= step_x,
            Ok(Key::Right) => cfg.center_x += step_x,
            Ok(Key::Up) => cfg.center_y -= step_y,
            Ok(Key::Down) => cfg.center_y += step_y,
            Ok(Key::Plus) => {
                cfg.scale *= 0.8; // zoom in
            }
            Ok(Key::Minus) => {
                cfg.scale *= 1.25; // zoom out
            }
            _ => {}
        }
        if cfg.scale < 1e-6 {
            cfg.scale = 1e-6;
        }
    }
    show_cursor();
}

fn main() {
    let cfg = parse_args();
    interactive_loop(cfg);
}
