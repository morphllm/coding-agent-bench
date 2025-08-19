// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::thread;
use std::sync::mpsc;
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
    let workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(cfg.height.max(1));

    let (tx, rx) = mpsc::channel::<(usize, String)>();
    let mut handles = Vec::with_capacity(workers);

    for t in 0..workers {
        let tx = tx.clone();
        let cfg2 = cfg;
        let handle = thread::spawn(move || {
            let (w, h) = (cfg2.width as f64, cfg2.height as f64);
            let aspect = w / h;
            for y in (t..cfg2.height).step_by(workers) {
                let v = (y as f64 / (h - 1.0) - 0.5) * cfg2.scale / aspect + cfg2.center_y;
                let mut line = String::with_capacity(cfg2.width);
                for x in 0..cfg2.width {
                    let u = (x as f64 / (w - 1.0) - 0.5) * cfg2.scale + cfg2.center_x;
                    let it = mandel_escape(0.0, 0.0, u, v, cfg2.iters);
                    line.push(shade(it, cfg2.iters));
                }
                let _ = tx.send((y, line));
            }
        });
        handles.push(handle);
    }
    drop(tx);

    let mut lines = vec![String::new(); cfg.height];
    for (y, line) in rx {
        lines[y] = line;
    }
    for h in handles {
        let _ = h.join();
    }

    let mut out = String::with_capacity((cfg.width + 1) * cfg.height);
    for y in 0..cfg.height {
        out.push_str(&lines[y]);
        out.push('\n');
    }
    out
}
fn main() {
    let cfg = parse_args();
    let img = render(cfg);
    println!("{}", img);
    eprintln!(
        "w={} h={} cx={:.5} cy={:.5} scale={} iters={}",
        cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
    );
}
