# N-Body Simulation

This project simulates the N-body gravitational problem in C++ with a Python visualization tool.

## Overview

The N-body problem involves predicting the motion of a group of celestial objects interacting with each other gravitationally. This implementation includes:

1. A high-performance C++ simulation engine
2. Visualization tools using Python with Matplotlib
3. Support for both Solar System simulation and random body generation

## Quick Start

### Automatic Setup (Recommended)

1. Clone this repository:
   ```bash
   git clone https://github.com/Vedant9500/N-Body-problem.git
   cd N-Body-problem
   ```

2. Run the setup script:
   ```bash
   python setup.py
   ```
   This will:
   - Check for required dependencies
   - Install Python packages
   - Compile the C++ code

3. Run the simulation:
   ```bash
   # On Windows
   .\nbody_simulation.exe
   
   # On Linux/macOS
   ./nbody_simulation
   ```

4. Visualize the results:
   ```bash
   python visualize_simulation.py
   ```

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

## Requirements

- **Python**: 3.6 or higher
- **C++ Compiler**: g++ (MinGW on Windows) or MSVC
- **Python Libraries**:
  - matplotlib
  - numpy
  - pandas

## How the Simulation Works

The simulation implements these key components:

1. **Physical Model**: Uses Newton's law of universal gravitation to calculate forces between bodies.
2. **Numerical Integration**: Uses a simple Euler integration method to update positions and velocities.
3. **Data Collection**: Records position and velocity data at regular intervals.

## Performance Considerations

The C++ implementation is optimized for performance:
- Uses efficient data structures
- Employs distance smoothing to prevent numerical instability
- Includes progress reporting for long simulations

## Visualization Features

The Python visualization tool offers:
- 3D animation of body movements
- Trailing paths showing orbital trajectories
- Body size scaled by mass
- Color-coded bodies for easy identification

## Future Improvements

Potential improvements for this simulation:
- Implement more accurate integration methods (Verlet, Runge-Kutta)
- Add collision detection and handling
- Implement Barnes-Hut algorithm for O(n log n) performance
- Add more realistic physics (relativistic effects, non-gravitational forces)
- Support for interactive parameter adjustment

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