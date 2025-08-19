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
    use std::sync::{Arc, Mutex};
    use std::thread;

    let (w, h) = (cfg.width as f64, cfg.height as f64);
    let aspect = w / h; // adjust vertical scale for terminal cells

    // Determine number of worker threads
    let threads = thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let rows = cfg.height;

    // Shared storage for rows to keep output ordered
    let out_rows = Arc::new(Mutex::new(vec![String::new(); rows]));

    // Divide rows among threads
    let rows_per_chunk = (rows + threads - 1) / threads;
    let mut handles = Vec::new();

    for chunk_idx in 0..threads {
        let start = chunk_idx * rows_per_chunk;
        if start >= rows { break; }
        let end = ((chunk_idx + 1) * rows_per_chunk).min(rows);

        let out_rows_cloned = Arc::clone(&out_rows);
        let cfg_local = cfg; // Config is Copy
        let aspect_local = aspect;
        let w_local = w;

        let handle = thread::spawn(move || {
            for y in start..end {
                let mut row = String::with_capacity(cfg_local.width + 1);
                let v = (y as f64 / (cfg_local.height as f64 - 1.0) - 0.5) * cfg_local.scale / aspect_local + cfg_local.center_y;
                for x in 0..cfg_local.width {
                    let u = (x as f64 / (w_local - 1.0) - 0.5) * cfg_local.scale + cfg_local.center_x;
                    let it = mandel_escape(0.0, 0.0, u, v, cfg_local.iters);
                    row.push(shade(it, cfg_local.iters));
                }
                row.push('\n');
                let mut rows_guard = out_rows_cloned.lock().unwrap();
                rows_guard[y] = row;
            }
        });
        handles.push(handle);
    }

    for hnd in handles { let _ = hnd.join(); }

    // Combine rows into a single String
    let rows_vec = Arc::try_unwrap(out_rows).unwrap().into_inner().unwrap();
    let mut out = String::with_capacity((cfg.width + 1) * cfg.height);
    for row in rows_vec {
        out.push_str(&row);
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
