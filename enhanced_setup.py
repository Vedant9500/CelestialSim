#!/usr/bin/env python3
"""
Enhanced N-Body Simulation Setup and Configuration Tool
======================================================

This script provides an enhanced setup experience for the N-body simulation
with better error handling, configuration options, and user guidance.
"""

import subprocess
import sys
import os
import platform
import json
from pathlib import Path

class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_colored(text, color=Colors.ENDC):
    """Print colored text to terminal"""
    print(f"{color}{text}{Colors.ENDC}")

def print_header(text):
    """Print a formatted header"""
    print_colored(f"\n{'='*60}", Colors.HEADER)
    print_colored(f"{text:^60}", Colors.HEADER)
    print_colored(f"{'='*60}", Colors.HEADER)

def print_section(text):
    """Print a section header"""
    print_colored(f"\n{text}", Colors.OKBLUE)
    print_colored("-" * len(text), Colors.OKBLUE)

def print_success(text):
    """Print success message"""
    print_colored(f"✓ {text}", Colors.OKGREEN)

def print_warning(text):
    """Print warning message"""
    print_colored(f"⚠ {text}", Colors.WARNING)

def print_error(text):
    """Print error message"""
    print_colored(f"✗ {text}", Colors.FAIL)

def check_python_version():
    """Check if Python version is compatible"""
    required_version = (3, 7)
    current_version = sys.version_info
    
    if current_version < required_version:
        print_error(f"Python {required_version[0]}.{required_version[1]} or higher is required.")
        print_error(f"Current version: {current_version[0]}.{current_version[1]}")
        print("\nPlease upgrade Python:")
        print("- Windows: Download from https://python.org")
        print("- Linux: sudo apt update && sudo apt install python3")
        print("- macOS: brew install python3")
        return False
    
    print_success(f"Python {current_version[0]}.{current_version[1]} is compatible")
    return True

def check_cpp_compiler():
    """Check if a C++ compiler is available with detailed guidance"""
    system = platform.system()
    
    print_section("Checking C++ Compiler")
    
    if system == "Windows":
        # Check for g++
        try:
            result = subprocess.run(['g++', '--version'], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, 
                                   text=True, timeout=10)
            if result.returncode == 0:
                version_line = result.stdout.split('\n')[0]
                print_success(f"g++ compiler found: {version_line}")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
            
        # Check for MSVC
        try:
            result = subprocess.run(['cl'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE, 
                                  text=True, timeout=10)
            if "Microsoft" in result.stderr:
                print_success("MSVC compiler found")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
            
        print_error("No C++ compiler found")
        print("\nInstallation options:")
        print("1. MinGW-w64 (Recommended for beginners):")
        print("   - Download from: https://www.mingw-w64.org/downloads/")
        print("   - Or install via MSYS2: https://www.msys2.org/")
        print("2. Visual Studio Build Tools:")
        print("   - Download from: https://visualstudio.microsoft.com/downloads/")
        print("3. Install via package manager:")
        print("   - Chocolatey: choco install mingw")
        print("   - Scoop: scoop install gcc")
        return False
        
    elif system in ["Linux", "Darwin"]:
        try:
            result = subprocess.run(['g++', '--version'], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, 
                                   text=True, timeout=10)
            if result.returncode == 0:
                version_line = result.stdout.split('\n')[0]
                print_success(f"g++ compiler found: {version_line}")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
            
        print_error("g++ compiler not found")
        if system == "Linux":
            print("\nInstallation commands:")
            print("Ubuntu/Debian: sudo apt update && sudo apt install build-essential")
            print("CentOS/RHEL:   sudo yum groupinstall 'Development Tools'")
            print("Fedora:        sudo dnf groupinstall 'Development Tools'")
            print("Arch:          sudo pacman -S base-devel")
        else:  # macOS
            print("\nInstallation options:")
            print("1. Xcode Command Line Tools: xcode-select --install")
            print("2. Homebrew: brew install gcc")
        return False
    
    return False

def install_python_dependencies():
    """Install required Python packages with enhanced error handling"""
    print_section("Installing Python Dependencies")
    
    requirements_file = "requirements.txt"
    enhanced_requirements = "requirements_enhanced.txt"
    
    # Create enhanced requirements if needed
    create_enhanced_requirements()
    
    if not os.path.exists(requirements_file):
        print_error(f"{requirements_file} not found")
        return False
    
    try:
        # Upgrade pip first
        print("Upgrading pip...")
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"], 
                      check=True, capture_output=True)
        print_success("pip upgraded successfully")
        
        # Install requirements
        print(f"Installing packages from {requirements_file}...")
        result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", requirements_file], 
                               capture_output=True, text=True)
        
        if result.returncode == 0:
            print_success("Python dependencies installed successfully")
            
            # Install enhanced requirements if available
            if os.path.exists(enhanced_requirements):
                print("Installing enhanced features...")
                subprocess.run([sys.executable, "-m", "pip", "install", "-r", enhanced_requirements], 
                              capture_output=True)
            
            # Verify installations
            verify_python_packages()
            return True
        else:
            print_error("Failed to install Python dependencies")
            print("Error output:")
            print(result.stderr)
            print("\nTroubleshooting tips:")
            print("1. Try: python -m pip install --user -r requirements.txt")
            print("2. Update pip: python -m pip install --upgrade pip")
            print("3. Use virtual environment: python -m venv venv && venv\\Scripts\\activate")
            return False
            
    except subprocess.CalledProcessError as e:
        print_error(f"Installation failed: {e}")
        return False

