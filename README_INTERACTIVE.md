# Interactive N-Body Simulation

A simple, interactive 2D gravitational simulation where you can click to place bodies, set their properties, and watch them interact in real-time!

## 🎮 What You Can Do

- **Click to Place Bodies**: Left-click anywhere to add a new gravitational body
- **Customize Properties**: Adjust mass, velocity, and trail length using sliders
- **Real-time Simulation**: Watch bodies interact with realistic gravitational physics
- **Interactive Controls**: Zoom, pan, and control the simulation flow
- **Save/Load**: Save your configurations and load them later

## 🚀 Quick Start

1. **Install pygame**:
   ```bash
   pip install pygame
   ```
   Or run the automatic setup:
   ```bash
   python simple_setup.py
   ```

2. **Run the interactive simulation**:
   ```bash
   python interactive_2d_simulation.py
   ```

3. **Start creating**:
   - Left-click to place bodies
   - Use the control panel to adjust properties
   - Press Space to start the simulation
   - Watch the gravitational dance!

## 🎯 Controls

### Mouse Controls
- **Left Click**: Place a new body at cursor position
- **Right Click**: Select an existing body to modify its properties
- **Mouse Wheel**: Zoom in/out

### Keyboard Controls
- **Space**: Start/Pause the simulation
- **R**: Reset all velocities and clear trails
- **C**: Clear all bodies
- **T**: Toggle trail visibility
- **ESC**: Quit

### Control Panel
- **Mass Slider**: Adjust the mass of new bodies (or selected body)
- **Velocity Sliders**: Set initial velocity for new bodies
- **Trail Length**: Control how long the orbital trails are
- **Time Scale**: Speed up or slow down the simulation
- **Buttons**: Start/Pause, Reset, Clear, Save/Load configurations

## 🔬 Physics Features

- **Realistic Gravity**: Uses Newton's law of universal gravitation
- **Real-time Integration**: Smooth physics calculations at 60 FPS
- **Collision Avoidance**: Prevents numerical instabilities
- **Trail Visualization**: See the orbital paths of bodies
- **Velocity Vectors**: Visualize velocity when bodies are selected

## 💾 Save & Load

- Click **Save Config** to save your current setup
- Click **Load Config** to restore a saved configuration
- Configurations are saved as `simulation_config_2d.json`

## 🎨 Tips for Cool Simulations

### Create a Binary Star System
1. Place one large body (high mass) in the center
2. Place a smaller body nearby
3. Give the smaller body perpendicular velocity
4. Watch them orbit each other!

### Build a Solar System
1. Place a massive central "sun"
2. Add smaller "planets" at different distances
3. Give each planet appropriate orbital velocity
4. Adjust time scale to see long-term evolution

### Experiment with Chaos
1. Place three bodies of similar mass in a triangle
2. Give them small, random velocities
3. Watch the unpredictable three-body dance!

## 🛠️ Technical Details

- **Language**: Pure Python with pygame
- **Physics**: Gravitational n-body simulation
- **Rendering**: 60 FPS real-time graphics
- **Precision**: Handles close encounters gracefully
- **Performance**: Optimized for interactive use (recommended <50 bodies)

## 🚧 3D Version Coming Soon!

We're working on an amazing 3D interactive version with:
- Full 3D body placement and visualization
- Beautiful OpenGL graphics
- VR support
- Advanced physics options

Stay tuned!

## 📋 Requirements

- Python 3.6 or higher
- pygame 2.0.0 or higher

## 🐛 Troubleshooting

**pygame not installing?**
- Try: `pip install --user pygame`
- On Linux: `sudo apt-get install python3-pygame`
- On Mac: `brew install pygame`

**Simulation running slowly?**
- Reduce the number of bodies
- Increase time scale for faster motion
- Close other applications

**Bodies flying away?**
- Use smaller initial velocities
- Increase masses for stronger gravity
- Reset and try different configurations

## 🎓 Educational Use

This simulation is perfect for:
- Learning about gravity and orbital mechanics
- Exploring chaotic systems and three-body problems
- Understanding conservation of energy and momentum
- Visualizing celestial mechanics concepts
- Having fun with physics!

## 📞 Support

Having issues? Want to suggest features?
- Check the troubleshooting section above
- Look at the example configurations in the code
- Experiment with different settings

Enjoy exploring the universe of gravitational interactions! 🌟
