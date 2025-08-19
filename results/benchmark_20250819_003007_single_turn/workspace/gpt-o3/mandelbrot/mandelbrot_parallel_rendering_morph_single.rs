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
// -------------------------------------------------------------
// Parallel renderer: splits rows across available CPU cores.
// -------------------------------------------------------------
fn render(cfg: Config) -> String {
    let n_threads = thread::available_concurrency()
        .map(|n| n.get())
        .unwrap_or(4);
    let rows_per_chunk = (cfg.height + n_threads - 1) / n_threads;

    // Pre-allocate space for each row so we can later stitch in order.
    let mut rows: Vec<String> = vec![String::new(); cfg.height];
    let mut handles = Vec::with_capacity(n_threads);

    for chunk_idx in 0..n_threads {
        let start = chunk_idx * rows_per_chunk;
        if start >= cfg.height {
            break;
        }
        let end = (start + rows_per_chunk).min(cfg.height);
        let cfg_cl = cfg; // Config is Copy (cheap).

        handles.push(thread::spawn(move || {
            let (w, h) = (cfg_cl.width as f64, cfg_cl.height as f64);
            let aspect = w / h;
            let mut part: Vec<(usize, String)> = Vec::with_capacity(end - start);

            for y in start..end {
                let v = (y as f64 / (h - 1.0) - 0.5) * cfg_cl.scale / aspect + cfg_cl.center_y;
                let mut row = String::with_capacity(cfg_cl.width + 1);
                for x in 0..cfg_cl.width {
                    let u = (x as f64 / (w - 1.0) - 0.5) * cfg_cl.scale + cfg_cl.center_x;
                    let it = mandel_escape(0.0, 0.0, u, v, cfg_cl.iters);
                    row.push(shade(it, cfg_cl.iters));
                }
                row.push('\n');
                part.push((y, row));
            }

            part
        }));
    }

    for handle in handles {
        for (y, row) in handle.join().unwrap() {
            rows[y] = row;
        }
    }

    rows.into_iter().collect()
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
