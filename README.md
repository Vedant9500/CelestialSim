# Interactive N-Body Physics Simulator

A professional, modern web-based N-body gravitational simulation with real-time physics and an intuitive user interface.

## 🌟 Features

- **Professional Web UI**: Modern, responsive design that works in any browser
- **Real-time Physics**: Accurate gravitational simulation with stable integration
- **Interactive Controls**: Place bodies, adjust parameters, and control simulation speed
- **Preset Scenarios**: Solar system, binary stars, chaotic systems, and more
- **Visual Effects**: Particle trails, force vectors, velocity indicators, and energy visualization
- **Export Capabilities**: Save and load simulation configurations

## 🚀 Quick Start

1. **Start the web server**:
   ```bash
   python run_web.py
   ```

2. **Automatic browser launch**: The simulation will open automatically in your default browser

3. **Start simulating**:
   - Click to place bodies or use presets
   - Adjust physics parameters with sliders
   - Press spacebar to start/stop simulation
   - Use mouse wheel to zoom, drag to pan

## 🎮 Controls

- **Left Click**: Place new body
- **Right Click**: Select/deselect body
- **Spacebar**: Play/pause simulation
- **R**: Reset simulation
- **C**: Clear all bodies
- **Mouse Wheel**: Zoom in/out
- **Drag**: Pan camera
- **ESC**: Deselect all

## 🔧 Web Interface

The web UI includes:
- **Control Panel**: Physics parameters, simulation controls
- **Body Properties**: Mass, velocity, color, trail settings
- **Preset Systems**: Ready-to-use configurations
- **Statistics**: Real-time energy monitoring and FPS display
- **Visual Options**: Force vectors, velocity indicators, coordinate system

## 📁 Project Structure

```
N-body problem/
├── web/                    # Web application
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Professional styling
│   └── js/                # JavaScript modules
│       ├── app.js         # Main application
│       ├── physics.js     # Physics engine
│       ├── renderer.js    # Canvas renderer
│       ├── ui.js          # User interface
│       ├── body.js        # Body class
│       ├── vector2d.js    # Vector mathematics
│       └── presets.js     # Simulation presets
├── run_web.py             # Web server launcher
├── start.bat              # Quick launcher (Windows)
└── requirements.txt       # Dependencies (none needed)
```

## 🌐 Requirements

- **Python 3.x** (for web server)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **No external dependencies** (pure web technologies)

## 🎯 Physics Features

- **Verlet Integration**: Stable, energy-conserving numerical integration
- **Softened Gravity**: Prevents singularities at close distances
- **Collision Detection**: Bodies merge when they collide
- **Energy Conservation**: Real-time kinetic and potential energy tracking
- **Time Scaling**: Slow down or speed up simulation without affecting physics accuracy

##  License

Open source - feel free to modify and distribute!