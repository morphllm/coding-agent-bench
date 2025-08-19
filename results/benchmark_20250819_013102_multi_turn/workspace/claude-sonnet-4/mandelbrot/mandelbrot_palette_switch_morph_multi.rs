// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;

#[derive(Clone, Copy)]
enum PaletteType {
    Symbols,
    Numbers,
    Emoji,
}

const PALETTE_SYMBOLS: &[u8] = b" .:-=+*#%@"; // 10 shades
const PALETTE_NUMBERS: &str = " 0123456789"; // 11 shades
const PALETTE_EMOJI: &str = " 🌑🌒🌓🌔🌕🌖🌗🌘🌚"; // 10 shades

#[derive(Clone, Copy)]
struct Config {
    width: usize,
    height: usize,
    center_x: f64,
    center_y: f64,
    scale: f64,
    iters: usize,
    palette_type: PaletteType,
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
            palette_type: PaletteType::Symbols,
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
            "palette" | "p" => {
                cfg.palette_type = match v {
                    "symbols" | "s" => PaletteType::Symbols,
                    "numbers" | "n" => PaletteType::Numbers,
                    "emoji" | "e" => PaletteType::Emoji,
                    _ => cfg.palette_type,
                };
            }
            _ => {}
        }
    }
    cfg
}
fn print_help() {
    eprintln!("ASCII Mandelbrot (single file)");
    eprintln!("Usage: mandelbrot [w=80] [h=30] [cx=-0.5] [cy=0.0] [scale=3.0] [iters=80] [palette=symbols]");
    eprintln!("Palettes: symbols/s, numbers/n, emoji/e");
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
fn shade(it: usize, max_iter: usize, palette_type: PaletteType) -> char {
    if it >= max_iter {
        return match palette_type {
            PaletteType::Symbols => '@',
            PaletteType::Numbers => '9',
            PaletteType::Emoji => '🌚',
        };
    }
    
    match palette_type {
        PaletteType::Symbols => {
            let t = it as f64 / max_iter as f64;
            let idx = (t * (PALETTE_SYMBOLS.len() as f64 - 1.0)).round() as usize;
            PALETTE_SYMBOLS[idx] as char
        }
        PaletteType::Numbers => {
            let t = it as f64 / max_iter as f64;
            let idx = (t * (PALETTE_NUMBERS.len() as f64 - 1.0)).round() as usize;
            PALETTE_NUMBERS.chars().nth(idx).unwrap_or('9')
        }
        PaletteType::Emoji => {
            let t = it as f64 / max_iter as f64;
            let idx = (t * (PALETTE_EMOJI.chars().count() as f64 - 1.0)).round() as usize;
            PALETTE_EMOJI.chars().nth(idx).unwrap_or('🌚')
        }
    }
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
            out.push(shade(it, cfg.iters, cfg.palette_type));
        }
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
