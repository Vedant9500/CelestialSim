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
#include <cstdlib>
#include <algorithm>
#ifdef _WIN32
#include <windows.h>
#endif

// Constants
const double G = 6.67430e-11;  // Gravitational constant (m^3 kg^-1 s^-2)
double TIME_STEP = 86400.0;    // Default time step (1 day in seconds)
int NUM_ITERATIONS = 1000000;  // Very large number to effectively run indefinitely

// Configuration
struct SimulationConfig {
    bool use_adaptive_timestep = true;
    bool enable_collision_detection = true;
    double collision_distance_factor = 2.0;  // Factor of body radius for collision
    double theta = 0.5;  // Barnes-Hut theta parameter (for future implementation)
    int max_depth = 12;  // Maximum octree depth (for future implementation)
    double energy_tolerance = 1e-6;  // Energy conservation tolerance
    bool enable_energy_monitoring = true;
};

SimulationConfig config;

// 3D Vector class with improved operations
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

    Vector3 operator/(double scalar) const {
        return Vector3(x / scalar, y / scalar, z / scalar);
    }

    Vector3& operator+=(const Vector3& v) {
        x += v.x; y += v.y; z += v.z;
        return *this;
    }

    Vector3& operator-=(const Vector3& v) {
        x -= v.x; y -= v.y; z -= v.z;
        return *this;
    }

    double magnitude() const {
        return std::sqrt(x*x + y*y + z*z);
    }

    double magnitude_squared() const {
        return x*x + y*y + z*z;
    }

    Vector3 normalize() const {
        double mag = magnitude();
        if (mag > 1e-15) {
            return Vector3(x / mag, y / mag, z / mag);
        }
        return Vector3(0, 0, 0);
    }

    double dot(const Vector3& v) const {
        return x * v.x + y * v.y + z * v.z;
    }
};

// Improved Body class with better physics
class Body {
public:
    double mass;
    double radius;  // Physical radius for collision detection
    Vector3 position;
    Vector3 velocity;
    Vector3 acceleration;
    Vector3 prev_acceleration;  // For Verlet integration
    std::string name;
    bool active;  // For collision handling

    Body(double m, const Vector3& pos, const Vector3& vel, const std::string& name = "", double r = 0)
        : mass(m), radius(r), position(pos), velocity(vel), 
          acceleration(Vector3()), prev_acceleration(Vector3()), name(name), active(true) {
        
        // Estimate radius if not provided (assuming sphere with density similar to Earth)
        if (radius <= 0) {
            const double earth_density = 5514.0;  // kg/m³
            radius = std::cbrt((3.0 * mass) / (4.0 * M_PI * earth_density));
        }
    }

    // Calculate force from another body with improved softening
    Vector3 calculate_force_from(const Body& other) const {
        if (!active || !other.active || this == &other) {
            return Vector3(0, 0, 0);
        }

        Vector3 direction = other.position - position;
        double distance_sq = direction.magnitude_squared();
        
        // Improved softening parameter based on physical radius
        double softening = std::max(radius, other.radius) * 0.1;
        distance_sq += softening * softening;
        
        double distance = std::sqrt(distance_sq);
        
        // Calculate gravitational force magnitude
        double force_magnitude = G * mass * other.mass / distance_sq;
        
        return direction.normalize() * force_magnitude;
    }

    // Check for collision with another body
    bool check_collision(const Body& other) const {
        if (!active || !other.active || this == &other) {
            return false;
        }
        
        double min_distance = (radius + other.radius) * config.collision_distance_factor;
        double distance = (position - other.position).magnitude();
        return distance < min_distance;
    }

    // Verlet integration for better stability and energy conservation
    void verlet_update(double dt) {
        if (!active) return;
        
        // Position update: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
        position += velocity * dt + acceleration * (0.5 * dt * dt);
        
        // Store current acceleration for next step
        Vector3 new_acceleration = acceleration;
        
        // Velocity update: v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
        velocity += (prev_acceleration + new_acceleration) * (0.5 * dt);
        
        prev_acceleration = new_acceleration;
    }

    // Calculate kinetic energy
    double kinetic_energy() const {
        return 0.5 * mass * velocity.magnitude_squared();
    }

