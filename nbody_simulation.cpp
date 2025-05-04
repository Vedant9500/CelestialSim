#include <iostream>
#include <vector>
#include <cmath>
#include <fstream>
#include <chrono>
#include <random>
#include <string>
#include <iomanip>

// Constants
const double G = 6.67430e-11;  // Gravitational constant (m^3 kg^-1 s^-2)
const double TIME_STEP = 0.01; // Time step for simulation (s)
const int NUM_ITERATIONS = 1000; // Number of simulation steps

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

// Solar system setup (simplified)
std::vector<Body> create_solar_system() {
    std::vector<Body> bodies;
    
    // Sun
    bodies.emplace_back(1.989e30, Vector3(0, 0, 0), Vector3(0, 0, 0), "Sun");
    
    // Mercury
    bodies.emplace_back(3.301e23, Vector3(57.9e9, 0, 0), Vector3(0, 47.4e3, 0), "Mercury");
    
    // Venus
    bodies.emplace_back(4.867e24, Vector3(108.2e9, 0, 0), Vector3(0, 35.0e3, 0), "Venus");
    
    // Earth
    bodies.emplace_back(5.972e24, Vector3(149.6e9, 0, 0), Vector3(0, 29.8e3, 0), "Earth");
    
    // Mars
    bodies.emplace_back(6.417e23, Vector3(227.9e9, 0, 0), Vector3(0, 24.1e3, 0), "Mars");
    
    // Jupiter
    bodies.emplace_back(1.898e27, Vector3(778.5e9, 0, 0), Vector3(0, 13.1e3, 0), "Jupiter");
    
    return bodies;
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
    bool save_data = true;
    int iterations = NUM_ITERATIONS;

    if (choice == 1) {
        // Solar system simulation
        bodies = create_solar_system();
        std::cout << "Starting Solar System simulation with " << bodies.size() << " bodies." << std::endl;
    } else {
        // Random bodies simulation
        int num_bodies;
        std::cout << "Enter number of bodies: ";
        std::cin >> num_bodies;
        
        bodies = generate_random_bodies(num_bodies, 1.0e11, 1.0e30);
        std::cout << "Generated " << bodies.size() << " random bodies." << std::endl;
    }
    
    std::cout << "Initial state:" << std::endl;
    display_system_state(bodies);
    
    std::cout << "Starting simulation..." << std::endl;
    run_simulation(bodies, iterations, save_data);
    
    std::cout << "Final state:" << std::endl;
    display_system_state(bodies);
    
    return 0;
}