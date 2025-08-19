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
const PALETTE_NUMS: &[u8] = b" 123456789"; // numeric palette
const PALETTE_EMOJI: &[&str] = &["⬜", "🟦", "🟪", "🟩", "🟨", "🟧", "🔴", "🟥", "🟫", "⬛"]; // emoji palette
const PALETTE_SYMBOLS: &[u8] = b" ░▒▓█▀▄▐▌●"; // block symbols

enum PaletteType {
    Default,
    Numbers,
    Emoji,
    Symbols,
}

#[derive(Clone, Copy)]
struct Config {
    width: usize,
    height: usize,
    center_x: f64,
    center_y: f64,
    scale: f64,
    iters: usize,
    palette: PaletteType,
}

impl Clone for PaletteType {
    fn clone(&self) -> Self {
        match self {
            PaletteType::Default => PaletteType::Default,
            PaletteType::Numbers => PaletteType::Numbers,
            PaletteType::Emoji => PaletteType::Emoji,
            PaletteType::Symbols => PaletteType::Symbols,
        }
    }
}

impl Copy for PaletteType {}

impl Config {
    fn default() -> Self {
        Self {
            width: 80,
            height: 30,
            center_x: -0.5,
            center_y: 0.0,
            scale: 3.0,
            iters: 80,
            palette: PaletteType::Default,
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
            "p" | "palette" => {
                cfg.palette = match v {
                    "numbers" | "nums" => PaletteType::Numbers,
                    "emoji" => PaletteType::Emoji,
                    "symbols" | "blocks" => PaletteType::Symbols,
                    _ => PaletteType::Default,
                }
            }
            _ => {}
        }
    }
    cfg
}
fn print_help() {
    eprintln!("ASCII Mandelbrot (single file)");
    eprintln!("Usage: mandelbrot [w=80] [h=30] [cx=-0.5] [cy=0.0] [scale=3.0] [iters=80] [palette=default]");
    eprintln!("Palettes: default, numbers, emoji, symbols");
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
fn shade(it: usize, max_iter: usize, palette: PaletteType) -> String {
    if it >= max_iter {
        return match palette {
            PaletteType::Emoji => "⬛".to_string(),
            _ => "@".to_string(),
        };
    }
    let t = it as f64 / max_iter as f64;
    match palette {
        PaletteType::Default => {
            let idx = (t * (PALETTE.len() as f64 - 1.0)).round() as usize;
            (PALETTE[idx] as char).to_string()
        }
        PaletteType::Numbers => {
            let idx = (t * (PALETTE_NUMS.len() as f64 - 1.0)).round() as usize;
            (PALETTE_NUMS[idx] as char).to_string()
        }
        PaletteType::Emoji => {
            let idx = (t * (PALETTE_EMOJI.len() as f64 - 1.0)).round() as usize;
            PALETTE_EMOJI[idx].to_string()
        }
        PaletteType::Symbols => {
            let idx = (t * (PALETTE_SYMBOLS.len() as f64 - 1.0)).round() as usize;
            (PALETTE_SYMBOLS[idx] as char).to_string()
        }
    }
}
fn render(cfg: Config) -> String {
    let mut out = String::with_capacity((cfg.width + 1) * cfg.height * 3); // extra space for emoji
    let (w, h) = (cfg.width as f64, cfg.height as f64);
    let aspect = w / h; // adjust vertical scale for terminal cells
    for y in 0..cfg.height {
        let v = (y as f64 / (h - 1.0) - 0.5) * cfg.scale / aspect + cfg.center_y;
        for x in 0..cfg.width {
            let u = (x as f64 / (w - 1.0) - 0.5) * cfg.scale + cfg.center_x;
            let it = mandel_escape(0.0, 0.0, u, v, cfg.iters);
            out.push_str(&shade(it, cfg.iters, cfg.palette));
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