    // Calculate potential energy with respect to other body
    double potential_energy_with(const Body& other) const {
        if (!active || !other.active || this == &other) {
            return 0.0;
        }
        
        double distance = (position - other.position).magnitude();
        if (distance < 1e-15) return 0.0;
        
        return -G * mass * other.mass / distance;
    }
};

// Collision handling
void handle_collision(Body& body1, Body& body2) {
    if (!body1.active || !body2.active) return;
    
    // Perfectly inelastic collision (bodies merge)
    double total_mass = body1.mass + body2.mass;
    
    // Conservation of momentum
    Vector3 new_velocity = (body1.velocity * body1.mass + body2.velocity * body2.mass) / total_mass;
    
    // Mass-weighted position
    Vector3 new_position = (body1.position * body1.mass + body2.position * body2.mass) / total_mass;
    
    // New radius (assuming same density)
    double new_radius = std::cbrt(std::pow(body1.radius, 3) + std::pow(body2.radius, 3));
    
    // Update the more massive body
    if (body1.mass >= body2.mass) {
        body1.mass = total_mass;
        body1.velocity = new_velocity;
        body1.position = new_position;
        body1.radius = new_radius;
        body1.name += "+" + body2.name;
        body2.active = false;
    } else {
        body2.mass = total_mass;
        body2.velocity = new_velocity;
        body2.position = new_position;
        body2.radius = new_radius;
        body2.name = body1.name + "+" + body2.name;
        body1.active = false;
    }
    
    std::cout << "Collision detected and resolved: " << body1.name << " merged with " << body2.name << std::endl;
}

// Calculate adaptive time step based on system dynamics
double calculate_adaptive_timestep(const std::vector<Body>& bodies, double base_timestep) {
    if (!config.use_adaptive_timestep) return base_timestep;
    
    double min_timestep = base_timestep;
    const double safety_factor = 0.1;
    
    for (const auto& body : bodies) {
        if (!body.active) continue;
        
        double acc_magnitude = body.acceleration.magnitude();
        if (acc_magnitude > 1e-15) {
            // Estimate time step based on acceleration
            double suggested_dt = safety_factor * std::sqrt(body.radius / acc_magnitude);
            min_timestep = std::min(min_timestep, suggested_dt);
        }
    }
    
    // Clamp between reasonable bounds
    return std::max(std::min(min_timestep, base_timestep), base_timestep * 0.01);
}

// Energy monitoring for stability checking
struct EnergyInfo {
    double kinetic;
    double potential;
    double total;
    double relative_error;
};

EnergyInfo calculate_system_energy(const std::vector<Body>& bodies) {
    EnergyInfo energy;
    energy.kinetic = 0.0;
    energy.potential = 0.0;
    
    // Calculate kinetic energy
    for (const auto& body : bodies) {
        if (body.active) {
            energy.kinetic += body.kinetic_energy();
        }
    }
    
    // Calculate potential energy (avoid double counting)
    for (size_t i = 0; i < bodies.size(); ++i) {
        if (!bodies[i].active) continue;
        for (size_t j = i + 1; j < bodies.size(); ++j) {
            if (!bodies[j].active) continue;
            energy.potential += bodies[i].potential_energy_with(bodies[j]);
        }
    }
    
    energy.total = energy.kinetic + energy.potential;
    return energy;
}

// Generate optimized random initial conditions
std::vector<Body> generate_random_bodies(int n, double max_distance, double max_mass) {
    std::vector<Body> bodies;
    std::mt19937 gen(std::random_device{}());
    std::uniform_real_distribution<> dist_pos(-max_distance, max_distance);
    std::uniform_real_distribution<> dist_mass(max_mass / 100, max_mass);
    
    for (int i = 0; i < n; i++) {
        Vector3 pos(dist_pos(gen), dist_pos(gen), dist_pos(gen));
        
        // Generate stable circular velocities around center of mass
        double orbital_radius = pos.magnitude();
        if (orbital_radius > 0) {
            // Estimate central mass for circular orbit
            double central_mass = max_mass * 10;  // Approximate central mass
            double orbital_velocity = std::sqrt(G * central_mass / orbital_radius);
            
            // Perpendicular velocity vector for circular orbit
            Vector3 radial = pos.normalize();
            Vector3 tangential = Vector3(-radial.y, radial.x, 0).normalize();
            Vector3 vel = tangential * orbital_velocity * (0.5 + 0.5 * dist_pos(gen) / max_distance);
            
            double mass = dist_mass(gen);
            bodies.emplace_back(mass, pos, vel, "Body" + std::to_string(i+1));
        }
    }
    return bodies;
}