def create_enhanced_requirements():
    """Create enhanced requirements file with additional useful packages"""
    enhanced_packages = [
        "scipy>=1.7.0",      # For advanced numerical methods
        "numba>=0.56.0",     # For JIT compilation
        "plotly>=5.0.0",     # For interactive 3D plots
        "jupyter>=1.0.0",    # For interactive development
        "ipywidgets>=7.6.0", # For Jupyter widgets
    ]
    
    with open("requirements_enhanced.txt", "w") as f:
        f.write("# Enhanced packages for advanced features\n")
        for package in enhanced_packages:
            f.write(f"{package}\n")

def verify_python_packages():
    """Verify that all required packages are properly installed"""
    required_packages = ['matplotlib', 'pandas', 'numpy']
    enhanced_packages = ['scipy', 'numba', 'plotly']
    
    print("\nVerifying installations:")
    
    all_good = True
    for package in required_packages:
        try:
            __import__(package)
            print_success(f"{package} is available")
        except ImportError:
            print_error(f"{package} is not available")
            all_good = False
    
    for package in enhanced_packages:
        try:
            __import__(package)
            print_success(f"{package} is available (enhanced features)")
        except ImportError:
            print_warning(f"{package} is not available (enhanced features disabled)")
    
    return all_good

def compile_cpp_code():
    """Compile the C++ simulation code with optimization"""
    print_section("Compiling C++ Simulation")
    
    cpp_files = ["nbody_simulation.cpp", "nbody_simulation_optimized.cpp"]
    cpp_file = None
    
    # Find available C++ source file
    for file in cpp_files:
        if os.path.exists(file):
            cpp_file = file
            break
    
    if not cpp_file:
        print_error("No C++ source file found")
        print("Expected files: " + ", ".join(cpp_files))
        return False
    
    output_file = "nbody_simulation"
    if platform.system() == "Windows":
        output_file += ".exe"
    
    # Compilation flags for optimization and debugging
    flags = ["-O3", "-std=c++11", "-Wall"]
    
    if platform.system() != "Windows":
        flags.extend(["-pthread", "-lm"])
    
    compile_command = ["g++", cpp_file, "-o", output_file] + flags
    
    try:
        print(f"Compiling {cpp_file} with optimizations...")
        result = subprocess.run(compile_command, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print_success(f"Compilation successful: {output_file}")
            
            # Check if file was actually created
            if os.path.exists(output_file):
                file_size = os.path.getsize(output_file)
                print_success(f"Executable size: {file_size:,} bytes")
                return True
            else:
                print_error("Executable was not created")
                return False
        else:
            print_error("Compilation failed")
            print("Error output:")
            print(result.stderr)
            print("\nTroubleshooting:")
            print("1. Check if all source files are present")
            print("2. Verify compiler installation")
            print("3. Try manual compilation: g++ -o nbody_simulation nbody_simulation.cpp")
            return False
            
    except subprocess.TimeoutExpired:
        print_error("Compilation timed out")
        return False
    except FileNotFoundError:
        print_error("g++ compiler not found in PATH")
        return False

def create_config_file():
    """Create a configuration file for the simulation"""
    config = {
        "simulation": {
            "use_adaptive_timestep": True,
            "enable_collision_detection": True,
            "enable_energy_monitoring": True,
            "default_time_step": 86400.0,
            "max_iterations": 1000000
        },
        "visualization": {
            "refresh_interval": 50,
            "trail_length": 50,
            "auto_launch": True,
            "save_snapshots": True
        },
        "performance": {
            "use_optimization": True,
            "thread_count": "auto",
            "memory_limit_mb": 1024
        }
    }
    
    with open("simulation_config.json", "w") as f:
        json.dump(config, f, indent=4)
    
    print_success("Configuration file created: simulation_config.json")

def setup_development_environment():
    """Setup development environment with useful tools"""
    print_section("Setting Up Development Environment")
    
    # Create VS Code settings if VS Code is detected
    if os.path.exists(".vscode") or input("Setup VS Code configuration? (y/n): ").lower() == 'y':
        setup_vscode_config()
    
    # Create Jupyter notebook examples
    if input("Create Jupyter notebook examples? (y/n): ").lower() == 'y':
        create_jupyter_examples()

def setup_vscode_config():
    """Setup VS Code configuration for the project"""
    vscode_dir = Path(".vscode")
    vscode_dir.mkdir(exist_ok=True)
    
    # Settings
    settings = {
        "python.defaultInterpreterPath": sys.executable,
        "C_Cpp.default.compilerPath": "g++",
        "C_Cpp.default.cppStandard": "c++11",
        "files.associations": {
            "*.cpp": "cpp",
            "*.h": "c",
            "*.py": "python"
        }
    }
    
    with open(vscode_dir / "settings.json", "w") as f:
        json.dump(settings, f, indent=4)
    
    # Tasks
    tasks = {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "Compile C++ Simulation",
                "type": "shell",
                "command": "g++",
                "args": ["-o", "nbody_simulation", "nbody_simulation.cpp", "-O3"],
                "group": {
                    "kind": "build",
                    "isDefault": True
                }
            },
            {
                "label": "Run Simulation",
                "type": "shell",
                "command": "./nbody_simulation" if platform.system() != "Windows" else ".\\nbody_simulation.exe",
                "dependsOn": "Compile C++ Simulation"
            }
        ]
    }
    
    with open(vscode_dir / "tasks.json", "w") as f:
        json.dump(tasks, f, indent=4)
    
    print_success("VS Code configuration created")

