# N-Body Simulation

This project simulates the N-body gravitational problem in C++ with a Python visualization tool.

## Overview

The N-body problem involves predicting the motion of a group of celestial objects interacting with each other gravitationally. This implementation includes:

1. A high-performance C++ simulation engine
2. Visualization tools using Python with Matplotlib
3. Support for both Solar System simulation and random body generation

## Files

- `nbody_simulation.cpp` - Main C++ simulation program
- `visualize_simulation.py` - Python script for visualization

## How to Run the Simulation

### Step 1: Compile the C++ program

```bash
g++ -o nbody_simulation nbody_simulation.cpp -O3
```

### Step 2: Run the simulation

```bash
./nbody_simulation
```

The program will prompt you to choose between:
1. Solar System simulation
2. Random bodies simulation

The simulation results will be saved to `nbody_simulation_results.csv`.

### Step 3: Visualize the results

To visualize the simulation results, you need Python with the following packages:
- matplotlib
- numpy
- pandas

Run the visualization script:

```bash
python visualize_simulation.py
```

To save the animation to a file (requires FFmpeg):

```bash
python visualize_simulation.py nbody_simulation_results.csv animation.mp4
```

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