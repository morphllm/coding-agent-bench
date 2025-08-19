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
    eprintln!("Controls: arrow keys to pan, +/- to zoom, q to quit (on Unix TTY)");
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

fn draw(cfg: &Config) {
    // Clear screen and move cursor to home
    print!("\x1b[2J\x1b[H");
    let img = render(*cfg);
    print!("{}", img);
    println!("Arrows: pan | +/-: zoom | q: quit | r: reset");
    println!(
        "w={} h={} cx={:.6} cy={:.6} scale={:.6} iters={}",
        cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
    );
    let _ = io::stdout().flush();
}

enum Key { Up, Down, Left, Right, Plus, Minus, Quit, Reset, None }

fn read_key_raw() -> Key {
    let mut stdin = io::stdin();
    let mut b = [0u8; 1];
    if stdin.read_exact(&mut b).is_err() { return Key::None; }
    match b[0] {
        b'\x03' => Key::Quit, // Ctrl-C
        b'+' | b'=' => Key::Plus,
        b'-' | b'_' => Key::Minus,
        b'q' | b'Q' => Key::Quit,
        b'r' | b'R' => Key::Reset,
        27 => { // ESC [ A/B/C/D
            let mut seq = [0u8; 2];
            if stdin.read_exact(&mut seq).is_ok() && seq[0] == b'[' {
                match seq[1] {
                    b'A' => Key::Up,
                    b'B' => Key::Down,
                    b'C' => Key::Right,
                    b'D' => Key::Left,
                    _ => Key::None,
                }
            } else { Key::None }
        }
        b'h' => Key::Left, b'j' => Key::Down, b'k' => Key::Up, b'l' => Key::Right, // vim keys
        _ => Key::None,
    }
}

fn read_key_line() -> Key {
    let mut s = String::new();
    if io::stdin().read_line(&mut s).is_err() { return Key::None; }
    match s.chars().next().unwrap_or('\0') {
        'w' | 'W' => Key::Up,
        's' | 'S' => Key::Down,
        'a' | 'A' => Key::Left,
        'd' | 'D' => Key::Right,
        '+' | '=' => Key::Plus,
        '-' | '_' => Key::Minus,
        'q' | 'Q' => Key::Quit,
        'r' | 'R' => Key::Reset,
        _ => Key::None,
    }
}

struct RawModeGuard { enabled: bool }
impl RawModeGuard {
    fn enter() -> Self {
        // Try to enable raw mode on Unix-like systems using `stty`.
        let enabled = Command::new("stty")
            .arg("-echo")
            .arg("raw")
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if enabled {
            let _ = io::stdout().write_all(b"\x1b[?25l"); // hide cursor
            let _ = io::stdout().flush();
        } else {
            eprintln!("(Raw mode unavailable. Fallback: use WASD + Enter, +/- to zoom, q to quit.)");
        }
        Self { enabled }
    }
}
impl Drop for RawModeGuard {
    fn drop(&mut self) {
        if self.enabled {
            let _ = Command::new("stty").arg("sane").status();
            let _ = io::stdout().write_all(b"\x1b[?25h"); // show cursor
            let _ = io::stdout().flush();
        }
    }
}

fn main() {
    let mut cfg = parse_args();

    let guard = RawModeGuard::enter();
    draw(&cfg);

    // Interaction loop
    loop {
        let key = if guard.enabled { read_key_raw() } else { read_key_line() };
        match key {
            Key::Quit => break,
            Key::Reset => { cfg = Config::default(); }
            Key::Plus => { cfg.scale *= 0.8; }
            Key::Minus => { cfg.scale *= 1.25; }
            Key::Left => { cfg.center_x -= 0.1 * cfg.scale; }
            Key::Right => { cfg.center_x += 0.1 * cfg.scale; }
            Key::Up => {
                let aspect = cfg.width as f64 / cfg.height as f64;
                cfg.center_y -= 0.1 * cfg.scale / aspect;
            }
            Key::Down => {
                let aspect = cfg.width as f64 / cfg.height as f64;
                cfg.center_y += 0.1 * cfg.scale / aspect;
            }
            Key::None => continue,
        }
        draw(&cfg);
    }
}