def create_jupyter_examples():
    """Create Jupyter notebook examples"""
    notebook_content = {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "# N-Body Simulation Analysis\n",
                    "\n",
                    "This notebook demonstrates how to analyze N-body simulation data."
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "source": [
                    "import pandas as pd\n",
                    "import matplotlib.pyplot as plt\n",
                    "import numpy as np\n",
                    "\n",
                    "# Load simulation data\n",
                    "data = pd.read_csv('nbody_realtime_data.csv')\n",
                    "print(f\"Loaded {len(data)} data points\")\n",
                    "data.head()"
                ]
            }
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    }
    
    with open("analysis_example.ipynb", "w") as f:
        json.dump(notebook_content, f, indent=2)
    
    print_success("Jupyter notebook example created: analysis_example.ipynb")

def run_tests():
    """Run basic tests to verify installation"""
    print_section("Running Tests")
    
    tests_passed = 0
    total_tests = 3
    
    # Test 1: Python imports
    try:
        import matplotlib.pyplot as plt
        import pandas as pd
        import numpy as np
        print_success("Python package imports work")
        tests_passed += 1
    except ImportError as e:
        print_error(f"Python import test failed: {e}")
    
    # Test 2: C++ executable exists
    executable = "nbody_simulation.exe" if platform.system() == "Windows" else "nbody_simulation"
    if os.path.exists(executable):
        print_success("C++ executable exists")
        tests_passed += 1
    else:
        print_error("C++ executable not found")
    
    # Test 3: Configuration file
    if os.path.exists("simulation_config.json"):
        print_success("Configuration file exists")
        tests_passed += 1
    else:
        print_error("Configuration file not found")
    
    print(f"\nTests passed: {tests_passed}/{total_tests}")
    return tests_passed == total_tests

def main():
    """Main setup function"""
    print_header("Enhanced N-Body Simulation Setup")
    
    print_colored("This enhanced setup will configure your N-body simulation environment", Colors.OKCYAN)
    print_colored("with improved features, better error handling, and development tools.", Colors.OKCYAN)
    
    # Check system requirements
    if not check_python_version():
        return False
    
    compiler_available = check_cpp_compiler()
    dependencies_installed = install_python_dependencies()
    
    if compiler_available:
        compiled = compile_cpp_code()
    else:
        compiled = False
        print_warning("Skipping compilation due to missing compiler")
    
    # Create configuration and setup development environment
    create_config_file()
    
    if input("\nSetup development environment? (y/n): ").lower() == 'y':
        setup_development_environment()
    
    # Run tests
    if input("\nRun verification tests? (y/n): ").lower() == 'y':
        tests_passed = run_tests()
    else:
        tests_passed = True
    
    # Summary
    print_header("Setup Summary")
    
    status_items = [
        ("Python dependencies", dependencies_installed),
        ("C++ compilation", compiled),
        ("Configuration", True),
        ("Tests", tests_passed)
    ]
    
    for item, status in status_items:
        if status:
            print_success(f"{item}: Complete")
        else:
            print_error(f"{item}: Failed")
    
    print_section("Next Steps")
    
    if compiled:
        executable = ".\\nbody_simulation.exe" if platform.system() == "Windows" else "./nbody_simulation"
        print(f"1. Run simulation: {executable}")
    else:
        print("1. Install C++ compiler and run setup again")
    
    if dependencies_installed:
        print("2. Start visualization: python enhanced_visualize.py")
        print("3. Or use original: python realtime_visualize.py")
    
    print("4. Edit simulation_config.json to customize settings")
    print("5. Check README.md for detailed documentation")
    
    print_header("Thank you for using Enhanced N-Body Simulation!")
    
    return all(status for _, status in status_items)

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_colored("\n\nSetup interrupted by user", Colors.WARNING)
        sys.exit(1)
    except Exception as e:
        print_colored(f"\n\nUnexpected error: {e}", Colors.FAIL)
        import traceback
        traceback.print_exc()
        sys.exit(1)
