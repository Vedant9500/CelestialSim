class PhysicsEngine {
    constructor() {
        this.gravitationalConstant = PHYSICS_CONSTANTS.GRAVITATIONAL_CONSTANT;
        this.softeningParameter = PHYSICS_CONSTANTS.SOFTENING_PARAMETER;
        this.collisionThreshold = PHYSICS_CONSTANTS.COLLISION_THRESHOLD;
        this.collisionEnabled = true;
        this.collisionType = PHYSICS_CONSTANTS.COLLISION_TYPE.INELASTIC; // Default to current behavior
        this.restitutionCoefficient = PHYSICS_CONSTANTS.RESTITUTION_COEFFICIENT;
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

    // Utility function to validate and sanitize numerical values
    validateNumber(value, fallback = 0, name = 'unknown') {
        if (isNaN(value) || !isFinite(value)) {
            console.warn(`Physics: Invalid number detected for ${name}: ${value}, using fallback: ${fallback}`);
            return fallback;
        }
        return value;
    }

    // Validate body state for numerical stability
    validateBodyState(body) {
        body.position.x = this.validateNumber(body.position.x, 0, `body ${body.id} position.x`);
        body.position.y = this.validateNumber(body.position.y, 0, `body ${body.id} position.y`);
        body.velocity.x = this.validateNumber(body.velocity.x, 0, `body ${body.id} velocity.x`);
        body.velocity.y = this.validateNumber(body.velocity.y, 0, `body ${body.id} velocity.y`);
        body.force.x = this.validateNumber(body.force.x, 0, `body ${body.id} force.x`);
        body.force.y = this.validateNumber(body.force.y, 0, `body ${body.id} force.y`);
        body.mass = this.validateNumber(body.mass, 1, `body ${body.id} mass`);
        
        // Ensure mass is always positive
        if (body.mass <= 0) {
            console.warn(`Physics: Non-positive mass detected for body ${body.id}: ${body.mass}, setting to 1`);
            body.mass = 1;
        }
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
        
        // Reset collision flags for the new frame
        bodies.forEach(body => {
            body.hasCollidedThisFrame = false;
            // Validate body state for numerical stability
            this.validateBodyState(body);
        });
        
        this.timeAccumulator += deltaTime * this.timeScale;
        
        this.totalKineticEnergy = 0;
        this.totalPotentialEnergy = 0;
        
        // Determine timestep (adaptive or fixed)
        let currentTimeStep = this.fixedTimeStep;
        if (this.adaptiveTimeStep && bodies.length > 0) {
            currentTimeStep = this.calculateAdaptiveTimeStep(bodies);
        }
        
        // Run physics in timesteps while we have accumulated enough time
        let totalForceTime = 0;
        let totalIntegrationTime = 0;
        let stepsExecuted = 0;
        
        while (this.timeAccumulator >= currentTimeStep) {
            const forceStart = performance.now();
            if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > PHYSICS_CONSTANTS.BARNES_HUT_MAX_BODIES_THRESHOLD) {
                this.calculateForcesBarnesHut(bodies);
            } else {
                this.calculateForcesNaive(bodies);
            }
            
            totalForceTime += performance.now() - forceStart;
            
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
            
            totalIntegrationTime += performance.now() - integrationStart;
            
            // Handle collisions
            if (this.collisionEnabled) {
                this.handleCollisions(bodies);
            }
            
            // Subtract the timestep from accumulator
            this.timeAccumulator -= currentTimeStep;
            this.simulationTime += currentTimeStep;
            stepsExecuted++;
        }
        
        // Update timing statistics (average if multiple steps were executed)
        if (stepsExecuted > 0) {
            this.forceCalculationTime = totalForceTime / stepsExecuted;
            this.integrationTime = totalIntegrationTime / stepsExecuted;
        } else {
            // If no physics steps were executed this frame, keep previous values
            // but decay them slightly to indicate low activity
            this.forceCalculationTime = Math.max(0, this.forceCalculationTime * 0.9);
            this.integrationTime = Math.max(0, this.integrationTime * 0.9);
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
                
                // Calculate potential energy for this pair (use same softening as force)
                const dx = body1.position.x - body2.position.x;
                const dy = body1.position.y - body2.position.y;
                const distanceSquared = dx * dx + dy * dy;
                const softenedDistanceSquared = distanceSquared + this.softeningParameter * this.softeningParameter;
                const distance = Math.sqrt(softenedDistanceSquared);
                const potentialEnergy = -this.gravitationalConstant * body1.mass * body2.mass / distance;
                
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

    // Handle collisions between bodies (optimized)
    handleCollisions(bodies) {
        if (this.collisionType === PHYSICS_CONSTANTS.COLLISION_TYPE.ELASTIC) {
            this.handleElasticCollisions(bodies);
            // Apply velocity limiting after elastic collisions to prevent explosive behavior
            this.limitVelocities(bodies);
        } else {
            this.handleInelasticCollisions(bodies);
        }
    }

    // Limit velocities to prevent numerical instability
    limitVelocities(bodies) {
        const maxVelocity = PHYSICS_CONSTANTS.MAX_VELOCITY_LIMIT;
        bodies.forEach(body => {
            const velocityMagnitude = body.velocity.magnitude();
            if (velocityMagnitude > maxVelocity) {
                // Scale velocity down to maximum
                const scale = maxVelocity / velocityMagnitude;
                body.velocity.x *= scale;
                body.velocity.y *= scale;
            }
        });
    }

    // Handle elastic collisions (bodies bounce off each other)
    handleElasticCollisions(bodies) {
        // Track collision pairs this frame to prevent double processing
        const processedPairs = new Set();
        
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const body1 = bodies[i];
                const body2 = bodies[j];
                
                // Skip if this pair is already processed
                const pairKey = `${i}-${j}`;
                if (processedPairs.has(pairKey)) {
                    continue;
                }
                
                // Skip if either body is in cooldown with each other
                if (body1.isInCollisionCooldownWith(body2)) {
                    continue;
                }
                
                // Calculate center-to-center distance
                const dx = body2.position.x - body1.position.x;
                const dy = body2.position.y - body1.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Calculate collision distance (when surfaces touch)
                const collisionDistance = body1.radius + body2.radius;
                
                // Enhanced collision detection - check for fast-moving objects
                const relativeVelocity = body1.velocity.subtract(body2.velocity);
                const relativeSpeed = relativeVelocity.magnitude();
                
                // Continuous collision detection for fast objects
                let collisionTime = 0;
                let willCollide = false;
                
                if (distance > collisionDistance && relativeSpeed > 0) {
                    // Check if objects will collide this frame using swept spheres
                    const relativePosition = body2.position.subtract(body1.position);
                    const relativeVelDotPos = relativeVelocity.dot(relativePosition);
                    
                    if (relativeVelDotPos < 0) { // Objects approaching
                        const discriminant = Math.pow(relativeVelDotPos, 2) - 
                            relativeSpeed * relativeSpeed * (relativePosition.magnitudeSquared() - collisionDistance * collisionDistance);
                        
                        if (discriminant >= 0) {
                            collisionTime = (-relativeVelDotPos - Math.sqrt(discriminant)) / (relativeSpeed * relativeSpeed);
                            if (collisionTime >= 0 && collisionTime <= this.fixedTimeStep) {
                                willCollide = true;
                            }
                        }
                    }
                }
                
                // Check if collision is occurring now or will occur this frame
                if (distance <= collisionDistance || willCollide) {
                    processedPairs.add(pairKey);
                    
                    // For continuous collision, interpolate to collision point
                    if (willCollide && collisionTime > 0) {
                        // Move bodies to exact collision point
                        body1.position.x -= body1.velocity.x * collisionTime;
                        body1.position.y -= body1.velocity.y * collisionTime;
                        body2.position.x -= body2.velocity.x * collisionTime;
                        body2.position.y -= body2.velocity.y * collisionTime;
                        
                        // Recalculate distance and normal at collision point
                        const dx_collision = body2.position.x - body1.position.x;
                        const dy_collision = body2.position.y - body1.position.y;
                        const distance_collision = Math.sqrt(dx_collision * dx_collision + dy_collision * dy_collision);
                        
                        // Move bodies forward by remaining time after collision
                        const remainingTime = this.fixedTimeStep - collisionTime;
                        body1.position.x += body1.velocity.x * remainingTime;
                        body1.position.y += body1.velocity.y * remainingTime;
                        body2.position.x += body2.velocity.x * remainingTime;
                        body2.position.y += body2.velocity.y * remainingTime;
                    } else {
                        // Standard collision at current position - no additional processing needed
                    }
                    
                    // Continue with collision resolution using the calculated normal
                    // Re-calculate collision normal for consistency
                    const current_dx = body2.position.x - body1.position.x;
                    const current_dy = body2.position.y - body1.position.y;
                    const current_distance = Math.sqrt(current_dx * current_dx + current_dy * current_dy);
                    const final_nx = current_dx / Math.max(current_distance, 0.001);
                    const final_ny = current_dy / Math.max(current_distance, 0.001);
                    
                    // Calculate relative velocity
                    const dvx = body2.velocity.x - body1.velocity.x;
                    const dvy = body2.velocity.y - body1.velocity.y;
                    const dvn = dvx * final_nx + dvy * final_ny; // Relative velocity along normal
                    
                    // FIRST: Separate overlapping bodies with strong force
                    const overlap = collisionDistance - current_distance;
                    if (overlap > 0) {
                        // Strong immediate separation to prevent sticking
                        const separationMargin = Math.max(0.5, overlap * 0.1); // At least 0.5 units separation
                        const totalSeparation = overlap + separationMargin;
                        const totalMass = body1.mass + body2.mass;
                        const sep1 = totalSeparation * body2.mass / totalMass;
                        const sep2 = totalSeparation * body1.mass / totalMass;
                        
                        body1.position.x -= sep1 * final_nx;
                        body1.position.y -= sep1 * final_ny;
                        body2.position.x += sep2 * final_nx;
                        body2.position.y += sep2 * final_ny;
                        
                        // Update lastPosition for Verlet consistency
                        if (body1.lastPosition) {
                            body1.lastPosition.x -= sep1 * final_nx;
                            body1.lastPosition.y -= sep1 * final_ny;
                        }
                        if (body2.lastPosition) {
                            body2.lastPosition.x += sep2 * final_nx;
                            body2.lastPosition.y += sep2 * final_ny;
                        }
                    }
                    
                    // SECOND: Only resolve collision if objects are approaching with significant speed
                    if (dvn < -0.1) { // Increased threshold to prevent micro-collisions
                        
                        // Energy and momentum validation (debug mode)
                        const debugCollisions = false; // Set to true for debugging
                        let energyBefore, momentumBefore;
                        if (debugCollisions) {
                            energyBefore = this.calculateKineticEnergySubset([body1, body2]);
                            momentumBefore = this.calculateMomentumSubset([body1, body2]);
                        }
                        
                        // Calculate total mass for physics calculations
                        const totalMass = body1.mass + body2.mass;
                        // Calculate collision impulse using correct physics formula
                        // J = -(1 + e) * vrel_n / (1/m1 + 1/m2)
                        const impulseStrength = -(1 + this.restitutionCoefficient) * dvn / (1/body1.mass + 1/body2.mass);
                        
                        // Apply impulse correctly (F*dt = m*dv, so dv = F*dt/m)
                        body1.velocity.x -= impulseStrength * final_nx / body1.mass;
                        body1.velocity.y -= impulseStrength * final_ny / body1.mass;
                        body2.velocity.x += impulseStrength * final_nx / body2.mass;
                        body2.velocity.y += impulseStrength * final_ny / body2.mass;
                        
                        // Add tangential friction for more realistic behavior
                        const dvt_x = dvx - dvn * final_nx; // Tangential relative velocity
                        const dvt_y = dvy - dvn * final_ny;
                        const friction = PHYSICS_CONSTANTS.COLLISION_FRICTION;
                        const frictionImpulse = friction * Math.abs(impulseStrength);
                        const tangentLength = Math.sqrt(dvt_x * dvt_x + dvt_y * dvt_y);
                        
                        if (tangentLength > 0.001) {
                            const tx = dvt_x / tangentLength;
                            const ty = dvt_y / tangentLength;
                            
                            body1.velocity.x += frictionImpulse * tx * body2.mass / totalMass;
                            body1.velocity.y += frictionImpulse * ty * body2.mass / totalMass;
                            body2.velocity.x -= frictionImpulse * tx * body1.mass / totalMass;
                            body2.velocity.y -= frictionImpulse * ty * body1.mass / totalMass;
                        }
                        
                        // Set stronger collision cooldown to prevent immediate re-collision
                        const relativeSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
                        const baseCooldown = PHYSICS_CONSTANTS.COLLISION_COOLDOWN_TIME;
                        // Much longer cooldown for slow collisions to prevent sticking
                        const adaptiveCooldown = Math.max(0.2, baseCooldown + relativeSpeed * 0.02);
                        
                        body1.setCollisionCooldownWith(body2, adaptiveCooldown);
                        body2.setCollisionCooldownWith(body1, adaptiveCooldown);
                        
                        // Add small velocity bias to ensure separation
                        const separationBias = 0.5; // Small velocity push apart
                        body1.velocity.x -= separationBias * final_nx;
                        body1.velocity.y -= separationBias * final_ny;
                        body2.velocity.x += separationBias * final_nx;
                        body2.velocity.y += separationBias * final_ny;
                        
                        // Apply slight velocity damping to prevent excessive bouncing
                        const dampingFactor = 0.98;
                        body1.velocity.x *= dampingFactor;
                        body1.velocity.y *= dampingFactor;
                        body2.velocity.x *= dampingFactor;
                        body2.velocity.y *= dampingFactor;
                        
                        // Mark bodies as having collided this frame
                        body1.hasCollidedThisFrame = true;
                        body2.hasCollidedThisFrame = true;
                        
                        // Validate conservation laws (debug mode)
                        if (debugCollisions) {
                            const energyAfter = this.calculateKineticEnergySubset([body1, body2]);
                            const momentumAfter = this.calculateMomentumSubset([body1, body2]);
                            const energyLoss = energyBefore - energyAfter;
                            const momentumError = momentumBefore.subtract(momentumAfter).magnitude();
                            
                            if (Math.abs(energyLoss) > 0.01 || momentumError > 0.01) {
                                console.warn(`Collision conservation violation: Energy loss: ${energyLoss.toFixed(3)}, Momentum error: ${momentumError.toFixed(3)}`);
                            }
                        }
                    }
                }
            }
        }
    }

    // Handle inelastic collisions (bodies merge - original behavior)
    handleInelasticCollisions(bodies) {
        const bodiesToRemove = new Set();
        const bodiesToAdd = [];
        
        for (let i = 0; i < bodies.length; i++) {
            if (bodiesToRemove.has(i)) continue;
            
            for (let j = i + 1; j < bodies.length; j++) {
                if (bodiesToRemove.has(j)) continue;
                
                const body1 = bodies[i];
                const body2 = bodies[j];
                
                // Calculate distance between centers
                const dx = body1.position.x - body2.position.x;
                const dy = body1.position.y - body2.position.y;
                const centerDistance = Math.sqrt(dx * dx + dy * dy);
                
                // Check if surfaces are touching or overlapping
                const radiusSum = body1.radius + body2.radius;
                
                if (centerDistance <= radiusSum) {
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
        indicesToRemove.forEach(index => {
            const removedBody = bodies[index];
            // Clean up collision cooldowns for remaining bodies
            bodies.forEach(body => {
                if (body !== removedBody) {
                    body.collisionCooldowns.delete(removedBody.id);
                }
            });
            bodies.splice(index, 1);
        });
        
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
                
                // Use same distance calculation as force computation for consistency
                const dx = body1.position.x - body2.position.x;
                const dy = body1.position.y - body2.position.y;
                const distanceSquared = dx * dx + dy * dy;
                const softenedDistanceSquared = distanceSquared + this.softeningParameter * this.softeningParameter;
                const distance = Math.sqrt(softenedDistanceSquared);
                
                // Calculate gravitational potential energy: U = -G*m1*m2/r
                const potentialEnergy = -this.gravitationalConstant * body1.mass * body2.mass / distance;
                
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
    
    setCollisionType(type) {
        this.collisionType = type;
    }
    
    setRestitutionCoefficient(coefficient) {
        // Clamp to safe range and prevent changes during active collisions
        this.restitutionCoefficient = Math.max(
            PHYSICS_CONSTANTS.MIN_RESTITUTION, 
            Math.min(PHYSICS_CONSTANTS.MAX_RESTITUTION, coefficient)
        );
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

    // Calculate kinetic energy for a subset of bodies (for collision validation)
    calculateKineticEnergySubset(bodies) {
        return bodies.reduce((total, body) => {
            return total + 0.5 * body.mass * body.velocity.magnitudeSquared();
        }, 0);
    }

    // Calculate momentum for a subset of bodies (for collision validation)
    calculateMomentumSubset(bodies) {
        return bodies.reduce((momentum, body) => {
            return momentum.add(body.velocity.multiply(body.mass));
        }, new Vector2D(0, 0));
    }
}