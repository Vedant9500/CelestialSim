#include <iostream>
#include <vector>
#include <cmath>
#include <fstream>
#include <chrono>
#include <random>
#include <string>
#include <iomanip>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <cstdlib>   // For system()
#include <windows.h> // For launching processes on Windows

// Constants
const double G = 6.67430e-11;  // Gravitational constant (m^3 kg^-1 s^-2)
double TIME_STEP = 86400.0;    // Default time step (1 day in seconds)
int NUM_ITERATIONS = 1000000;  // Very large number to effectively run indefinitely

// 3D Vector class
struct Vector3 {
    double x, y, z;

    Vector3() : x(0), y(0), z(0) {}
    Vector3(double x, double y, double z) : x(x), y(y), z(z) {}

    // Vector operations
    Vector3 operator+(const Vector3& v) const {
        return Vector3(x + v.x, y + v.y, z + v.z);
    }

    Vector3 operator-(const Vector3& v) const {
        return Vector3(x - v.x, y - v.y, z - v.z);
    }

    Vector3 operator*(double scalar) const {
        return Vector3(x * scalar, y * scalar, z * scalar);
    }

    double magnitude() const {
        return std::sqrt(x*x + y*y + z*z);
    }

    Vector3 normalize() const {
        double mag = magnitude();
        if (mag > 0) {
            return Vector3(x / mag, y / mag, z / mag);
        }
        return *this;
    }
};

// Body class representing a particle in the simulation
class Body {
public:
    double mass;
    Vector3 position;
    Vector3 velocity;
    Vector3 force;
    std::string name;

    Body(double m, const Vector3& pos, const Vector3& vel, const std::string& name = "")
        : mass(m), position(pos), velocity(vel), force(Vector3()), name(name) {}

    void update_force(const std::vector<Body>& bodies) {
        force = Vector3(0, 0, 0);
        for (const auto& other : bodies) {
            if (this == &other) continue; // Skip self

            Vector3 direction = other.position - position;
            double distance = direction.magnitude();
            
            // Add small smoothing to prevent extreme forces at small distances
            double smoothing = 1e-10;
            
            if (distance < smoothing) distance = smoothing;
            
            // Calculate gravitational force magnitude
            double forceMagnitude = G * mass * other.mass / (distance * distance);
            
            // Add to the total force
            force = force + direction.normalize() * forceMagnitude;
        }
    }

    void update_position() {
        // F = ma => a = F/m
        Vector3 acceleration = force * (1.0 / mass);
        
        // Update velocity: v = v + a*dt
        velocity = velocity + acceleration * TIME_STEP;
        
        // Update position: p = p + v*dt
        position = position + velocity * TIME_STEP;
    }
};

// Generate random initial conditions
std::vector<Body> generate_random_bodies(int n, double max_distance, double max_mass) {
    std::vector<Body> bodies;
    std::mt19937 gen(std::random_device{}());
    std::uniform_real_distribution<> dist_pos(-max_distance, max_distance);
    std::uniform_real_distribution<> dist_vel(-10, 10);
    std::uniform_real_distribution<> dist_mass(max_mass / 100, max_mass);

    for (int i = 0; i < n; i++) {
        Vector3 pos(dist_pos(gen), dist_pos(gen), dist_pos(gen));
        Vector3 vel(dist_vel(gen), dist_vel(gen), dist_vel(gen));
        double mass = dist_mass(gen);
        bodies.emplace_back(mass, pos, vel, "Body" + std::to_string(i+1));
    }
    return bodies;
}

// Solar system setup (simplified with appropriate scales)
std::vector<Body> create_solar_system() {
    std::vector<Body> bodies;
    
    // Sun (at origin)
    bodies.emplace_back(1.989e30, Vector3(0, 0, 0), Vector3(0, 0, 0), "Sun");
    
    // Mercury (scale: ~58 million km, ~47 km/s)
    bodies.emplace_back(3.301e23, Vector3(57.9e9, 0, 0), Vector3(0, 47.4e3, 0), "Mercury");
    
    // Venus (scale: ~108 million km, ~35 km/s)
    bodies.emplace_back(4.867e24, Vector3(108.2e9, 0, 0), Vector3(0, 35.0e3, 0), "Venus");
    
    // Earth (scale: ~150 million km, ~30 km/s)
    bodies.emplace_back(5.972e24, Vector3(149.6e9, 0, 0), Vector3(0, 29.8e3, 0), "Earth");
    
    // Mars (scale: ~228 million km, ~24 km/s)
    bodies.emplace_back(6.417e23, Vector3(227.9e9, 0, 0), Vector3(0, 24.1e3, 0), "Mars");
    
    // Jupiter (scale: ~778 million km, ~13 km/s)
    bodies.emplace_back(1.898e27, Vector3(778.5e9, 0, 0), Vector3(0, 13.1e3, 0), "Jupiter");
    
    return bodies;
}

