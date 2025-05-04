#!/usr/bin/env python
import subprocess
import sys
import os
import platform

def check_python_version():
    """Check if Python version is compatible."""
    required_version = (3, 6)
    current_version = sys.version_info
    
    if current_version < required_version:
        print(f"Error: Python {required_version[0]}.{required_version[1]} or higher is required.")
        print(f"Current version: {current_version[0]}.{current_version[1]}")
        return False
    return True

def check_cpp_compiler():
    """Check if a C++ compiler is available."""
    system = platform.system()
    
    if system == "Windows":
        try:
            # Check if g++ is available
            result = subprocess.run(['g++', '--version'], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, 
                                   text=True)
            if result.returncode == 0:
                print("✓ g++ compiler found.")
                return True
        except FileNotFoundError:
            pass
            
        # Check for MSVC
        try:
            result = subprocess.run(['cl'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE, 
                                  text=True)
            if "Microsoft" in result.stderr:
                print("✓ MSVC compiler found.")
                return True
        except FileNotFoundError:
            pass
            
        print("❌ No C++ compiler found.")
        print("Please install g++ (MinGW) or Microsoft Visual C++ and make sure it's in your PATH.")
        print("MinGW: https://www.mingw-w64.org/downloads/")
        print("MSVC: https://visualstudio.microsoft.com/downloads/")
        return False
        
    elif system == "Linux" or system == "Darwin":  # Linux or macOS
        try:
            result = subprocess.run(['g++', '--version'], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, 
                                   text=True)
            if result.returncode == 0:
                print("✓ g++ compiler found.")
                return True
        except FileNotFoundError:
            if system == "Linux":
                print("❌ g++ compiler not found. Please install it with:")
                print("   sudo apt-get install g++")
            else:  # macOS
                print("❌ g++ compiler not found. Please install it with:")
                print("   xcode-select --install")
            return False
    
    return False

def install_python_dependencies():
    """Install required Python packages using pip."""
    print("\nInstalling Python dependencies...")
    requirements_file = "requirements.txt"
    
    if not os.path.exists(requirements_file):
        print(f"❌ {requirements_file} not found.")
        return False
    
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", requirements_file], check=True)
        print("✓ Python dependencies installed successfully.")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install Python dependencies.")
        return False

def compile_cpp_code():
    """Compile the C++ simulation code."""
    print("\nCompiling N-body simulation code...")
    
    cpp_file = "nbody_simulation.cpp"
    output_file = "nbody_simulation"
    
    if not os.path.exists(cpp_file):
        print(f"❌ {cpp_file} not found.")
        return False
    
    if platform.system() == "Windows":
        output_file += ".exe"
    
    try:
        subprocess.run(["g++", cpp_file, "-o", output_file, "-O2"], check=True)
        print(f"✓ Compilation successful. Executable created: {output_file}")
        return True
    except subprocess.CalledProcessError:
        print("❌ Compilation failed.")
        return False
    except FileNotFoundError:
        print("❌ g++ compiler not found or not in PATH.")
        return False

def main():
    """Main function to set up the N-body simulation environment."""
    print("=" * 60)
    print("N-Body Simulation Setup")
    print("=" * 60)
    
    # Check Python version
    if not check_python_version():
        return
    
    # Check for C++ compiler
    compiler_available = check_cpp_compiler()
    
    # Install Python dependencies
    dependencies_installed = install_python_dependencies()
    
    # Compile C++ code if compiler is available
    if compiler_available:
        compiled = compile_cpp_code()
    else:
        compiled = False
        
    print("\n" + "=" * 60)
    print("Setup Summary:")
    print("=" * 60)
    print(f"Python dependencies: {'✓ Installed' if dependencies_installed else '❌ Not installed'}")
    print(f"C++ compilation: {'✓ Successful' if compiled else '❌ Not completed'}")
    print("\nTo run the simulation:")
    
    if compiled:
        if platform.system() == "Windows":
            print("1. Run the simulation:       .\\nbody_simulation.exe")
        else:
            print("1. Run the simulation:       ./nbody_simulation")
    else:
        print("1. Compile and run the simulation manually after installing a C++ compiler")
    
    print("2. Visualize the results:    python visualize_simulation.py")
    print("\nFor more information, please refer to the README.md file.")
    print("=" * 60)

if __name__ == "__main__":
    main()