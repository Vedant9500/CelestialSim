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
        this.forceCalculationMethod = 'barnes-hut'; // 'naive', 'barnes-hut', or 'gpu'
        
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
        this.energyCacheValid = false;
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.physicsTime = 0;
        this.forceCalculationTime = 0;
        this.integrationTime = 0;
        
        // Initialize advanced components
        this.integrator = new Integrator();
        this.barnesHut = null;
        this.optimizedBarnesHut = new OptimizedBarnesHutForceCalculator();
        this.barnesHutTheta = PHYSICS_CONSTANTS.BARNES_HUT_THETA;
        
        // GPU Physics Engine
        this.gpuPhysics = null;
        this.useGPUPhysics = false;
        this.gpuPhysicsThreshold = 50; // Use GPU for 50+ bodies
        
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
        
        // Invalidate energy cache since bodies have moved
        this.energyCacheValid = false;
        
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
            
            // Check if we should use GPU physics for this frame
            if (this.shouldUseGPUPhysics(bodies.length)) {
                // GPU physics handles entire integration step at once
                const gpuSuccess = this.gpuPhysics.update(bodies, currentTimeStep);
                if (!gpuSuccess) {
                    console.warn('GPU physics failed, falling back to CPU for this frame');
                    // Fallback to CPU physics
                    if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > PHYSICS_CONSTANTS.BARNES_HUT_MAX_BODIES_THRESHOLD) {
                        this.calculateForcesBarnesHut(bodies);
                    } else {
                        this.calculateForcesNaive(bodies);
                    }
                }
            } else {
                // Use CPU physics
                if (this.forceCalculationMethod === 'barnes-hut' && bodies.length > PHYSICS_CONSTANTS.BARNES_HUT_MAX_BODIES_THRESHOLD) {
                    this.calculateForcesBarnesHut(bodies);
                } else {
                    this.calculateForcesNaive(bodies);
                }
            }
            
            totalForceTime += performance.now() - forceStart;
            
            const integrationStart = performance.now();
            
            // Only do CPU integration if not using GPU physics
            if (!this.shouldUseGPUPhysics(bodies.length)) {
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
            }
            
            totalIntegrationTime += performance.now() - integrationStart;
            
            // Handle collisions
            if (this.collisionEnabled) {
                this.handleCollisions(bodies);
            }
            
            // Update collision cooldowns for all bodies
            bodies.forEach(body => {
                if (body.updateCollisionCooldowns) {
                    body.updateCollisionCooldowns(currentTimeStep);
                }
            });
            
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

    // Enhanced Barnes-Hut O(N log N) force calculation with optimized memory layout
    calculateForcesBarnesHut(bodies) {
        const startTime = performance.now();
        
        // Reset forces
        bodies.forEach(body => {
            body.resetForce();
            body.potentialEnergy = 0;
        });
        
        // Use optimized Barnes-Hut calculator
        this.optimizedBarnesHut.setTheta(this.barnesHutTheta);
        const forces = this.optimizedBarnesHut.calculateForces(bodies, this.gravitationalConstant, this.softeningParameter);
        
        // Apply calculated forces
        for (let i = 0; i < bodies.length; i++) {
            bodies[i].force.x += forces[i].x;
            bodies[i].force.y += forces[i].y;
        }
        
        // Track performance statistics
        this.forceCalculationTime = performance.now() - startTime;
        this.barnesHutStats = this.optimizedBarnesHut.getStats();
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

    // Enhanced elastic collision system inspired by broccoli-project
    handleElasticCollisions(bodies) {
        // Use spatial partitioning for better collision detection performance
        const spatialGrid = this.createSpatialGrid(bodies);
        const processedPairs = new Set();
        
        // Process collisions using spatial grid for efficiency
        spatialGrid.forEach(cellBodies => {
            if (cellBodies.length < 2) return;
            
            // Check all pairs within this spatial cell
            for (let i = 0; i < cellBodies.length; i++) {
                for (let j = i + 1; j < cellBodies.length; j++) {
                    const body1 = cellBodies[i];
                    const body2 = cellBodies[j];
                    
                    // Create unique pair identifier
                    const id1 = bodies.indexOf(body1);
                    const id2 = bodies.indexOf(body2);
                    const pairKey = `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
                    
                    if (processedPairs.has(pairKey)) continue;
                    processedPairs.add(pairKey);
                    
                    // Enhanced collision detection with continuous collision detection
                    if (this.detectAndResolveCollision(body1, body2)) {
                        // Apply collision cooldown to prevent jittering (time in seconds)
                        const cooldownTime = PHYSICS_CONSTANTS.COLLISION_COOLDOWN_TIME || 0.25;
                        body1.setCollisionCooldownWith(body2, cooldownTime);
                        body2.setCollisionCooldownWith(body1, cooldownTime);
                    }
                }
            }
        });
    }

    // Create spatial grid for efficient collision detection (inspired by broccoli's spatial partitioning)
    createSpatialGrid(bodies) {
        if (bodies.length === 0) return new Map();
        
        // Find simulation bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let maxRadius = 0;
        
        bodies.forEach(body => {
            minX = Math.min(minX, body.position.x - body.radius);
            maxX = Math.max(maxX, body.position.x + body.radius);
            minY = Math.min(minY, body.position.y - body.radius);
            maxY = Math.max(maxY, body.position.y + body.radius);
            maxRadius = Math.max(maxRadius, body.radius);
        });
        
        // Calculate optimal cell size (2x largest radius to handle overlaps)
        const cellSize = Math.max(maxRadius * 4, 50);
        const gridWidth = Math.ceil((maxX - minX) / cellSize);
        const gridHeight = Math.ceil((maxY - minY) / cellSize);
        
        const spatialGrid = new Map();
        
        // Place bodies in grid cells
        bodies.forEach(body => {
            const cellX = Math.floor((body.position.x - minX) / cellSize);
            const cellY = Math.floor((body.position.y - minY) / cellSize);
            
            // Add to multiple cells if body spans across cell boundaries
            const startX = Math.max(0, Math.floor((body.position.x - body.radius - minX) / cellSize));
            const endX = Math.min(gridWidth - 1, Math.floor((body.position.x + body.radius - minX) / cellSize));
            const startY = Math.max(0, Math.floor((body.position.y - body.radius - minY) / cellSize));
            const endY = Math.min(gridHeight - 1, Math.floor((body.position.y + body.radius - minY) / cellSize));
            
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const cellKey = `${x},${y}`;
                    if (!spatialGrid.has(cellKey)) {
                        spatialGrid.set(cellKey, []);
                    }
                    spatialGrid.get(cellKey).push(body);
                }
            }
        });
        
        return spatialGrid;
    }

    // Enhanced collision detection and resolution
    detectAndResolveCollision(body1, body2) {
        // Skip if bodies are in cooldown with each other
        if (body1.isInCollisionCooldownWith && body1.isInCollisionCooldownWith(body2)) {
            return false;
        }
        
        // Calculate separation vector
        const dx = body2.position.x - body1.position.x;
        const dy = body2.position.y - body1.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const collisionDistance = body1.radius + body2.radius;
        
        // Calculate relative velocity for continuous collision detection
        const relativeVx = body2.velocity.x - body1.velocity.x;
        const relativeVy = body2.velocity.y - body1.velocity.y;
        const relativeSpeed = Math.sqrt(relativeVx * relativeVx + relativeVy * relativeVy);
        
        // Debug logging for collision detection (reduced spam)
        // Uncomment for debugging: if (distance < collisionDistance * 1.2 && relativeSpeed > 5) { console.log(`Near collision: distance=${distance.toFixed(2)}, required=${collisionDistance.toFixed(2)}, speed=${relativeSpeed.toFixed(2)}`); }
        
        // Continuous collision detection for fast-moving objects
        let willCollide = false;
        let collisionTime = 0;
        
        if (distance > collisionDistance && relativeSpeed > 0.1) {
            // Simple continuous collision detection: check if bodies will pass through each other this frame
            // Calculate where each body will be next frame
            const dt = this.fixedTimeStep;
            const body1NextX = body1.position.x + body1.velocity.x * dt;
            const body1NextY = body1.position.y + body1.velocity.y * dt;
            const body2NextX = body2.position.x + body2.velocity.x * dt;
            const body2NextY = body2.position.y + body2.velocity.y * dt;
            
            const nextDx = body2NextX - body1NextX;
            const nextDy = body2NextY - body1NextY;
            const nextDistance = Math.sqrt(nextDx * nextDx + nextDy * nextDy);
            
            // If they will be overlapping next frame, collision is imminent
            if (nextDistance <= collisionDistance) {
                willCollide = true;
            }
            
            // Also check if they're on a collision course (dot product approach)
            const relativeVelDotPos = (relativeVx * dx + relativeVy * dy);
            if (relativeVelDotPos < 0) { // Objects approaching
                // Calculate closest approach distance during this frame
                const closestDistance = Math.sqrt(distance * distance - (relativeVelDotPos * relativeVelDotPos) / (relativeSpeed * relativeSpeed));
                if (closestDistance <= collisionDistance) {
                    willCollide = true;
                }
            }
        }
        
        // Check for collision
        if (distance <= collisionDistance || willCollide) {
            this.resolveElasticCollision(body1, body2, dx, dy, distance, collisionDistance);
            return true;
        }
        
        return false;
    }

    // Advanced elastic collision resolution with proper physics
    resolveElasticCollision(body1, body2, dx, dy, distance, collisionDistance) {
        // Calculate collision normal
        const normalX = distance > 0.001 ? dx / distance : 1;
        const normalY = distance > 0.001 ? dy / distance : 0;
        
        // Handle penetration with MORE aggressive separation
        const overlap = collisionDistance - distance;
        if (overlap > 0 || distance < collisionDistance * 1.2) {
            // More aggressive separation - ensure bodies are definitely apart
            const separationFactor = 2.0; // Much larger separation to prevent re-collision
            const minSeparation = collisionDistance * 0.1; // Minimum separation distance
            const totalSeparation = Math.max(overlap * separationFactor, minSeparation);
            const totalMass = body1.mass + body2.mass;
            
            // Mass-proportional separation (lighter objects move more)
            const separation1 = totalSeparation * body2.mass / totalMass;
            const separation2 = totalSeparation * body1.mass / totalMass;
            
            body1.position.x -= separation1 * normalX;
            body1.position.y -= separation1 * normalY;
            body2.position.x += separation2 * normalX;
            body2.position.y += separation2 * normalY;
            
            // Update Verlet integration positions for consistency
            if (body1.lastPosition) {
                body1.lastPosition.x -= separation1 * normalX;
                body1.lastPosition.y -= separation1 * normalY;
            }
            if (body2.lastPosition) {
                body2.lastPosition.x += separation2 * normalX;
                body2.lastPosition.y += separation2 * normalY;
            }
            
            // Uncomment for debugging: console.log(`Separated bodies: overlap=${overlap.toFixed(2)}, separation=${totalSeparation.toFixed(2)}, new distance=${Math.sqrt((body2.position.x - body1.position.x)**2 + (body2.position.y - body1.position.y)**2).toFixed(2)}`);
        }
        
        // Calculate relative velocity along collision normal
        const relativeVx = body2.velocity.x - body1.velocity.x;
        const relativeVy = body2.velocity.y - body1.velocity.y;
        const relativeVelNormal = relativeVx * normalX + relativeVy * normalY;
        
        // Don't resolve if objects are separating
        if (relativeVelNormal > 0) return;
        
        // Calculate collision impulse (inspired by broccoli's physics)
        const e = this.restitutionCoefficient;
        const impulseStrength = -(1 + e) * relativeVelNormal / (1/body1.mass + 1/body2.mass);
        
        // Apply impulse to velocities
        const impulseX = impulseStrength * normalX;
        const impulseY = impulseStrength * normalY;
        
        body1.velocity.x -= impulseX / body1.mass;
        body1.velocity.y -= impulseY / body1.mass;
        body2.velocity.x += impulseX / body2.mass;
        body2.velocity.y += impulseY / body2.mass;
        
        // Add tangential friction for realistic behavior
        const friction = PHYSICS_CONSTANTS.COLLISION_FRICTION || 0.1;
        if (friction > 0) {
            // Calculate tangential component of relative velocity
            const tangentX = relativeVx - relativeVelNormal * normalX;
            const tangentY = relativeVy - relativeVelNormal * normalY;
            const tangentMagnitude = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
            
            if (tangentMagnitude > 0.001) {
                const frictionImpulse = Math.min(friction * Math.abs(impulseStrength), tangentMagnitude);
                // Friction opposes relative tangential motion
                // tangent is (body2 - body1), so to reduce relative motion:
                // body1 gets pushed in +tangent direction, body2 in -tangent direction
                const frictionX = frictionImpulse * tangentX / tangentMagnitude;
                const frictionY = frictionImpulse * tangentY / tangentMagnitude;
                
                // Apply friction impulse (divide by mass for velocity change)
                const friction1 = 1 / (body1.mass + body2.mass) * body2.mass;
                const friction2 = 1 / (body1.mass + body2.mass) * body1.mass;
                body1.velocity.x += frictionX * friction1;
                body1.velocity.y += frictionY * friction1;
                body2.velocity.x -= frictionX * friction2;
                body2.velocity.y -= frictionY * friction2;
            }
        }
        
        // Note: Energy loss is controlled by restitution coefficient
        // Additional damping removed to allow proper elastic behavior
    }

    // Handle inelastic collisions (bodies merge when they collide)
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

    // Calculate total system energy with improved accuracy and caching
    calculateTotalEnergy(bodies) {
        // Only recalculate if needed (when bodies have moved)
        if (this.energyCacheValid) {
            return {
                kinetic: this.totalKineticEnergy,
                potential: this.totalPotentialEnergy,
                total: this.totalKineticEnergy + this.totalPotentialEnergy
            };
        }
        
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
        let totalMass = 0;
        let kineticEnergy = 0;
        let potentialEnergy = 0;

        bodies.forEach(body => {
            totalMass += body.mass;
            kineticEnergy += 0.5 * body.mass * body.velocity.magnitudeSquared();
        });

        // Calculate potential energy (using softening for consistency with force calculation)
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const dx = bodies[i].position.x - bodies[j].position.x;
                const dy = bodies[i].position.y - bodies[j].position.y;
                const distanceSquared = dx * dx + dy * dy;
                const softenedDistanceSquared = distanceSquared + this.softeningParameter * this.softeningParameter;
                const distance = Math.sqrt(softenedDistanceSquared);
                potentialEnergy -= this.gravitationalConstant * bodies[i].mass * bodies[j].mass / distance;
            }
        }

        return {
            totalMass,
            kineticEnergy,
            potentialEnergy,
            totalEnergy: kineticEnergy + potentialEnergy
        };
    }

    // Get energy statistics for monitoring
    getEnergyStats() {
        return {
            kinetic: this.totalKineticEnergy,
            potential: this.totalPotentialEnergy,
            total: this.totalEnergy
        };
    }

    // Get performance statistics
    getPerformanceStats() {
        return {
            physicsTime: this.physicsTime,
            forceCalculationTime: this.forceCalculationTime,
            integrationTime: this.integrationTime,
            bodyCount: this.currentBodyCount,
            method: this.forceCalculationMethod,
            integrationMethod: this.integrationMethod
        };
    }
    
    // Get comprehensive energy statistics
    getComprehensiveEnergyStats() {
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

    // Initialize GPU Physics Engine
    initializeGPUPhysics() {
        if (typeof GPUPhysicsEngine !== 'undefined') {
            try {
                this.gpuPhysics = new GPUPhysicsEngine();
                if (this.gpuPhysics.isReady()) {
                    console.log('GPU Physics Engine initialized successfully');
                    console.log(`GPU Mode: ${this.gpuPhysics.getPerformanceInfo().mode}`);
                    console.log(`Max Bodies (GPU): ${this.gpuPhysics.maxBodies}`);
                    this.useGPUPhysics = true;
                } else {
                    console.warn('GPU Physics Engine failed to initialize, using CPU physics');
                    this.gpuPhysics = null;
                    this.useGPUPhysics = false;
                }
            } catch (error) {
                console.error('Error initializing GPU Physics Engine:', error);
                this.gpuPhysics = null;
                this.useGPUPhysics = false;
            }
        } else {
            console.warn('GPUPhysicsEngine not available, using CPU physics only');
            this.useGPUPhysics = false;
        }
    }

    // Check if GPU physics should be used for current simulation
    shouldUseGPUPhysics(bodyCount) {
        return this.useGPUPhysics && 
               this.gpuPhysics && 
               this.gpuPhysics.isReady() && 
               bodyCount >= this.gpuPhysicsThreshold &&
               bodyCount <= this.gpuPhysics.maxBodies &&
               !this.collisionEnabled; // GPU physics doesn't handle collisions yet
    }

    // Set force calculation method with automatic GPU detection
    setForceCalculationMethod(method) {
        if (method === 'gpu' && !this.useGPUPhysics) {
            console.warn('GPU physics not available, falling back to Barnes-Hut');
            this.forceCalculationMethod = 'barnes-hut';
        } else {
            this.forceCalculationMethod = method;
        }
    }

    // Get comprehensive performance information including GPU stats
    getPerformanceInfo() {
        const cpuInfo = {
            physicsTime: this.physicsTime,
            forceCalculationTime: this.forceCalculationTime,
            integrationTime: this.integrationTime,
            bodyCount: this.currentBodyCount,
            forceMethod: this.forceCalculationMethod,
            integrationMethod: this.integrationMethod
        };

        if (this.gpuPhysics && this.useGPUPhysics) {
            const gpuInfo = this.gpuPhysics.getPerformanceInfo();
            return {
                ...cpuInfo,
                gpu: gpuInfo,
                usingGPU: this.shouldUseGPUPhysics(this.currentBodyCount)
            };
        }

        return {
            ...cpuInfo,
            gpu: { isSupported: false },
            usingGPU: false
        };
    }
}