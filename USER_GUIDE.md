# N-Body Simulation User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Understanding the Interface](#understanding-the-interface)
3. [Configuration Options](#configuration-options)
4. [Interpreting Results](#interpreting-results)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Features](#advanced-features)

## Getting Started

### First Run
1. **Setup**: Run `python enhanced_setup.py` for automated installation
2. **Launch**: Start the simulation with `./nbody_simulation` (or `.exe` on Windows)
3. **Choose Mode**: Select Solar System (1) or Random Bodies (2)
4. **Visualize**: The enhanced visualization will auto-launch

### Basic Controls

**Simulation Controls:**
- Press `Enter` to stop the simulation gracefully
- The simulation runs in real-time until manually stopped

**Visualization Controls:**
- **Autoscale**: Automatically adjust view to fit all bodies
- **Center**: Center view on the most massive body (usually Sun)
- **Trails**: Show/hide orbital trails behind bodies
- **Pause**: Pause/resume the visualization updates
- **Velocities**: Show velocity vectors (advanced)
- **Reset View**: Return to default 3D viewing angle

## Understanding the Interface

### Main 3D View
- **Bodies**: Colored spheres representing gravitational bodies
- **Trails**: Lines showing recent orbital paths
- **Size**: Body size proportional to mass (logarithmic scale)
- **Colors**: Each body has a unique color for identification

### Information Panel (Right Side)
- **System Information**: Total mass, energy, active bodies
- **Body Details**: Individual body statistics
- **Current Iteration**: Simulation progress counter
- **Energy Error**: Numerical accuracy indicator

### Energy Conservation Plot
- **X-axis**: Simulation iteration number
- **Y-axis**: Energy conservation error percentage
- **Interpretation**: Lower values = better accuracy

### Control Panel (Bottom)
- **Buttons**: Interactive toggles for visualization options
- **Sliders**: Continuous controls for trail length and scaling

## Configuration Options

### simulation_config.json

Edit this file to customize simulation behavior:

```json
{
    "simulation": {
        "use_adaptive_timestep": true,     // Automatic time step adjustment
        "enable_collision_detection": true, // Handle body collisions
        "enable_energy_monitoring": true,   // Track energy conservation
        "default_time_step": 86400.0,      // Base time step (seconds)
        "energy_tolerance": 1e-6           // Acceptable energy error
    }
}
```

**Key Parameters:**

- **use_adaptive_timestep**: Automatically adjusts time step for stability
- **enable_collision_detection**: Merges bodies that collide
- **enable_energy_monitoring**: Tracks simulation accuracy
- **energy_tolerance**: Threshold for energy conservation warnings

### Visualization Settings

```json
{
    "visualization": {
        "refresh_interval": 50,    // Milliseconds between updates
        "trail_length": 50,        // Number of points in trails
        "auto_launch": true,       // Start visualization automatically
        "point_scale": 1.0         // Size multiplier for bodies
    }
}
```

## Interpreting Results

### Energy Conservation
- **Good**: Energy error < 0.01% over long periods
- **Warning**: Energy error 0.01% - 1%
- **Critical**: Energy error > 1% (check parameters)

### Orbital Stability
- **Stable Orbits**: Smooth, repeating elliptical paths
- **Unstable Systems**: Erratic or escaping trajectories
- **Collisions**: Bodies merge when they get too close

### Performance Metrics
- **Real-time Factor**: How much faster than reality the simulation runs
- **Memory Usage**: System resources consumed
- **Accuracy**: Energy conservation and orbital precision

## Troubleshooting

### Common Issues

**Simulation Too Slow:**
1. Reduce number of bodies
2. Increase time step (if stable)
3. Disable energy monitoring
4. Use fewer visualization features

**Unstable Results:**
1. Enable adaptive time stepping
2. Reduce base time step
3. Check initial conditions
4. Monitor energy conservation

**Visualization Problems:**
1. Restart both simulation and visualization
2. Check that CSV file is being updated
3. Reduce trail length and refresh rate
4. Close other graphics-intensive applications

**Energy Not Conserved:**
1. Reduce time step size
2. Enable adaptive time stepping
3. Check for unrealistic initial conditions
4. Verify compilation optimization flags

### Error Messages

**"Failed to open output file"**
- Check file permissions
- Ensure directory is writable
- Close any programs using the CSV file

**"No C++ compiler found"**
- Install g++ or Visual Studio Build Tools
- Add compiler to system PATH
- Run enhanced_setup.py again

**"ModuleNotFoundError"**
- Install missing Python packages
- Run `pip install -r requirements.txt`
- Check Python environment activation

## Advanced Features

### Custom Initial Conditions

**Modifying Solar System:**
Edit the `create_solar_system()` function in the C++ code:

```cpp
// Add custom body
bodies.emplace_back(mass, Vector3(x, y, z), Vector3(vx, vy, vz), "Name", radius);
```

**Random Body Parameters:**
Adjust parameters in `generate_random_bodies()`:
- `max_distance`: Spatial extent of system
- `max_mass`: Mass range for bodies
- Velocity distribution for orbital stability

### Performance Optimization

**For Large Systems (>100 bodies):**
1. Disable real-time visualization
2. Reduce output frequency
3. Use optimized compiler flags
4. Consider implementing Barnes-Hut algorithm

**For High Precision:**
1. Reduce time step significantly
2. Enable all monitoring features
3. Use double precision throughout
4. Implement higher-order integrators

### Data Analysis

**Using Jupyter Notebooks:**
```python
import pandas as pd
import matplotlib.pyplot as plt

# Load simulation data
data = pd.read_csv('nbody_realtime_data.csv')

# Plot energy over time
energy_data = data.groupby('iteration')['total_system_energy'].first()
plt.plot(energy_data.index, energy_data.values)
plt.xlabel('Iteration')
plt.ylabel('Total Energy (J)')
plt.title('Energy Conservation')
plt.show()
```

**Statistical Analysis:**
- Orbital period calculation
- Eccentricity measurements
- Angular momentum conservation
- Phase space analysis

### Integration with Other Tools

**Export to Other Formats:**
- Convert CSV to HDF5 for large datasets
- Export positions for external visualization tools
- Generate input files for other N-body codes

**Real-time Monitoring:**
- Connect to external monitoring systems
- Set up automated alerts for instabilities
- Log performance metrics

## Best Practices

### Simulation Setup
1. Start with small systems to test parameters
2. Always monitor energy conservation
3. Use adaptive time stepping for unknown systems
4. Save configuration files for reproducibility

### Performance
1. Profile your system to find bottlenecks
2. Use appropriate compiler optimizations
3. Monitor memory usage for large systems
4. Consider parallel algorithms for very large N

### Accuracy
1. Validate against known solutions when possible
2. Test conservation laws (energy, momentum, angular momentum)
3. Compare different integration methods
4. Document all parameter choices

### Visualization
1. Adjust trail length based on system dynamics
2. Use appropriate scaling for body sizes
3. Center view on the most interesting dynamics
4. Save snapshots of interesting configurations

## Tips for Realistic Simulations

### Solar System Accuracy
- Use precise initial conditions from JPL ephemeris
- Include perturbations from largest asteroids
- Consider relativistic effects for Mercury
- Account for solar radiation pressure

### Stellar Cluster Dynamics
- Use realistic mass functions
- Include stellar evolution effects
- Consider galactic tidal forces
- Implement binary star formation

### Galaxy Simulation
- Use dark matter halos
- Include gas dynamics
- Consider star formation
- Implement feedback mechanisms

## Getting Help

### Documentation
- README.md: Overview and quick start
- This guide: Detailed usage instructions
- Code comments: Implementation details
- Jupyter notebooks: Analysis examples

### Community Resources
- GitHub Issues: Bug reports and feature requests
- Discussion Forum: Usage questions and tips
- Wiki: Community-contributed examples
- Video Tutorials: Step-by-step walkthroughs

### Support
If you encounter issues:
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Create a new issue with:
   - Your system information
   - Complete error messages
   - Steps to reproduce the problem
   - Configuration files used

Remember: N-body simulation is computationally intensive and may require patience for large systems or long integration times!
