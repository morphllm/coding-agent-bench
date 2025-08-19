// visualizer.cpp
// Single-file SFML visualizer with generic 3D parametric simulation support
// and a Lorenz attractor demo.
// Controls:
//   Mouse drag: rotate camera
//   Mouse wheel: zoom
//   W/A/S/D or Arrow keys: pan
//   Space: pause/resume
//   R: reset view
//   C: clear trail
//   P: save screenshot (PNG)
//   +/- : change point size
//   [ ] : change trail length (max points)
//   1/2/3: toggle axes/grid/depth sort
//   Esc: quit

#include <SFML/Graphics.hpp>
#include <cmath>
#include <vector>
#include <string>
#include <functional>
#include <random>
#include <sstream>
#include <iomanip>
#include <algorithm>

// ------------------------------- Math Helpers --------------------------------
struct Vec3 {
    float x=0, y=0, z=0;
    Vec3() = default;
    Vec3(float X, float Y, float Z): x(X), y(Y), z(Z) {}
    Vec3 operator+(const Vec3& o) const { return {x+o.x, y+o.y, z+o.z}; }
    Vec3 operator-(const Vec3& o) const { return {x-o.x, y-o.y, z-o.z}; }
    Vec3 operator*(float s) const { return {x*s, y*s, z*s}; }
    Vec3& operator+=(const Vec3& o){ x+=o.x; y+=o.y; z+=o.z; return *this; }
};

