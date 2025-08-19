// ASCII Mandelbrot in Rust
// Single-file, no deps.
// Usage: rustc mandelbrot.rs && ./mandelbrot w=120 h=40
// Args: w,h,cx,cy,scale,iters
// Designed ~100 lines for editing tasks.
// Palette from light to dark.
// Enjoy!
//
use std::env;
use std::io::{self, Read, Write, stdin, stdout};
use std::os::unix::io::AsRawFd;

// Terminal control for raw mode
extern "C" {
    fn tcgetattr(fd: i32, termios: *mut Termios) -> i32;
    fn tcsetattr(fd: i32, optional_actions: i32, termios: *const Termios) -> i32;
}

#[repr(C)]
struct Termios {
    c_iflag: u32,
    c_oflag: u32,
    c_cflag: u32,
    c_lflag: u32,
    c_cc: [u8; 20],
    c_ispeed: u32,
    c_ospeed: u32,
}

const ICANON: u32 = 0o0000002;
const ECHO: u32 = 0o0000010;
const TCSANOW: i32 = 0;
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
fn set_raw_mode() -> io::Result<Termios> {
    let mut old_termios = Termios {
        c_iflag: 0, c_oflag: 0, c_cflag: 0, c_lflag: 0,
        c_cc: [0; 20], c_ispeed: 0, c_ospeed: 0,
    };
    
    unsafe {
        if tcgetattr(stdin().as_raw_fd(), &mut old_termios) != 0 {
            return Err(io::Error::last_os_error());
        }
        
        let mut new_termios = old_termios;
        new_termios.c_lflag &= !(ICANON | ECHO);
        
        if tcsetattr(stdin().as_raw_fd(), TCSANOW, &new_termios) != 0 {
            return Err(io::Error::last_os_error());
        }
    }
    
    Ok(old_termios)
}

fn restore_terminal(old_termios: &Termios) {
    unsafe {
        tcsetattr(stdin().as_raw_fd(), TCSANOW, old_termios);
    }
}

fn read_key() -> io::Result<u8> {
    let mut buffer = [0; 1];
    stdin().read_exact(&mut buffer)?;
    Ok(buffer[0])
}

fn main() {
    let mut cfg = parse_args();
    
    // Check if running interactively
    let interactive = env::args().any(|arg| arg == "--interactive" || arg == "-i");
    
    if !interactive {
        let img = render(cfg);
        println!("{}", img);
        eprintln!(
            "w={} h={} cx={:.5} cy={:.5} scale={} iters={}",
            cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters
        );
        eprintln!("Tip: Use --interactive or -i for arrow key controls!");
        return;
    }
    
    let old_termios = match set_raw_mode() {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Failed to set raw mode: {}", e);
            return;
        }
    };
    
    let zoom_factor = 0.9;
    
    print!("\x1b[2J\x1b[H"); // Clear screen and move cursor to top
    stdout().flush().unwrap();
    
    loop {
        let pan_step = cfg.scale * 0.1;
        
        let img = render(cfg);
        print!("\x1b[H{}", img); // Move cursor to top and print
        print!("Controls: Arrow keys=pan, +/-=zoom, q=quit | ");
        print!("cx={:.5} cy={:.5} scale={:.5}        \n", cfg.center_x, cfg.center_y, cfg.scale);
        stdout().flush().unwrap();
        
        match read_key() {
            Ok(key) => match key {
                b'q' => break, // 'q' to quit
                b'+' | b'=' => {
                    cfg.scale *= zoom_factor;
                }
                b'-' => {
                    cfg.scale /= zoom_factor;
                }
                27 => { // ESC sequence (arrow keys) or ESC to quit
                    match read_key().unwrap_or(0) {
                        b'[' => {
                            match read_key().unwrap_or(0) {
                                b'A' => cfg.center_y -= pan_step, // Up
                                b'B' => cfg.center_y += pan_step, // Down  
                                b'C' => cfg.center_x += pan_step, // Right
                                b'D' => cfg.center_x -= pan_step, // Left
                                _ => {}
                            }
                        }
                        _ => break, // ESC alone quits
                    }
                }
                _ => {}
            },
            Err(_) => break,
        }
    }
    
    restore_terminal(&old_termios);
    print!("\x1b[2J\x1b[H"); // Clear screen
    println!("Final: w={} h={} cx={:.5} cy={:.5} scale={:.5} iters={}",
        cfg.width, cfg.height, cfg.center_x, cfg.center_y, cfg.scale, cfg.iters);
}
