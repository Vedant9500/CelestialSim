class PhysicsEngine {
    constructor() {
        this.gravitationalConstant = 100.0;
        this.softeningParameter = 20.0;
        this.collisionThreshold = 15.0;
        this.collisionEnabled = true;
        this.timeScale = 1.0;
        this.integrationMethod = 'rk4'; // 'verlet', 'euler', 'rk4'
        this.forceCalculationMethod = 'barnes-hut'; // 'naive' or 'barnes-hut'
        
        // Time accumulator for consistent physics
        this.timeAccumulator = 0.0;
        this.fixedTimeStep = 1.0 / 60.0; // 60 FPS physics
        this.adaptiveTimeStep = false;
        this.maxTimeStep = 1.0 / 30.0;
        this.minTimeStep = 1.0 / 240.0;
        
        // Energy tracking
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        this.totalEnergy = 0;
        this.energyHistory = [];
        this.maxEnergyHistory = 1000;
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.physicsTime = 0;
        this.forceCalculationTime = 0;
        this.integrationTime = 0;
        
        // Initialize advanced components
        this.integrator = new Integrator();
        this.barnesHut = null;
        this.barnesHutTheta = 0.5; // Barnes-Hut approximation parameter
        
        // Double precision support
        this.useDoublePrecision = false;
        
        console.log('PhysicsEngine initialized with advanced features');
    }

    // Main physics update loop
    update(bodies, deltaTime) {
        const startTime = performance.now();
        
        // Add scaled time to accumulator
        this.timeAccumulator += deltaTime * this.timeScale;
        
        // Reset energy calculations
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        
        // Determine timestep (adaptive or fixed)
        let currentTimeStep = this.fixedTimeStep;
        if (this.adaptiveTimeStep && bodies.length > 0) {
            currentTimeStep = this.calculateAdaptiveTimeStep(bodies);
        }
        
        // Run physics in timesteps while we have accumulated enough time
        while (this.timeAccumulator >= currentTimeStep) {
            const forceStart = performance.now();
            
            // Calculate forces using selected method
            if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > 3) {
                this.calculateForcesBarnesHut(bodies);
            } else {
                this.calculateForcesNaive(bodies);
            }
            
            this.forceCalculationTime = performance.now() - forceStart;
            
            const integrationStart = performance.now();
            
            // Update positions and velocities with selected integrator
            if (this.integrationMethod === 'rk4') {
                this.integrator.integrateRK4(bodies, currentTimeStep, (bodies) => {
                    if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > 3) {
                        this.calculateForcesBarnesHut(bodies);
                    } else {
                        this.calculateForcesNaive(bodies);
                    }
                });
            } else {
                this.updateBodies(bodies, currentTimeStep);
            }
            
            this.integrationTime = performance.now() - integrationStart;
            
            // Handle collisions
            if (this.collisionEnabled) {
                this.handleCollisions(bodies);
            }
            
            // Subtract the timestep from accumulator
            this.timeAccumulator -= currentTimeStep;
        }
        
        // Calculate total energy
        this.calculateTotalEnergy(bodies);
        
        // Update energy history
        this.updateEnergyHistory();
        
        this.physicsTime = performance.now() - startTime;
        
        return bodies;
    }

    // Calculate gravitational forces between all bodies
    calculateForces(bodies) {
        // Reset forces
        bodies.forEach(body => body.resetForce());
        
        // Use O(n²) force calculation
        this.calculateForcesNaive(bodies);
    }

    // O(n²) naive force calculation
    calculateForcesNaive(bodies) {
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const body1 = bodies[i];
                const body2 = bodies[j];
                
                const force = body1.calculateGravitationalForce(
                    body2, 
                    this.gravitationalConstant, 
                    this.softeningParameter
                );
                
                body1.applyForce(force);
                body2.applyForce(force.multiply(-1)); // Newton's third law
                
                // Calculate potential energy for this pair
                const distance = body1.position.distance(body2.position);
                const safeDist = Math.max(distance, this.softeningParameter);
                const potentialEnergy = -this.gravitationalConstant * body1.mass * body2.mass / safeDist;
                
                body1.potentialEnergy += potentialEnergy / 2;
                body2.potentialEnergy += potentialEnergy / 2;
            }
        }
    }

    // Barnes-Hut O(N log N) force calculation
    calculateForcesBarnesHut(bodies) {
        // Reset forces
        bodies.forEach(body => {
            body.resetForce();
            body.potentialEnergy = 0;
        });
        
        // Build quadtree
        const bounds = this.calculateBounds(bodies);
        this.barnesHut = new QuadTree(bounds, 1);
        
        // Insert all bodies
        bodies.forEach(body => this.barnesHut.insert(body));
        
        // Calculate forces for each body
        bodies.forEach(body => {
            this.barnesHut.calculateForce(body, this.gravitationalConstant, this.softeningParameter, this.barnesHutTheta);
        });
    }
    
    // Calculate bounding box for all bodies
    calculateBounds(bodies) {
        if (bodies.length === 0) {
            return { x: -1000, y: -1000, width: 2000, height: 2000 };
        }
        
        let minX = bodies[0].position.x;
        let maxX = bodies[0].position.x;
        let minY = bodies[0].position.y;
        let maxY = bodies[0].position.y;
        
        bodies.forEach(body => {
            minX = Math.min(minX, body.position.x);
            maxX = Math.max(maxX, body.position.x);
            minY = Math.min(minY, body.position.y);
            maxY = Math.max(maxY, body.position.y);
        });
        
        // Add padding
        const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
        return {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + 2 * padding,
            height: (maxY - minY) + 2 * padding
        };
    }
    
    // Calculate adaptive timestep based on system dynamics
    calculateAdaptiveTimeStep(bodies) {
        let maxAcceleration = 0;
        
        bodies.forEach(body => {
            const acceleration = body.force.magnitude() / body.mass;
            maxAcceleration = Math.max(maxAcceleration, acceleration);
        });
        
        if (maxAcceleration === 0) {
            return this.fixedTimeStep;
        }
        
        // Calculate timestep based on acceleration
        const adaptiveStep = Math.sqrt(this.softeningParameter / maxAcceleration) * 0.1;
        
        // Clamp to reasonable bounds
        return Math.max(this.minTimeStep, Math.min(this.maxTimeStep, adaptiveStep));
    }

    // Update body positions using selected integration method
    updateBodies(bodies, deltaTime) {
        bodies.forEach(body => {
            if (this.integrationMethod === 'verlet') {
                body.update(deltaTime);
            } else {
                body.updateEuler(deltaTime);
            }
            
            this.totalKineticEnergy += body.kineticEnergy;
        });
    }

    // Handle collisions between bodies
    handleCollisions(bodies) {
        const bodiesToRemove = new Set();
        const bodiesToAdd = [];
        
        for (let i = 0; i < bodies.length; i++) {
            if (bodiesToRemove.has(i)) continue;
            
            for (let j = i + 1; j < bodies.length; j++) {
                if (bodiesToRemove.has(j)) continue;
                
                const body1 = bodies[i];
                const body2 = bodies[j];
                
                if (body1.wouldCollideWith(body2, this.collisionThreshold)) {
                    // Create merged body
                    const merged = Body.merge(body1, body2);
                    bodiesToAdd.push(merged);
                    
                    // Mark original bodies for removal
                    bodiesToRemove.add(i);
                    bodiesToRemove.add(j);
                    
                    break; // Body1 can only collide with one body per frame
                }
            }
        }
        
        // Remove collided bodies (in reverse order to maintain indices)
        const indicesToRemove = Array.from(bodiesToRemove).sort((a, b) => b - a);
        indicesToRemove.forEach(index => bodies.splice(index, 1));
        
        // Add merged bodies
        bodies.push(...bodiesToAdd);
    }

    // Calculate total system energy
    calculateTotalEnergy(bodies) {
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        
        // Calculate kinetic energy
        bodies.forEach(body => {
            const kineticEnergy = 0.5 * body.mass * body.velocity.magnitudeSquared();
            this.totalKineticEnergy += kineticEnergy;
            body.kineticEnergy = kineticEnergy;
        });
        
        // Calculate potential energy
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const body1 = bodies[i];
                const body2 = bodies[j];
                const distance = body1.position.distance(body2.position);
                const safeDist = Math.max(distance, this.softeningParameter);
                
                const potentialEnergy = -this.gravitationalConstant * body1.mass * body2.mass / safeDist;
                this.totalPotentialEnergy += potentialEnergy;
            }
        }
        
        this.totalEnergy = this.totalKineticEnergy + this.totalPotentialEnergy;
    }

    // Get center of mass
    getCenterOfMass(bodies) {
        if (bodies.length === 0) return new Vector2D(0, 0);
        
        let totalMass = 0;
        let centerOfMass = new Vector2D(0, 0);
        
        bodies.forEach(body => {
            centerOfMass.addMut(body.position.multiply(body.mass));
            totalMass += body.mass;
        });
        
        return centerOfMass.divide(totalMass);
    }

    // Get total momentum
    getTotalMomentum(bodies) {
        let totalMomentum = new Vector2D(0, 0);
        bodies.forEach(body => {
            totalMomentum.addMut(body.getMomentum());
        });
        return totalMomentum;
    }

    // Get total angular momentum about center of mass
    getTotalAngularMomentum(bodies) {
        const centerOfMass = this.getCenterOfMass(bodies);
        let totalAngularMomentum = 0;
        
        bodies.forEach(body => {
            const relativePosition = body.position.subtract(centerOfMass);
            const relativeVelocity = body.velocity;
            totalAngularMomentum += body.mass * relativePosition.cross(relativeVelocity);
        });
        
        return totalAngularMomentum;
    }

    // Apply external forces (e.g., drag, external fields)
    applyExternalForces(bodies, forces) {
        bodies.forEach((body, index) => {
            if (forces[index]) {
                body.applyForce(forces[index]);
            }
        });
    }

    // Stabilize system by removing center of mass velocity
    stabilizeSystem(bodies) {
        const totalMomentum = this.getTotalMomentum(bodies);
        const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
        
        if (totalMass > 0) {
            const averageVelocity = totalMomentum.divide(totalMass);
            bodies.forEach(body => {
                body.velocity.subtractMut(averageVelocity);
            });
        }
    }

    // Reset all bodies to stationary state
    resetBodies(bodies) {
        bodies.forEach(body => {
            body.stop();
            body.clearTrail();
            body.resetForce();
        });
    }

    // Time reversal (reverse all velocities)
    reverseTime(bodies) {
        bodies.forEach(body => {
            body.velocity.multiplyMut(-1);
        });
    }

    // Scale velocities (useful for energy adjustments)
    scaleVelocities(bodies, scale) {
        bodies.forEach(body => {
            body.velocity.multiplyMut(scale);
        });
    }

    // Get system statistics
    getSystemStats(bodies) {
        const centerOfMass = this.getCenterOfMass(bodies);
        const totalMomentum = this.getTotalMomentum(bodies);
        const totalAngularMomentum = this.getTotalAngularMomentum(bodies);
        
        return {
            bodyCount: bodies.length,
            totalMass: bodies.reduce((sum, body) => sum + body.mass, 0),
            centerOfMass: centerOfMass,
            totalMomentum: totalMomentum,
            totalAngularMomentum: totalAngularMomentum,
            kineticEnergy: this.totalKineticEnergy,
            potentialEnergy: this.totalPotentialEnergy,
            totalEnergy: this.totalEnergy,
            momentumMagnitude: totalMomentum.magnitude(),
            averageSpeed: bodies.length > 0 ? 
                bodies.reduce((sum, body) => sum + body.velocity.magnitude(), 0) / bodies.length : 0
        };
    }

    // Get performance statistics
    getPerformanceStats() {
        return {
            physicsTime: this.physicsTime,
            forceCalculationTime: this.forceCalculationTime,
            integrationTime: this.integrationTime,
            method: this.integrationMethod,
            forceMethod: this.forceCalculationMethod,
            adaptiveTimeStep: this.adaptiveTimeStep,
            currentTimeStep: this.adaptiveTimeStep ? this.calculateAdaptiveTimeStep([]) : this.fixedTimeStep
        };
    }
    
    // Get energy statistics
    getEnergyStats() {
        return {
            kinetic: this.totalKineticEnergy,
            potential: this.totalPotentialEnergy,
            total: this.totalEnergy,
            history: this.energyHistory.slice(-100) // Last 100 entries
        };
    }
    
    // Set physics configuration
    setConfiguration(config) {
        if (config.integrationMethod !== undefined) {
            this.integrationMethod = config.integrationMethod;
            console.log('Integration method changed to:', this.integrationMethod);
        }
        
        if (config.forceCalculationMethod !== undefined) {
            this.forceCalculationMethod = config.forceCalculationMethod;
            console.log('Force calculation method changed to:', this.forceCalculationMethod);
        }
        
        if (config.adaptiveTimeStep !== undefined) {
            this.adaptiveTimeStep = config.adaptiveTimeStep;
            console.log('Adaptive timestep:', this.adaptiveTimeStep ? 'enabled' : 'disabled');
        }
        
        if (config.barnesHutTheta !== undefined) {
            this.barnesHutTheta = config.barnesHutTheta;
            console.log('Barnes-Hut theta changed to:', this.barnesHutTheta);
        }
        
        if (config.useDoublePrecision !== undefined) {
            this.useDoublePrecision = config.useDoublePrecision;
            console.log('Double precision:', this.useDoublePrecision ? 'enabled' : 'disabled');
        }
    }

    // Configuration setters
    setCollisionEnabled(enabled) {
        this.collisionEnabled = enabled;
        console.log('Collisions:', enabled ? 'enabled' : 'disabled');
    }
    
    setGravitationalConstant(value) {
        this.gravitationalConstant = value;
        console.log('Gravitational constant changed to:', value);
    }
    
    setTimeScale(value) {
        this.timeScale = value;
        console.log('Time scale changed to:', value);
    }

    // Update energy history for tracking
    updateEnergyHistory() {
        this.energyHistory.push({
            time: Date.now(),
            kinetic: this.totalKineticEnergy,
            potential: this.totalPotentialEnergy,
            total: this.totalEnergy
        });
        
        // Keep history size manageable
        if (this.energyHistory.length > this.maxEnergyHistory) {
            this.energyHistory.shift();
        }
    }
}