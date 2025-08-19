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
// BEGIN REPLACE shade()
fn shade(it: usize, max_iter: usize, palette: &[char]) -> char {
    if it >= max_iter {
        return *palette.last().unwrap_or(&'@');
    }
    let t = it as f64 / max_iter as f64;
    let idx = (t * (palette.len() as f64 - 1.0)).round() as usize;
    palette[idx]
}
// END REPLACE shade()
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
// BEGIN REPLACE render()
fn render(cfg: Config, palette: &[char]) -> String {
    let mut out = String::with_capacity((cfg.width + 1) * cfg.height);
    let (w, h) = (cfg.width as f64, cfg.height as f64);
    let aspect = w / h;
    for y in 0..cfg.height {
        let v = (y as f64 / (h - 1.0) - 0.5) * cfg.scale / aspect + cfg.center_y;
        for x in 0..cfg.width {
            let u = (x as f64 / (w - 1.0) - 0.5) * cfg.scale + cfg.center_x;
            let it = mandel_escape(0.0, 0.0, u, v, cfg.iters);
            out.push(shade(it, cfg.iters, palette));
        }
        out.push('\n');
    }
    out
}
// END REPLACE render()
fn print_help() {
    eprintln!("ASCII Mandelbrot (single file)");
    eprintln!("Usage: mandelbrot [w=80] [h=30] [cx=-0.5] [cy=0.0] [scale=3.0] [iters=80] [palette=symbols|numbers|emoji]");
}
// BEGIN REPLACE parse_args()
fn parse_args() -> (Config, Vec<char>) {
    let mut cfg = Config::default();
    let mut palette_name = String::from("symbols"); // default palette
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
            "palette" | "p" => palette_name = v.to_string(),
            _ => {}
        }
    }
    let palette = palette_from_name(&palette_name);
    (cfg, palette)
}
// END REPLACE parse_args()
// BEGIN INSERT palette_from_name()
fn palette_from_name(name: &str) -> Vec<char> {
    match name {
        "numbers" => "0123456789".chars().collect(),
        "emoji" => " ⬜🟦🟪🟥🟩🟧🟨⬛".chars().collect(),
        "symbols" => " .:-=+*#%@".chars().collect(),
        _ => " .:-=+*#%@".chars().collect(), // default
    }
}
// END INSERT palette_from_name()
// BEGIN REPLACE main()
fn main() {
    let (cfg, palette) = parse_args();
    let img = render(cfg, &palette);
    println!("{}", img);
    eprintln!(
        "w={} h={} cx={:.5} cy={:.5} scale={} iters={} palette={}",
        cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters,
        "(custom)"
    );
}
// END REPLACE main()
