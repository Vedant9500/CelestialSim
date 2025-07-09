# CelestialSim

A modern, browser-based gravitational physics simulator featuring real-time N-body dynamics with an intuitive user interface. Experience accurate celestial mechanics through interactive simulations of planetary systems, stellar clusters, and complex gravitational interactions with realistic collision physics.

## ✨ Features

### Core Simulation
- **Real-time N-Body Physics**: High-precision gravitational calculations using Verlet integration
- **Solid Body Collisions**: Physics-based elastic and inelastic collisions with mass-dependent radius
- **Interactive Body Placement**: Click-to-place celestial bodies with customizable properties
- **Orbit Mode**: Automatically calculate stable orbital velocities with live preview
- **Drag & Drop**: Move bodies in real-time to explore different configurations
- **Dynamic Scaling**: Bodies scale correctly with zoom and mass for proper visual representation

### Advanced Physics
- **Collision Detection**: Continuous collision detection prevents fast bodies from tunneling
- **Elastic Collisions**: Bodies bounce off each other with realistic momentum transfer *(Work in Progress)*
- **Inelastic Collisions**: Bodies merge together with momentum conservation
- **Spatial Optimization**: Efficient collision detection using spatial partitioning
- **Physics-based Radius**: Body size calculated from mass and density using sphere model

### Advanced Controls
- **Preset Scenarios**: Solar system, binary stars, chaotic three-body systems, and more
- **Real-world Scale Reference**: Dynamic conversion between simulation units and astronomical scales
- **Live Physics Tuning**: Adjust gravity, time scale, collision parameters, and restitution
- **Visual Customization**: Toggle trails, collision bounds, force vectors, coordinate grids
- **Export/Import**: Save and load simulation configurations

### Modern Interface
- **Redesigned UI**: Clean, card-based design with unified visual theme
- **Responsive Panels**: Compact, simulation-focused side panels
- **Performance Monitoring**: Live FPS, energy tracking, and collision statistics
- **Energy Conservation**: Real-time kinetic and potential energy visualization
- **Debug Tools**: Collision boundary visualization and physics diagnostics

## 🚀 Getting Started

### Installation
No installation required! The simulator runs entirely in your web browser.

### Launch
1. Start the local web server:
   ```bash
   python run_web.py
   ```
   
2. The simulator will automatically open in your default browser at `http://localhost:8000`

3. Begin exploring:
   - Use preset scenarios for quick start
   - Click anywhere to place your first celestial body
   - Experiment with different masses and velocities
   - Enable Orbit Mode for realistic planetary systems

## 🎮 Controls Reference

### Mouse Controls
- **Left Click**: Place new body or select existing body
- **Drag**: Move selected bodies to new positions
- **Right Click**: Context selection
- **Mouse Wheel**: Zoom in/out at cursor position
- **Ctrl + Drag**: Pan camera view
- **Middle Mouse**: Alternative camera pan

### Keyboard Shortcuts
- **Space**: Start/pause simulation
- **R**: Reset simulation to initial state
- **C**: Clear all bodies
- **T**: Toggle particle trails
- **G**: Toggle coordinate grid
- **F**: Toggle force vector display
- **I**: Toggle real-world scale reference
- **Delete**: Remove selected body
- **F1** or **?**: Show help documentation and keyboard shortcuts
- **Esc**: Deselect all, close dialogs

## 🔧 Interface Overview

### Control Panel
- **Simulation Controls**: Play, pause, reset, and clear functions
- **Physics Parameters**: Gravity strength and time scale adjustment
- **Body Properties**: Mass, velocity, color, and trail length settings
- **Visual Options**: Rendering and display toggles

### Scale Reference Panel
- **Dynamic Information**: Real-time conversion of selected body properties
- **Astronomical Context**: Compare simulation units to real-world celestial objects
- **Mass Comparisons**: Automatic scaling relative to Earth, Jupiter, Sun, and other bodies
- **Distance & Velocity**: AU (Astronomical Unit) and km/s conversions

### Preset Library
- **Solar System**: Accurate scale model with planets and orbital mechanics
- **Binary Stars**: Stable and unstable binary systems
- **Three-Body Systems**: Chaotic dynamics and figure-8 orbits
- **Planetary Systems**: Various exoplanet configurations
- **Cluster Dynamics**: Star cluster formation and evolution

## 🧮 Physics Engine

### Numerical Methods
- **Verlet Integration**: Symplectic integrator preserving energy and stability
- **Adaptive Time-stepping**: Automatic adjustment for numerical stability
- **Softened Gravity**: Prevents computational singularities at close encounters
- **Elastic Collision Physics**: Impulse-based collision response with friction and restitution *(Work in Progress)*
- **Continuous Collision Detection**: Prevents tunneling for fast-moving objects
- **Spatial Partitioning**: Efficient O(n) collision detection using grid-based optimization

### Real-world Accuracy
- **Astronomical Units**: 1 AU = 149.6 million km (Earth-Sun distance)
- **Mass Scaling**: 1 unit = Earth mass (5.97 × 10²⁴ kg)
- **Time Scaling**: 1 unit = 1 Earth year (365.25 days)
- **Velocity Units**: 1 unit = 29.78 km/s (Earth's orbital speed)

## 🌐 Technical Requirements

### System Requirements
- **Python 3.6+** (for local web server)
- **Modern Web Browser** supporting Canvas API and ES6
  - Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **2GB RAM** minimum (4GB recommended for complex simulations)
- **Hardware acceleration** recommended for smooth rendering

### Browser Compatibility
- Full feature support on all modern browsers
- Automatic device pixel ratio detection for high-DPI displays
- Responsive design adapts to desktop, tablet, and mobile devices
- Works offline once initially loaded

## 🔬 Educational Applications

- **Astronomy Education**: Visualize orbital mechanics and gravitational interactions
- **Physics Demonstrations**: Explore conservation laws and celestial dynamics
- **Research Tool**: Prototype gravitational systems and test hypotheses
- **Interactive Learning**: Hands-on experimentation with fundamental physics

## 📊 Performance

- **Optimized Rendering**: 60 FPS on modern hardware with 100+ bodies
- **Efficient Physics**: O(n²) gravitational calculations with spatial optimization
- **Memory Management**: Automatic cleanup and garbage collection
- **Scalable Architecture**: Smooth performance from simple to complex systems

## 🤝 Contributing

This project welcomes contributions! Areas for enhancement include:
- Additional preset scenarios and educational content
- Advanced rendering effects and visual improvements
- Performance optimizations and GPU acceleration
- Mobile device optimization
- Documentation and tutorial improvements

## 🆕 Recent Updates

### Collision System Overhaul
- **Solid Body Physics**: Bodies are now solid objects with mass-based radius
- **Enhanced Collision Detection**: Continuous collision detection prevents tunneling
- **Realistic Elastic Collisions**: Proper momentum transfer with friction and restitution *(Work in Progress)*
- **Improved Separation Logic**: Prevents bodies from getting stuck together

### UI/UX Modernization
- **Redesigned Interface**: Clean, card-based layout with unified visual theme
- **Compact Panels**: Simulation-focused design with better space utilization
- **Energy Monitoring**: Real-time kinetic and potential energy tracking
- **Enhanced Visual Feedback**: Better collision visualization and debug tools

### Performance Improvements
- **Spatial Optimization**: Efficient collision detection using grid partitioning
- **Reduced Console Spam**: Cleaner debug output with optional verbose logging
- **Better Memory Management**: Improved cleanup and resource handling