static inline float dot(const Vec3&a,const Vec3&b){return a.x*b.x+a.y*b.y+a.z*b.z;}
static inline Vec3 cross(const Vec3&a,const Vec3&b){return {a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}
static inline float length(const Vec3&v){return std::sqrt(dot(v,v));}
static inline Vec3 normalize(const Vec3&v){float L=length(v);return L>0? v*(1.0f/L):v;}

// Simple 3D rotation using yaw (around Y) and pitch (around X)
static inline Vec3 rotateYawPitch(const Vec3& v, float yaw, float pitch){
    float cy = std::cos(yaw), sy = std::sin(yaw);
    float cx = std::cos(pitch), sx = std::sin(pitch);
    // Rotate around Y (yaw)
    Vec3 vy{ cy*v.x + sy*v.z, v.y, -sy*v.x + cy*v.z };
    // Rotate around X (pitch)
    return { vy.x, cx*vy.y - sx*vy.z, sx*vy.y + cx*vy.z };
}

// Project 3D to 2D (simple perspective)
struct Camera {
    float yaw = 0.8f;
    float pitch = 0.35f;
    float zoom = 130.0f;   // pixels per world unit
    sf::Vector2f pan{0.f, 0.f};
    bool depthSort = false;
};

static inline sf::Vector2f project(const Vec3& v, const Camera& cam, const sf::Vector2u& size){
    // Camera rotation
    Vec3 vr = rotateYawPitch(v, cam.yaw, cam.pitch);
    // Perspective scale factor (simple, center at z ~ 5 units forward)
    float zoff = 5.0f; // shift forward to avoid division by zero
    float denom = std::max(0.1f, vr.z + zoff);
    float s = cam.zoom / denom;
    float cx = size.x * 0.5f + cam.pan.x;
    float cy = size.y * 0.5f + cam.pan.y;
    return { cx + vr.x * s, cy - vr.y * s };
}

// --------------------------- Visualizer Framework ----------------------------
//
// The Visualizer simulates and plots a stream of 3D points provided by an
// "update function". The update function advances an internal state by dt and
// returns the new point(s) to render.
//
// API contract for UpdateFn:
//   using UpdateFn = std::function<void(float dt, std::vector<Vec3>& outPoints)>;
// - Each call should push_back one or more Vec3 into outPoints.
//
// You can swap in any dynamical system (e.g., Lorenz, Rossler, Lissajous, etc.)
// by defining an UpdateFn and passing it to runVisualizer(...).

using UpdateFn = std::function<void(float, std::vector<Vec3>&)>;

struct VisualizerConfig {
    unsigned width = 1000;
    unsigned height = 700;
    unsigned maxPoints = 150000;
    float pointSize = 2.0f;
    bool showAxes = true;
    bool showGrid = true;
    sf::Color bg = sf::Color(10, 12, 20);
    sf::Color pointColor = sf::Color(240, 240, 255);
    sf::Color axisColor = sf::Color(120, 120, 140);
    sf::Color gridColor = sf::Color(40, 42, 56);
    std::string windowTitle = "C++ Visualizer";
};

class Visualizer {
public:
    Visualizer(const VisualizerConfig& cfg, UpdateFn update)
    : cfg_(cfg), update_(std::move(update)),
      window_(sf::VideoMode(cfg.width, cfg.height), cfg.windowTitle, sf::Style::Default)
    {
        window_.setVerticalSyncEnabled(true);
        font_.loadFromFile(getDefaultFont());
        text_.setFont(font_);
        text_.setCharacterSize(14);
        text_.setFillColor(sf::Color(210, 210, 230));
        text_.setOutlineColor(sf::Color(0,0,0));
        text_.setOutlineThickness(1.f);

        // For screenshot naming
        clock_.restart();
    }

    void run(){
        sf::Clock dtClock;
        while (window_.isOpen()){
            handleEvents();
            float dt = paused_ ? 0.f : std::min(0.033f, dtClock.restart().asSeconds());
            simulate(dt);
            draw();
        }
    }

    void resetView(){
        cam_ = Camera{};
    }

private:
    VisualizerConfig cfg_;
    UpdateFn update_;
    sf::RenderWindow window_;
    Camera cam_;
    std::vector<Vec3> points_;
    bool paused_ = false;
    bool dragging_ = false;
    sf::Vector2i lastMouse_;
    sf::Clock clock_;
    sf::Font font_;
    sf::Text text_;

    void handleEvents(){
        sf::Event ev;
        while (window_.pollEvent(ev)){
            switch (ev.type){
                case sf::Event::Closed:
                    window_.close();
                    break;
                case sf::Event::Resized:
                    // Adjust viewport
                    window_.setView(sf::View(sf::FloatRect(0,0, ev.size.width, ev.size.height)));
                    break;
                case sf::Event::MouseButtonPressed:
                    if (ev.mouseButton.button == sf::Mouse::Left){
                        dragging_ = true;
                        lastMouse_ = sf::Mouse::getPosition(window_);
                    }
                    break;
                case sf::Event::MouseButtonReleased:
                    if (ev.mouseButton.button == sf::Mouse::Left){
                        dragging_ = false;
                    }
                    break;
                case sf::Event::MouseMoved:
                    if (dragging_){
                        auto pos = sf::Mouse::getPosition(window_);
                        sf::Vector2i delta = pos - lastMouse_;
                        lastMouse_ = pos;
                        cam_.yaw   += delta.x * 0.005f;
                        cam_.pitch += delta.y * 0.005f;
                        cam_.pitch = std::max(-1.5f, std::min(1.5f, cam_.pitch));
                    }
                    break;
                case sf::Event::MouseWheelScrolled:
                    if (ev.mouseWheelScroll.wheel == sf::Mouse::VerticalWheel){
                        cam_.zoom *= (ev.mouseWheelScroll.delta > 0 ? 1.1f : 0.9f);
                        cam_.zoom = std::max(5.f, std::min(3000.f, cam_.zoom));
                    }
                    break;
                case sf::Event::KeyPressed:
                    handleKey(ev.key.code);
                    break;
                default: break;
            }
        }
        // Continuous pan
        float panStep = 5.0f;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::Left) || sf::Keyboard::isKeyPressed(sf::Keyboard::A))
            cam_.pan.x += panStep;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::Right) || sf::Keyboard::isKeyPressed(sf::Keyboard::D))
            cam_.pan.x -= panStep;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::Up) || sf::Keyboard::isKeyPressed(sf::Keyboard::W))
            cam_.pan.y += panStep;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::Down) || sf::Keyboard::isKeyPressed(sf::Keyboard::S))
            cam_.pan.y -= panStep;
    }

    void handleKey(sf::Keyboard::Key key){
        switch (key){
            case sf::Keyboard::Space: paused_ = !paused_; break;
            case sf::Keyboard::Escape: window_.close(); break;
            case sf::Keyboard::R: resetView(); break;
            case sf::Keyboard::C: points_.clear(); break;
            case sf::Keyboard::P: saveScreenshot(); break;
            case sf::Keyboard::Add:
            case sf::Keyboard::Equal: cfg_.pointSize = std::min(8.f, cfg_.pointSize + 0.5f); break;
            case sf::Keyboard::Hyphen:
            case sf::Keyboard::Subtract: cfg_.pointSize = std::max(1.f, cfg_.pointSize - 0.5f); break;
            case sf::Keyboard::LBracket: cfg_.maxPoints = std::max(1000u, cfg_.maxPoints - 5000u); break;
            case sf::Keyboard::RBracket: cfg_.maxPoints = std::min(1000000u, cfg_.maxPoints + 5000u); break;
            case sf::Keyboard::Num1: cfg_.showAxes = !cfg_.showAxes; break;
            case sf::Keyboard::Num2: cfg_.showGrid = !cfg_.showGrid; break;
            case sf::Keyboard::Num3: cam_.depthSort = !cam_.depthSort; break;
            default: break;
        }
    }

    void saveScreenshot(){
        sf::Texture tex;
        tex.create(window_.getSize().x, window_.getSize().y);
        tex.update(window_);
        sf::Image img = tex.copyToImage();
        std::ostringstream ss;
        ss << "screenshot_" << std::setw(6) << std::setfill('0') << int(clock_.getElapsedTime().asMilliseconds()) << ".png";
        img.saveToFile(ss.str());
    }

    void simulate(float dt){
        if (!update_) return;
        std::vector<Vec3> newPts;
        update_(dt, newPts);
        if (!newPts.empty()){
            // Append, trim if needed
            if (points_.size() + newPts.size() > cfg_.maxPoints){
                size_t excess = points_.size() + newPts.size() - cfg_.maxPoints;
                if (excess < points_.size())
                    points_.erase(points_.begin(), points_.begin() + excess);
                else
                    points_.clear();
            }
            points_.insert(points_.end(), newPts.begin(), newPts.end());
        }
    }

    void drawAxes(sf::RenderTarget& target){
        // Axes lines
        const float L = 2.0f;
        const Vec3 X0{-L,0,0}, X1{L,0,0};
        const Vec3 Y0{0,-L,0}, Y1{0,L,0};
        const Vec3 Z0{0,0,-L}, Z1{0,0,L};
        drawLine3D(X0, X1, cfg_.axisColor, target);
        drawLine3D(Y0, Y1, cfg_.axisColor, target);
        drawLine3D(Z0, Z1, cfg_.axisColor, target);
        // Ticks
        for (int i=-2;i<=2;++i){
            if (i==0) continue;
            drawLine3D({(float)i, -0.05f, 0},{(float)i, 0.05f, 0}, cfg_.axisColor, target);
            drawLine3D({-0.05f,(float)i, 0},{0.05f,(float)i, 0}, cfg_.axisColor, target);
            drawLine3D({0, -0.05f,(float)i},{0, 0.05f,(float)i}, cfg_.axisColor, target);
        }
    }

    void drawGrid(sf::RenderTarget& target){
        // Faint grid on XZ plane (y=0)
        const int N = 12;
        const float s = 1.0f;
        for (int i=-N;i<=N;++i){
            drawLine3D({(float)-N*s,0,(float)i*s},{(float)N*s,0,(float)i*s}, cfg_.gridColor, target);
            drawLine3D({(float)i*s,0,(float)-N*s},{(float)i*s,0,(float)N*s}, cfg_.gridColor, target);
        }
    }

    void drawLine3D(const Vec3&a,const Vec3&b,const sf::Color& col,sf::RenderTarget& target){
        sf::Vertex v[2];
        v[0].position = project(a, cam_, target.getSize());
        v[1].position = project(b, cam_, target.getSize());
        v[0].color = v[1].color = col;
        target.draw(v, 2, sf::Lines);
    }

    void drawPointsDepthSorted(sf::RenderTarget& target){
        // Compute depth and sort indices (expensive; toggleable)
        struct Item { float depth; sf::Vector2f p; };
        std::vector<Item> items;
        items.reserve(points_.size());
        items.clear();
        for (const auto& v : points_){
            Vec3 vr = rotateYawPitch(v, cam_.yaw, cam_.pitch);
            float denom = std::max(0.1f, vr.z + 5.0f);
            float s = cam_.zoom / denom;
            float cx = target.getSize().x * 0.5f + cam_.pan.x;
            float cy = target.getSize().y * 0.5f + cam_.pan.y;
            sf::Vector2f p{ cx + vr.x * s, cy - vr.y * s };
            items.push_back({denom, p}); // denom ~ depth proxy
        }
        std::sort(items.begin(), items.end(), [](const Item& a, const Item& b){ return a.depth > b.depth; });
        sf::CircleShape c(cfg_.pointSize);
        c.setOrigin(cfg_.pointSize, cfg_.pointSize);
        c.setFillColor(cfg_.pointColor);
        for (const auto& it : items){
            c.setPosition(it.p);
            target.draw(c);
        }
    }

    void drawPointsFast(sf::RenderTarget& target){
        sf::CircleShape c(cfg_.pointSize);
        c.setOrigin(cfg_.pointSize, cfg_.pointSize);
        c.setFillColor(cfg_.pointColor);
        for (const auto& v : points_){
            auto p = project(v, cam_, target.getSize());
            c.setPosition(p);
            target.draw(c);
        }
    }

    void drawHUD(sf::RenderTarget& target){
        std::ostringstream ss;
        ss << "Points: " << points_.size()
           << " / " << cfg_.maxPoints
           << " | Zoom: " << std::fixed << std::setprecision(1) << cam_.zoom
           << " | PointSize: " << cfg_.pointSize
           << " | [Space] " << (paused_ ? "Resume" : "Pause")
           << " | [P] Screenshot  [C] Clear  [R] Reset  [1/2/3] Axes/Grid/DepthSort";
        text_.setString(ss.str());
        text_.setPosition(10.f, 10.f);
        target.draw(text_);
    }

    void draw(){
        window_.clear(cfg_.bg);

        // Draw gradient background
        sf::VertexArray gradient(sf::Quads, 4);
        sf::Vector2u winSize = window_.getSize();
        
        // Left side: blue
        sf::Color leftColor(30, 50, 120);  // Blue color
        // Right side: green
        sf::Color rightColor(30, 120, 50);  // Green color
        
        // Top-left (blue)
        gradient[0].position = sf::Vector2f(0, 0);
        gradient[0].color = leftColor;
        
        // Top-right (green)
        gradient[1].position = sf::Vector2f(winSize.x, 0);
        gradient[1].color = rightColor;
        
        // Bottom-right (green)
        gradient[2].position = sf::Vector2f(winSize.x, winSize.y);
        gradient[2].color = rightColor;
        
        // Bottom-left (blue)
        gradient[3].position = sf::Vector2f(0, winSize.y);
        gradient[3].color = leftColor;
        
        window_.draw(gradient);

        if (cfg_.showGrid) drawGrid(window_);
        if (cfg_.showAxes) drawAxes(window_);

        if (cam_.depthSort) drawPointsDepthSorted(window_);
        else                drawPointsFast(window_);

        drawHUD(window_);
        window_.display();
    }
};

