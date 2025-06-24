#!/usr/bin/env python3
"""
Simple Setup for Interactive N-Body Simulation
==============================================

Just installs pygame and runs the interactive 2D simulation!
"""

import subprocess
import sys
import os

def install_pygame():
    """Install pygame for the interactive simulation"""
    print("Installing pygame for interactive simulation...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "pygame>=2.0.0"], check=True)
        print("✓ pygame installed successfully!")
        return True
    except subprocess.CalledProcessError:
        print("✗ Failed to install pygame")
        print("Try manually: pip install pygame")
        return False

def test_pygame():
    """Test if pygame works"""
    try:
        import pygame
        print("✓ pygame is working!")
        return True
    except ImportError:
        print("✗ pygame not available")
        return False

def main():
    print("🎮 Interactive N-Body Simulation Setup")
    print("=====================================")
    print()
    
    # Check if pygame is already installed
    if test_pygame():
        print("pygame is already installed!")
    else:
        if not install_pygame():
            return False
    
    print()
    print("🚀 Setup Complete!")
    print()
    print("To run the interactive 2D simulation:")
    print("python interactive_2d_simulation.py")
    print()
    print("Controls:")
    print("- Left Click: Place bodies")
    print("- Right Click: Select bodies")  
    print("- Space: Start/Pause")
    print("- Mouse Wheel: Zoom")
    print()
    
    # Ask if user wants to run it now
    if input("Run the simulation now? (y/n): ").lower().strip() == 'y':
        try:
            import interactive_2d_simulation
            interactive_2d_simulation.main()
        except Exception as e:
            print(f"Error running simulation: {e}")
            print("Try running: python interactive_2d_simulation.py")
    
    return True

if __name__ == "__main__":
    main()