// Improved solar system with more accurate data
std::vector<Body> create_solar_system() {
    std::vector<Body> bodies;
    
    // More accurate planetary data
    // Sun
    bodies.emplace_back(1.989e30, Vector3(0, 0, 0), Vector3(0, 0, 0), "Sun", 6.96e8);
    
    // Mercury
    bodies.emplace_back(3.301e23, Vector3(57.9e9, 0, 0), Vector3(0, 47.4e3, 0), "Mercury", 2.44e6);
    
    // Venus
    bodies.emplace_back(4.867e24, Vector3(108.2e9, 0, 0), Vector3(0, 35.0e3, 0), "Venus", 6.05e6);
    
    // Earth
    bodies.emplace_back(5.972e24, Vector3(149.6e9, 0, 0), Vector3(0, 29.8e3, 0), "Earth", 6.37e6);
    
    // Mars
    bodies.emplace_back(6.417e23, Vector3(227.9e9, 0, 0), Vector3(0, 24.1e3, 0), "Mars", 3.39e6);
    
    // Jupiter
    bodies.emplace_back(1.898e27, Vector3(778.5e9, 0, 0), Vector3(0, 13.1e3, 0), "Jupiter", 6.99e7);
    
    // Saturn
    bodies.emplace_back(5.683e26, Vector3(1.432e12, 0, 0), Vector3(0, 9.7e3, 0), "Saturn", 5.82e7);
    
    return bodies;
}

// Global variables for real-time simulation
std::mutex data_mutex;
std::condition_variable data_cv;
std::vector<Body> current_bodies;
std::atomic<bool> simulation_running(true);
EnergyInfo initial_energy, current_energy;

// Enhanced real-time data saving with more information
void save_realtime_data(const std::vector<Body>& bodies, const EnergyInfo& energy, int iteration) {
    std::ofstream outfile("nbody_realtime_data.csv");
    if (!outfile.is_open()) {
        std::cerr << "Failed to open output file: nbody_realtime_data.csv" << std::endl;
        return;
    }

    // Write header with additional information
    outfile << "iteration,body_id,name,mass,radius,x,y,z,vx,vy,vz,active,kinetic_energy,total_system_energy,energy_error" << std::endl;

    // Write body data
    for (size_t b = 0; b < bodies.size(); b++) {
        const auto& body = bodies[b];
        outfile << iteration << ","
                << b << ","
                << body.name << ","
                << body.mass << ","
                << body.radius << ","
                << body.position.x << ","
                << body.position.y << ","
                << body.position.z << ","
                << body.velocity.x << ","
                << body.velocity.y << ","
                << body.velocity.z << ","
                << (body.active ? 1 : 0) << ","
                << body.kinetic_energy() << ","
                << energy.total << ","
                << energy.relative_error
                << std::endl;
    }
    outfile.close();
}

