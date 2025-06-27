class PhysicsEngine {
    constructor() {
        this.gravitationalConstant = PHYSICS_CONSTANTS.GRAVITATIONAL_CONSTANT;
        this.softeningParameter = PHYSICS_CONSTANTS.SOFTENING_PARAMETER;
        this.collisionThreshold = PHYSICS_CONSTANTS.COLLISION_THRESHOLD;
        this.collisionEnabled = true;
        this.timeScale = 1.0;
        this.integrationMethod = 'verlet'; // 'verlet', 'euler', 'rk4' - Verlet is more stable for runtime additions
        this.forceCalculationMethod = 'barnes-hut'; // 'naive' or 'barnes-hut'
        
        // Time accumulator for consistent physics
        this.timeAccumulator = 0.0;
        this.fixedTimeStep = PHYSICS_CONSTANTS.FIXED_TIME_STEP;
        this.adaptiveTimeStep = false;
        this.maxTimeStep = PHYSICS_CONSTANTS.MAX_TIME_STEP;
        this.minTimeStep = PHYSICS_CONSTANTS.MIN_TIME_STEP;
        
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
        this.barnesHutTheta = PHYSICS_CONSTANTS.BARNES_HUT_THETA;
        
        // Double precision support
        this.useDoublePrecision = false;
        
        // Simulation state tracking
        this.simulationTime = 0;
        this.currentBodyCount = 0;
    }

    update(bodies, deltaTime) {
        const startTime = performance.now();
        
        // Validate input parameters
        if (!bodies || !Array.isArray(bodies)) {
            console.error('PhysicsEngine.update: Invalid bodies array provided');
            return bodies || [];
        }
        
        if (typeof deltaTime !== 'number' || deltaTime <= 0 || !isFinite(deltaTime)) {
            console.warn('PhysicsEngine.update: Invalid deltaTime, using default');
            deltaTime = this.fixedTimeStep;
        }
        
        this.currentBodyCount = bodies.length;
        
        this.timeAccumulator += deltaTime * this.timeScale;
        
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
            if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > PHYSICS_CONSTANTS.BARNES_HUT_MAX_BODIES_THRESHOLD) {
                this.calculateForcesBarnesHut(bodies);
            } else {
                this.calculateForcesNaive(bodies);
            }
            
            this.forceCalculationTime = performance.now() - forceStart;
            
            const integrationStart = performance.now();
            
            if (this.integrationMethod === 'rk4') {
                this.integrator.integrateRK4(bodies, currentTimeStep, (bodies) => {
                    if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > 5) {
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
            this.simulationTime += currentTimeStep;
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

    // Calculate total system energy with improved accuracy
    calculateTotalEnergy(bodies) {
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        
        // Calculate kinetic energy with higher precision
        bodies.forEach(body => {
            const velocityMagnitudeSquared = body.velocity.magnitudeSquared();
            const kineticEnergy = 0.5 * body.mass * velocityMagnitudeSquared;
            this.totalKineticEnergy += kineticEnergy;
            body.kineticEnergy = kineticEnergy;
        });
        
        // Calculate potential energy with improved precision
        // Use Kahan summation for better numerical accuracy
        let potentialSum = 0;
        let compensationError = 0;
        
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const body1 = bodies[i];
                const body2 = bodies[j];
                
                // Use high precision distance calculation
                const dx = body1.position.x - body2.position.x;
                const dy = body1.position.y - body2.position.y;
                const distanceSquared = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSquared);
                
                // Avoid division by zero without affecting energy conservation
                const safeDist = Math.max(distance, this.softeningParameter * 0.01);
                
                // Calculate gravitational potential energy: U = -G*m1*m2/r
                const potentialEnergy = -this.gravitationalConstant * body1.mass * body2.mass / safeDist;
                
                // Kahan summation for improved numerical precision
                const adjustedValue = potentialEnergy - compensationError;
                const temporarySum = potentialSum + adjustedValue;
                compensationError = (temporarySum - potentialSum) - adjustedValue;
                potentialSum = temporarySum;
            }
        }
        
        this.totalPotentialEnergy = potentialSum;
        this.totalEnergy = this.totalKineticEnergy + this.totalPotentialEnergy;
    }

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
    
    // Get comprehensive energy statistics
    getEnergyStats() {
        const currentTime = Date.now();
        
        // Calculate energy conservation metrics
        let energyDrift = 0;
        let energyConservationRatio = 1.0;
        
        if (this.energyHistory.length > 1) {
            const initialEnergy = this.energyHistory[0].total;
            const currentEnergy = this.totalEnergy;
            
            if (Math.abs(initialEnergy) > 1e-10) {
                energyDrift = currentEnergy - initialEnergy;
                energyConservationRatio = currentEnergy / initialEnergy;
            }
        }
        
        // Calculate energy rates (if we have enough history)
        let kineticEnergyRate = 0;
        let potentialEnergyRate = 0;
        
        if (this.energyHistory.length >= 2) {
            const recent = this.energyHistory[this.energyHistory.length - 1];
            const previous = this.energyHistory[this.energyHistory.length - 2];
            const timeDelta = (recent.time - previous.time) / 1000; // seconds
            
            if (timeDelta > 0) {
                kineticEnergyRate = (recent.kinetic - previous.kinetic) / timeDelta;
                potentialEnergyRate = (recent.potential - previous.potential) / timeDelta;
            }
        }
        
        // Calculate system temperature (avg kinetic energy per particle)
        const totalBodies = this.currentBodyCount || 1;
        const systemTemperature = this.totalKineticEnergy / totalBodies;
        
        return {
            kinetic: this.totalKineticEnergy,
            potential: this.totalPotentialEnergy,
            total: this.totalEnergy,
            history: this.energyHistory.slice(-100), // Last 100 entries
            
            // Conservation metrics
            energyDrift: energyDrift,
            conservationRatio: energyConservationRatio,
            conservationError: Math.abs(1.0 - energyConservationRatio),
            
            // Energy rates
            kineticRate: kineticEnergyRate,
            potentialRate: potentialEnergyRate,
            
            // System properties
            systemTemperature: systemTemperature,
            specificEnergy: totalBodies > 0 ? this.totalEnergy / totalBodies : 0,
            
            // Ratios for analysis
            kineticRatio: this.totalEnergy !== 0 ? this.totalKineticEnergy / Math.abs(this.totalEnergy) : 0,
            potentialRatio: this.totalEnergy !== 0 ? this.totalPotentialEnergy / Math.abs(this.totalEnergy) : 0
        };
    }
    
    // Set physics configuration
    setConfiguration(config) {
        if (config.integrationMethod !== undefined) {
            this.integrationMethod = config.integrationMethod;
        }
        
        if (config.forceCalculationMethod !== undefined) {
            this.forceCalculationMethod = config.forceCalculationMethod;
        }
        
        if (config.adaptiveTimeStep !== undefined) {
            this.adaptiveTimeStep = config.adaptiveTimeStep;
        }
        
        if (config.barnesHutTheta !== undefined) {
            this.barnesHutTheta = config.barnesHutTheta;
        }
        
        if (config.useDoublePrecision !== undefined) {
            this.useDoublePrecision = config.useDoublePrecision;
        }
    }

    // Configuration setters
    setCollisionEnabled(enabled) {
        this.collisionEnabled = enabled;
    }
    
    setGravitationalConstant(value) {
        this.gravitationalConstant = value;
    }
    
    setTimeScale(value) {
        this.timeScale = value;
    }

    // Update energy history for tracking with simulation time
    updateEnergyHistory() {
        const currentTime = performance.now();
        
        this.energyHistory.push({
            time: currentTime,
            simulationTime: this.simulationTime || 0,
            kinetic: this.totalKineticEnergy,
            potential: this.totalPotentialEnergy,
            total: this.totalEnergy,
            bodyCount: this.currentBodyCount || 0
        });
        
        // Keep history size manageable
        if (this.energyHistory.length > this.maxEnergyHistory) {
            this.energyHistory.shift();
        }
    }
}