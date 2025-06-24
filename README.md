# Interactive N-Body Simulation

A simple, interactive 2D gravitational simulation where you can click to place bodies, set their properties, and watch them interact in real-time!

## 🎮 What You Can Do

- **Click to Place Bodies**: Left-click anywhere to add a new gravitational body
- **Customize Properties**: Adjust mass, velocity, and trail length using sliders
- **Real-time Simulation**: Watch bodies interact with realistic gravitational physics
- **Interactive Controls**: Zoom, pan, and control the simulation flow
- **Save/Load**: Save your configurations and load them later

## Overview

This is a user-friendly N-body gravitational simulation perfect for:
- Learning about gravity and orbital mechanics
- Exploring chaotic systems and three-body problems
- Understanding conservation of energy and momentum
- Visualizing celestial mechanics concepts
- Having fun with physics!

## Quick Start

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

### Manual Setup

If the automatic setup doesn't work, follow these steps:

#### Step 1: Install Python dependencies

```bash
pip install -r requirements.txt
```

#### Step 2: Compile the C++ program

```bash
g++ -o nbody_simulation nbody_simulation.cpp -O3
```

#### Step 3: Run the simulation

```bash
# On Windows
.\nbody_simulation.exe

# On Linux/macOS
./nbody_simulation
```

The program will prompt you to choose between:
1. Solar System simulation
2. Random bodies simulation

The simulation results will be saved to `nbody_simulation_results.csv`.

#### Step 4: Visualize the results

Run the visualization script:

```bash
python visualize_simulation.py
```

To save the animation to a file (requires FFmpeg):

```bash
python visualize_simulation.py nbody_simulation_results.csv animation.mp4
```

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

## Requirements

- Python 3.6 or higher
- pygame 2.0.0 or higher

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

## 🚧 3D Version Coming Soon!

We're working on an amazing 3D interactive version with:
- Full 3D body placement and visualization
- Beautiful OpenGL graphics
- VR support
- Advanced physics options

Stay tuned!

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

Enjoy exploring the universe of gravitational interactions! 🌟

## Troubleshooting

### Common Issues

1. **Missing Python Dependencies**
   - Error: `ModuleNotFoundError: No module named 'matplotlib'`
   - Solution: Run `pip install -r requirements.txt`

2. **C++ Compilation Errors**
   - Error: `g++: command not found`
   - Solution: Install g++ (MinGW on Windows) or run the setup with MSVC

3. **Animation Not Displaying**
   - Issue: Animation window doesn't appear
   - Solution: Check for any Python error messages and ensure matplotlib is installed correctly

### Getting Help

If you encounter issues not covered here, please open an issue on the GitHub repository.