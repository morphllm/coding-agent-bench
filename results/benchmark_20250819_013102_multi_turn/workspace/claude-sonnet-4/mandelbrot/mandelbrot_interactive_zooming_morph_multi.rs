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
fn enable_raw_mode() -> Result<(), std::io::Error> {
    use std::process::Command;
    Command::new("stty")
        .args(&["-echo", "cbreak"])
        .status()?;
    Ok(())
}

fn disable_raw_mode() -> Result<(), std::io::Error> {
    use std::process::Command;
    Command::new("stty")
        .args(&["echo", "-cbreak"])
        .status()?;
    Ok(())
}

fn clear_screen() {
    print!("\x1b[2J\x1b[H");
    io::stdout().flush().unwrap();
}

fn read_key() -> Result<u8, std::io::Error> {
    let mut buffer = [0; 1];
    io::stdin().read_exact(&mut buffer)?;
    Ok(buffer[0])
}

fn main() {
    let mut cfg = parse_args();
    
    // Enable raw mode for interactive input
    if enable_raw_mode().is_err() {
        eprintln!("Warning: Could not enable raw mode, falling back to static render");
        let img = render(cfg);
        println!("{}", img);
        eprintln!(
            "w={} h={} cx={:.5} cy={:.5} scale={} iters={}",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );
        return;
    }

    // Main interactive loop
    loop {
        clear_screen();
        let img = render(cfg);
        print!("{}", img);
        eprintln!(
            "w={} h={} cx={:.5} cy={:.5} scale={} iters={} | Arrow keys: pan, +/-: zoom, q: quit",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );

        match read_key() {
            Ok(b'q') | Ok(b'Q') => break,
            Ok(b'+') | Ok(b'=') => cfg.scale *= 0.8,
            Ok(b'-') | Ok(b'_') => cfg.scale *= 1.25,
            Ok(27) => { // ESC sequence for arrow keys
                if let (Ok(91), Ok(key)) = (read_key(), read_key()) {
                    let pan_step = cfg.scale * 0.1;
                    match key {
                        65 => cfg.center_y -= pan_step, // Up arrow
                        66 => cfg.center_y += pan_step, // Down arrow
                        67 => cfg.center_x += pan_step, // Right arrow
                        68 => cfg.center_x -= pan_step, // Left arrow
                        _ => {}
                    }
                }
            },
            Ok(b'w') | Ok(b'W') => cfg.center_y -= cfg.scale * 0.1,
            Ok(b's') | Ok(b'S') => cfg.center_y += cfg.scale * 0.1,
            Ok(b'a') | Ok(b'A') => cfg.center_x -= cfg.scale * 0.1,
            Ok(b'd') | Ok(b'D') => cfg.center_x += cfg.scale * 0.1,
            _ => {}
        }
    }

    // Restore terminal mode
    let _ = disable_raw_mode();
    clear_screen();
}