// Real-time simulation variables
std::mutex data_mutex;
std::condition_variable data_cv;
std::vector<Body> current_bodies;
std::atomic<bool> simulation_running(true);

// Save simulation data in real-time for visualization
void save_realtime_data(const std::vector<Body>& bodies) {
    std::ofstream outfile("nbody_realtime_data.csv");
    if (!outfile.is_open()) {
        std::cerr << "Failed to open output file: nbody_realtime_data.csv" << std::endl;
        return;
    }

    // Write header
    outfile << "body_id,name,mass,x,y,z,vx,vy,vz" << std::endl;

    // Write body data
    for (size_t b = 0; b < bodies.size(); b++) {
        const auto& body = bodies[b];
        outfile << b << ","
              << body.name << ","
              << body.mass << ","
              << body.position.x << ","
              << body.position.y << ","
              << body.position.z << ","
              << body.velocity.x << ","
              << body.velocity.y << ","
              << body.velocity.z
              << std::endl;
    }
    outfile.close();
}

// Save simulation data to a file for visualization
void save_simulation_data(const std::vector<std::vector<Body>>& history, const std::string& filename) {
    std::ofstream outfile(filename);
    if (!outfile.is_open()) {
        std::cerr << "Failed to open output file: " << filename << std::endl;
        return;
    }

    // Write header
    outfile << "iteration,body_id,name,mass,x,y,z,vx,vy,vz" << std::endl;

    // Write data
    for (size_t iter = 0; iter < history.size(); iter++) {
        const auto& bodies = history[iter];
        for (size_t b = 0; b < bodies.size(); b++) {
            const auto& body = bodies[b];
            outfile << iter << ","
                  << b << ","
                  << body.name << ","
                  << body.mass << ","
                  << body.position.x << ","
                  << body.position.y << ","
                  << body.position.z << ","
                  << body.velocity.x << ","
                  << body.velocity.y << ","
                  << body.velocity.z
                  << std::endl;
        }
    }
    outfile.close();
    std::cout << "Simulation data saved to " << filename << std::endl;
}

