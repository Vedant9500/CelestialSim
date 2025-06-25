class PhysicsEngine {
    constructor() {
        this.gravitationalConstant = 100.0;
        this.softeningParameter = 20.0;
        this.collisionThreshold = 15.0;
        this.collisionEnabled = true;
        this.timeScale = 1.0;
        this.integrationMethod = 'verlet'; // 'verlet' or 'euler'
        
        // Time accumulator for consistent physics
        this.timeAccumulator = 0.0;
        this.fixedTimeStep = 1.0 / 60.0; // 60 FPS physics
        
        // Energy tracking
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        this.totalEnergy = 0;
    }

    // Main physics update loop
    update(bodies, deltaTime) {
        // Add scaled time to accumulator
        this.timeAccumulator += deltaTime * this.timeScale;
        
        // Reset energy calculations
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        
        // Run physics in fixed timesteps while we have accumulated enough time
        while (this.timeAccumulator >= this.fixedTimeStep) {
            // Calculate forces
            this.calculateForces(bodies);
            
            // Update positions and velocities with FIXED timestep
            // This ensures gravity remains consistent regardless of time scale
            this.updateBodies(bodies, this.fixedTimeStep);
            
            // Handle collisions
            if (this.collisionEnabled) {
                this.handleCollisions(bodies);
            }
            
            // Subtract the fixed timestep from accumulator
            this.timeAccumulator -= this.fixedTimeStep;
        }
        
        // Calculate total energy
        this.calculateTotalEnergy(bodies);
        
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
        this.totalPotentialEnergy = 0;
        
        // Calculate potential energy
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const body1 = bodies[i];
                const body2 = bodies[j];
                const distance = body1.position.distance(body2.position);
                const safeDist = Math.max(distance, this.softeningParameter);
                
                this.totalPotentialEnergy -= this.gravitationalConstant * body1.mass * body2.mass / safeDist;
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

    // Set physics parameters
    setGravitationalConstant(g) {
        this.gravitationalConstant = g;
    }

    setSofteningParameter(s) {
        this.softeningParameter = s;
    }

    setCollisionThreshold(t) {
        this.collisionThreshold = t;
    }

    setTimeScale(scale) {
        this.timeScale = Math.max(0.01, Math.min(10.0, scale));
    }

    setCollisionEnabled(enabled) {
        this.collisionEnabled = enabled;
    }

    setIntegrationMethod(method) {
        this.integrationMethod = method;
    }

}