// Enhanced simulation with improved numerical methods
void run_simulation_threaded(std::vector<Body> bodies, int iterations) {
    auto start_time = std::chrono::high_resolution_clock::now();
    current_bodies = bodies;
    
    // Calculate initial energy for monitoring
    initial_energy = calculate_system_energy(bodies);
    
    int iteration = 0;
    double adaptive_dt = TIME_STEP;
    int collision_count = 0;
    
    std::cout << "Starting simulation with " << bodies.size() << " bodies" << std::endl;
    std::cout << "Initial total energy: " << initial_energy.total << " J" << std::endl;
    
    while (simulation_running && iteration < iterations) {
        // Calculate adaptive time step
        adaptive_dt = calculate_adaptive_timestep(bodies, TIME_STEP);
        
        // Calculate acceleration for all bodies
        for (auto& body : bodies) {
            if (!body.active) continue;
            
            body.acceleration = Vector3(0, 0, 0);
            for (const auto& other : bodies) {
                if (!other.active) continue;
                Vector3 force = body.calculate_force_from(other);
                body.acceleration += force / body.mass;
            }
        }
        
        // Check for collisions if enabled
        if (config.enable_collision_detection) {
            for (size_t i = 0; i < bodies.size(); ++i) {
                if (!bodies[i].active) continue;
                for (size_t j = i + 1; j < bodies.size(); ++j) {
                    if (!bodies[j].active) continue;
                    if (bodies[i].check_collision(bodies[j])) {
                        handle_collision(bodies[i], bodies[j]);
                        collision_count++;
                    }
                }
            }
        }
        
        // Update positions using Verlet integration
        for (auto& body : bodies) {
            body.verlet_update(adaptive_dt);
        }
        
        // Monitor energy conservation
        if (config.enable_energy_monitoring && iteration % 100 == 0) {
            current_energy = calculate_system_energy(bodies);
            current_energy.relative_error = std::abs(current_energy.total - initial_energy.total) / std::abs(initial_energy.total);
            
            if (current_energy.relative_error > config.energy_tolerance) {
                std::cout << "Warning: Energy error exceeds tolerance at iteration " << iteration 
                         << " (error: " << current_energy.relative_error * 100 << "%)" << std::endl;
            }
        }
        
        // Update shared data structure for visualization
        if (iteration % 1 == 0) {  // Update every iteration for smooth visualization
            {
                std::lock_guard<std::mutex> lock(data_mutex);
                current_bodies = bodies;
            }
            data_cv.notify_one();
            
            save_realtime_data(bodies, current_energy, iteration);
        }

        // Print progress with more information
        if (iteration % 100 == 0) {
            int active_bodies = std::count_if(bodies.begin(), bodies.end(), 
                                            [](const Body& b) { return b.active; });
            std::cout << "Iteration " << iteration 
                     << " | Time: " << iteration * adaptive_dt / 86400.0 << " days"
                     << " | Active bodies: " << active_bodies
                     << " | Collisions: " << collision_count
                     << " | dt: " << adaptive_dt / 86400.0 << " days"
                     << " | Energy error: " << current_energy.relative_error * 100 << "%   \r";
            std::cout.flush();
        }
        
        // Adaptive sleep based on computational load
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
        
        iteration++;
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
    
    std::cout << std::endl << "Simulation completed in " << duration << " ms" << std::endl;
    std::cout << "Total collisions: " << collision_count << std::endl;
    std::cout << "Final energy error: " << current_energy.relative_error * 100 << "%" << std::endl;
}

// Enhanced system state display
void display_system_state(const std::vector<Body>& bodies) {
    std::cout << std::setw(12) << "Name" 
              << std::setw(15) << "Mass (kg)" 
              << std::setw(15) << "Position (x)" 
              << std::setw(15) << "Position (y)" 
              << std::setw(15) << "Position (z)" 
              << std::setw(15) << "Velocity (m/s)"
              << std::setw(10) << "Active" << std::endl;
    
    std::cout << std::string(105, '-') << std::endl;
    
    for (const auto& body : bodies) {
        double vel_mag = body.velocity.magnitude();
        std::cout << std::setw(12) << body.name
                  << std::setw(15) << std::scientific << std::setprecision(2) << body.mass
                  << std::setw(15) << std::scientific << std::setprecision(2) << body.position.x
                  << std::setw(15) << std::scientific << std::setprecision(2) << body.position.y
                  << std::setw(15) << std::scientific << std::setprecision(2) << body.position.z
                  << std::setw(15) << std::scientific << std::setprecision(2) << vel_mag
                  << std::setw(10) << (body.active ? "Yes" : "No") << std::endl;
    }
}

// Enhanced launch function with better error handling
#ifdef _WIN32
void launch_visualization() {
    STARTUPINFO si;
    PROCESS_INFORMATION pi;

    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    std::vector<std::string> commands = {
        "python realtime_visualize.py",
        "python3 realtime_visualize.py",
        "py realtime_visualize.py"
    };
    
    for (const auto& cmd : commands) {
        if (CreateProcess(NULL, const_cast<LPSTR>(cmd.c_str()), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            std::cout << "Visualization started successfully!" << std::endl;
            return;
        }
    }
    
    std::cout << "Could not auto-launch visualization. Please run 'python realtime_visualize.py' manually." << std::endl;
}
#else
void launch_visualization() {
    std::vector<std::string> commands = {
        "python realtime_visualize.py &",
        "python3 realtime_visualize.py &"
    };
    
    for (const auto& cmd : commands) {
        if (system(cmd.c_str()) == 0) {
            std::cout << "Visualization started successfully!" << std::endl;
            return;
        }
    }
    
    std::cout << "Could not auto-launch visualization. Please run 'python realtime_visualize.py' manually." << std::endl;
}
#endif

int main() {
    int choice;
    std::cout << "Enhanced N-Body Simulation" << std::endl;
    std::cout << "===========================" << std::endl;
    std::cout << "1. Solar System Simulation" << std::endl;
    std::cout << "2. Random Bodies Simulation" << std::endl;
    std::cout << "3. Configuration Options" << std::endl;
    std::cout << "Enter your choice (1-3): ";
    std::cin >> choice;

    if (choice == 3) {
        // Configuration menu
        std::cout << "\nSimulation Configuration:" << std::endl;
        std::cout << "1. Adaptive timestep: " << (config.use_adaptive_timestep ? "ON" : "OFF") << std::endl;
        std::cout << "2. Collision detection: " << (config.enable_collision_detection ? "ON" : "OFF") << std::endl;
        std::cout << "3. Energy monitoring: " << (config.enable_energy_monitoring ? "ON" : "OFF") << std::endl;
        
        char toggle;
        std::cout << "Toggle adaptive timestep? (y/n): ";
        std::cin >> toggle;
        if (toggle == 'y') config.use_adaptive_timestep = !config.use_adaptive_timestep;
        
        std::cout << "Toggle collision detection? (y/n): ";
        std::cin >> toggle;
        if (toggle == 'y') config.enable_collision_detection = !config.enable_collision_detection;
        
        std::cout << "Toggle energy monitoring? (y/n): ";
        std::cin >> toggle;
        if (toggle == 'y') config.enable_energy_monitoring = !config.enable_energy_monitoring;
        
        std::cout << "Choose simulation type (1-2): ";
        std::cin >> choice;
    }

    std::vector<Body> bodies;

    if (choice == 1) {
        TIME_STEP = 86400.0; // 1 day per step
        bodies = create_solar_system();
        std::cout << "Starting Enhanced Solar System simulation with " << bodies.size() << " bodies." << std::endl;
    } else {
        int num_bodies;
        std::cout << "Enter number of bodies: ";
        std::cin >> num_bodies;
        
        bodies = generate_random_bodies(num_bodies, 1.0e11, 1.0e30);
        std::cout << "Generated " << bodies.size() << " random bodies." << std::endl;
    }
    
    std::cout << "\nConfiguration Summary:" << std::endl;
    std::cout << "- Adaptive timestep: " << (config.use_adaptive_timestep ? "ON" : "OFF") << std::endl;
    std::cout << "- Collision detection: " << (config.enable_collision_detection ? "ON" : "OFF") << std::endl;
    std::cout << "- Energy monitoring: " << (config.enable_energy_monitoring ? "ON" : "OFF") << std::endl;
    std::cout << "- Base time step: " << TIME_STEP << " seconds" << std::endl;
    
    std::cout << "\nInitial state:" << std::endl;
    display_system_state(bodies);
    
    std::cout << "\nLaunching enhanced visualization..." << std::endl;
    launch_visualization();
    
    // Start simulation in a separate thread
    std::thread sim_thread(run_simulation_threaded, bodies, NUM_ITERATIONS);
    
    std::cout << "Enhanced simulation running... Press Enter to stop" << std::endl;
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cin.get();
    
    // Signal the simulation to stop
    simulation_running = false;
    
    // Wait for simulation thread to finish
    if (sim_thread.joinable()) {
        sim_thread.join();
    }
    
    std::cout << "\nFinal state:" << std::endl;
    {
        std::lock_guard<std::mutex> lock(data_mutex);
        display_system_state(current_bodies);
    }
    
    return 0;
}