// ------------------------------ Lorenz System --------------------------------
//
// Lorenz equations:
//   dx/dt = sigma (y - x)
//   dy/dt = x (rho - z) - y
//   dz/dt = x y - beta z
//
// We'll use RK4 for better stability at moderate time steps.

struct LorenzState {
    float x, y, z;
};

struct LorenzParams {
    float sigma = 10.0f;
    float rho   = 28.0f;
    float beta  = 8.0f/3.0f;
};

static inline Vec3 lorenzDeriv(const LorenzState& s, const LorenzParams& p){
    float dx = p.sigma * (s.y - s.x);
    float dy = s.x * (p.rho - s.z) - s.y;
    float dz = s.x * s.y - p.beta * s.z;
    return {dx, dy, dz};
}

static inline void rk4Step(LorenzState& s, const LorenzParams& p, float h){
    Vec3 k1 = lorenzDeriv(s, p);
    LorenzState s2{ s.x + 0.5f*h*k1.x, s.y + 0.5f*h*k1.y, s.z + 0.5f*h*k1.z };
    Vec3 k2 = lorenzDeriv(s2, p);
    LorenzState s3{ s.x + 0.5f*h*k2.x, s.y + 0.5f*h*k2.y, s.z + 0.5f*h*k2.z };
    Vec3 k3 = lorenzDeriv(s3, p);
    LorenzState s4{ s.x + h*k3.x, s.y + h*k3.y, s.z + h*k3.z };
    Vec3 k4 = lorenzDeriv(s4, p);
    s.x += (h/6.f) * (k1.x + 2*k2.x + 2*k3.x + k4.x);
    s.y += (h/6.f) * (k1.y + 2*k2.y + 2*k3.y + k4.y);
    s.z += (h/6.f) * (k1.z + 2*k2.z + 2*k3.z + k4.z);
}

