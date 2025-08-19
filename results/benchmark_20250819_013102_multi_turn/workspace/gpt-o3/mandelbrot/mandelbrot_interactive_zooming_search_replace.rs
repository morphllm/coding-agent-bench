// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
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
fn main() {
    use std::io::{Read, Write};
    use std::process::Command;

    // Parse CLI args for starting view
    let mut cfg = parse_args();

    // Put terminal into raw mode (requires `stty` on the system).
    fn enable_raw() {
        let _ = Command::new("stty").args(&["-icanon", "-echo"]).status();
    }
    fn disable_raw() {
        let _ = Command::new("stty").arg("sane").status();
    }
    enable_raw();
    // Make sure we restore terminal state on exit.
    struct RawGuard;
    impl Drop for RawGuard {
        fn drop(&mut self) {
            disable_raw();
            // show cursor again
            print!("\x1b[?25h");
        }
    }
    let _guard = RawGuard;

    // Hide cursor & clear screen once.
    print!("\x1b[?25l\x1b[2J");
    std::io::stdout().flush().unwrap();

    loop {
        // Move cursor to home and draw current view.
        print!("\x1b[H");
        let img = render(cfg);
        print!("{}", img);
        eprintln!(
            "Arrows: pan  +/-: zoom  q: quit | w={} h={} cx={:.5} cy={:.5} scale={:.5} iters={}",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );
        std::io::stdout().flush().unwrap();

        // Read up to 3 bytes (arrow keys send 3-byte escape sequences)
        let mut buf = [0u8; 3];
        if std::io::stdin().read(&mut buf).unwrap_or(0) == 0 {
            break;
        }
        match buf {
            [b'q', ..] => break,
            [b'+', ..] => cfg.scale *= 0.8,
            [b'-', ..] => cfg.scale *= 1.25,
            [0x1b, b'[', b'A'] => cfg.center_y -= cfg.scale * 0.1, // Up
            [0x1b, b'[', b'B'] => cfg.center_y += cfg.scale * 0.1, // Down
            [0x1b, b'[', b'C'] => cfg.center_x += cfg.scale * 0.1, // Right
            [0x1b, b'[', b'D'] => cfg.center_x -= cfg.scale * 0.1, // Left
            _ => {}
        }
    }
}