// Function to launch the visualization script
void launch_visualization() {
    // Create a detached process for the Python visualization
    STARTUPINFO si;
    PROCESS_INFORMATION pi;

    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    // Command to run the Python visualization script
    // Try multiple Python command variants to increase chances of success
    std::string pythonCommand = "python realtime_visualize.py";
    
    // Execute the command
    if (!CreateProcess(NULL, const_cast<LPSTR>(pythonCommand.c_str()), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
        // First attempt failed, try with pythonw
        std::string pythonwCommand = "pythonw realtime_visualize.py";
        if (!CreateProcess(NULL, const_cast<LPSTR>(pythonwCommand.c_str()), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
            // Second attempt failed, try with full path to python
            std::string sysPythonCommand = "C:\\Windows\\py.exe realtime_visualize.py";
            if (!CreateProcess(NULL, const_cast<LPSTR>(sysPythonCommand.c_str()), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
                // All attempts failed, try with system()
                std::cout << "Trying alternative launch method..." << std::endl;
                int result = system("start python realtime_visualize.py");
                
                if (result != 0) {
                    std::cerr << "Failed to start visualization. Error code: " << GetLastError() << std::endl;
                    std::cout << "Please run 'python realtime_visualize.py' manually in another terminal." << std::endl;
                    return;
                }
            }
        }
    }
    
    // Close process handles if CreateProcess succeeded
    if (pi.hProcess != NULL) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }
    
    std::cout << "Visualization started successfully!" << std::endl;
}

// Function to check if shutdown was requested by visualization
bool check_shutdown_requested() {
    std::ifstream shutdown_file("shutdown_signal.txt");
    return shutdown_file.good();  // File exists if the visualization was closed
}

// Simulate the N-body system in a separate thread
void run_simulation_threaded(std::vector<Body> bodies, int iterations) {
    auto start_time = std::chrono::high_resolution_clock::now();
    current_bodies = bodies; // Initialize current bodies
    
    int update_frequency = 1; // Update frequency (every N iterations)
    int iteration = 0;
    
    // Run until the simulation is stopped or max iterations reached
    while (simulation_running && iteration < iterations) {
        // Check if visualization requested shutdown
        if (check_shutdown_requested()) {
            std::cout << "\nVisualization window closed, stopping simulation..." << std::endl;
            simulation_running = false;
            break;
        }
        
        // Update forces for each body
        for (auto& body : bodies) {
            body.update_force(bodies);
        }

        // Update positions based on calculated forces
        for (auto& body : bodies) {
            body.update_position();
        }

        // Update shared data structure for visualization
        if (iteration % update_frequency == 0) {
            {
                std::lock_guard<std::mutex> lock(data_mutex);
                current_bodies = bodies;
            }
            data_cv.notify_one();
            
            // Update the realtime data file for external visualization
            save_realtime_data(bodies);
        }

        // Print progress periodically
        if (iteration % 100 == 0) {
            std::cout << "Completed iteration " << iteration << " (simulation time: " 
                     << iteration * TIME_STEP / 86400.0 << " days)\r";
            std::cout.flush();
        }
        
        // Add small sleep to prevent CPU hogging
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
        
        iteration++;
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
    
    std::cout << std::endl << "Simulation completed in " << duration << " ms" << std::endl;
}

// Simulate the N-body system
void run_simulation(std::vector<Body>& bodies, int iterations, bool save_data) {
    std::vector<std::vector<Body>> history;
    
    if (save_data) {
        history.reserve(iterations + 1);
        history.push_back(bodies); // Save initial state
    }

    auto start_time = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < iterations; i++) {
        // Update forces for each body
        for (auto& body : bodies) {
            body.update_force(bodies);
        }

        // Update positions based on calculated forces
        for (auto& body : bodies) {
            body.update_position();
        }

        // Save the current state if requested
        if (save_data && (i % 10 == 0 || i == iterations - 1)) {
            history.push_back(bodies);
        }

        // Print progress
        if (i % 100 == 0 || i == iterations - 1) {
            std::cout << "Completed iteration " << i+1 << " of " << iterations << "\r";
            std::cout.flush();
        }
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
    
    std::cout << std::endl << "Simulation completed in " << duration << " ms" << std::endl;

    // Save simulation data if requested
    if (save_data) {
        save_simulation_data(history, "nbody_simulation_results.csv");
    }
}

// Display the state of the system
void display_system_state(const std::vector<Body>& bodies) {
    std::cout << std::setw(12) << "Name" 
              << std::setw(15) << "Position (x)" 
              << std::setw(15) << "Position (y)" 
              << std::setw(15) << "Position (z)" 
              << std::setw(15) << "Velocity" << std::endl;
    
    std::cout << std::string(75, '-') << std::endl;
    
    for (const auto& body : bodies) {
        double vel_mag = body.velocity.magnitude();
        std::cout << std::setw(12) << body.name
                  << std::setw(15) << body.position.x
                  << std::setw(15) << body.position.y
                  << std::setw(15) << body.position.z
                  << std::setw(15) << vel_mag << std::endl;
    }
}

int main() {
    int choice;
    std::cout << "N-Body Simulation" << std::endl;
    std::cout << "1. Solar System Simulation" << std::endl;
    std::cout << "2. Random Bodies Simulation" << std::endl;
    std::cout << "Enter your choice (1-2): ";
    std::cin >> choice;

    std::vector<Body> bodies;

    if (choice == 1) {
        // Solar system simulation with appropriate time steps for visible movement
        TIME_STEP = 86400.0; // 1 day per step
        bodies = create_solar_system();
        std::cout << "Starting Solar System simulation with " << bodies.size() << " bodies." << std::endl;
        std::cout << "Using time step of 1 day, simulating indefinitely until you close the program." << std::endl;
    } else {
        // Random bodies simulation
        int num_bodies;
        std::cout << "Enter number of bodies: ";
        std::cin >> num_bodies;
        
        bodies = generate_random_bodies(num_bodies, 1.0e11, 1.0e30);
        std::cout << "Generated " << bodies.size() << " random bodies." << std::endl;
        std::cout << "Time step: " << TIME_STEP << " seconds" << std::endl;
    }
    
    std::cout << "Initial state:" << std::endl;
    display_system_state(bodies);
    
    std::cout << std::endl;
    std::cout << "The simulation will now run in real-time until you close the program." << std::endl;
    std::cout << "The current state will be continuously written to 'nbody_realtime_data.csv'." << std::endl;
    
    // Launch visualization automatically
    std::cout << "Launching visualization..." << std::endl;
    launch_visualization();
    
    // Start simulation in a separate thread
    std::thread sim_thread(run_simulation_threaded, bodies, NUM_ITERATIONS);
    
    std::cout << "Simulation running... Press Enter to stop" << std::endl;
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cin.get();
    
    // Signal the simulation to stop
    simulation_running = false;
    
    // Wait for simulation thread to finish
    if (sim_thread.joinable()) {
        sim_thread.join();
    }
    
    std::cout << "Final state:" << std::endl;
    {
        std::lock_guard<std::mutex> lock(data_mutex);
        display_system_state(current_bodies);
    }
    
    return 0;
}