// --------------------------- Example Updater: Lorenz --------------------------
UpdateFn makeLorenzUpdater(){
    LorenzParams P;
    LorenzState S{ 0.01f, 0.0f, 0.0f };    // near origin
    float dtFixed = 0.01f;
    // Scale/center for nicer viewing (roughly normalize extents)
    const float scale = 0.03f;

    return [P, S, dtFixed, scale] (float dt, std::vector<Vec3>& out) mutable {
        // Integrate multiple substeps for smoothness regardless of frame dt
        int steps = std::max(1, (int)std::round(dt / dtFixed));
        float h = dtFixed;
        for (int i=0;i<steps;++i){
            rk4Step(S, P, h);
            // Add scaled point
            out.emplace_back(S.x * scale, (S.z-25.f) * scale, (S.y-25.f) * scale);
        }
        // If paused (dt=0), still emit a tiny update so there is something to draw initially
        if (dt == 0.f && out.empty()){
            out.emplace_back(S.x * scale, (S.z-25.f) * scale, (S.y-25.f) * scale);
        }
    };
}

// ------------------------ Generic Visualizer Entrypoint ----------------------
//
// This function runs the visualizer with the provided update function.
// You can plug in any other system by writing your own UpdateFn.

void runVisualizer(const std::string& title, UpdateFn updater){
    VisualizerConfig cfg;
    cfg.windowTitle = title;
    cfg.pointColor  = sf::Color(255, 240, 200);
    cfg.pointSize   = 2.0f;
    cfg.maxPoints   = 200000;
    Visualizer vis(cfg, std::move(updater));
    vis.run();
}

// -------------------- Convenience: Lorenz Visualizer Wrapper -----------------
void runLorenzAttractor(){
    runVisualizer("Lorenz Attractor — C++ SFML Visualizer", makeLorenzUpdater());
}

// ------------------------------------ main -----------------------------------
int main(int argc, char** argv){
    // For now we always run the Lorenz attractor demo.
    // You can add CLI switches later to run different systems.
    runLorenzAttractor();
    return 0;
}
