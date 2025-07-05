class Body {
    constructor(position, velocity, mass, color = '#ff4757', trailLength = 50) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.acceleration = new Vector2D(0, 0);
        this.force = new Vector2D(0, 0);
        this.mass = mass;
        this.color = color;
        this.trail = [];
        this.maxTrailLength = trailLength;
        this.radius = this.calculateRadius();
        this.selected = false;
        this.hovered = false; // Add hover state
        this.beingDragged = false; // Add drag state
        this.id = Body.generateId();
        
        // Visual properties
        this.glowIntensity = 0;
        this.targetGlow = 0;
        
        // Physics properties
        this.fixed = false; // Can be set to true to make immovable
        this.lastPosition = position.clone();
        
        // Collision properties
        this.collisionCooldowns = new Map(); // Time-based cooldowns with specific bodies
        this.lastCollisionPartner = null; // Prevent immediate re-collision
        this.inCollision = false; // Track if currently in collision state
        this.collisionTime = 0; // How long in collision
        this.hasCollidedThisFrame = false; // Flag for current frame
        
        // Energy tracking
        this.kineticEnergy = 0;
        this.potentialEnergy = 0;
    }

    static idCounter = 0;
    static generateId() {
        return ++Body.idCounter;
    }

    // Calculate visual radius based on mass
    calculateRadius() {
        // Ensure mass is a valid, positive number
        const safeMass = Math.max(0.1, this.mass || 0.1);
        return Math.max(RENDERING_CONSTANTS.MIN_BODY_RADIUS, Math.sqrt(safeMass / RENDERING_CONSTANTS.BODY_RADIUS_SCALE) + 2);
    }

    // Update radius when mass changes
    updateRadius() {
        this.radius = this.calculateRadius();
    }

    // Add position to trail with efficient circular buffer implementation
    addToTrail() {
        if (this.maxTrailLength <= 0) return;
        
        // Use circular buffer for better performance
        if (!this.trailIndex) this.trailIndex = 0;
        
        if (this.trail.length < this.maxTrailLength) {
            // Still filling up the trail
            this.trail.push(this.position.clone());
        } else {
            // Trail is full, use circular buffer
            this.trail[this.trailIndex] = this.position.clone();
            this.trailIndex = (this.trailIndex + 1) % this.maxTrailLength;
        }
    }
    
    // Get trail points in correct order for rendering
    getOrderedTrail() {
        if (this.trail.length < this.maxTrailLength || !this.trailIndex) {
            return this.trail;
        }
        
        // Return trail points in correct chronological order
        const orderedTrail = [];
        for (let i = 0; i < this.maxTrailLength; i++) {
            const index = (this.trailIndex + i) % this.maxTrailLength;
            orderedTrail.push(this.trail[index]);
        }
        return orderedTrail;
    }

    // Clear the trail
    clearTrail() {
        this.trail = [];
    }

    // Update physics - Verlet integration for better stability
    update(deltaTime) {
        if (this.fixed) return;

        // Calculate acceleration from current forces
        this.acceleration = this.force.divide(this.mass);
        
        // Verlet integration: x(t+dt) = 2*x(t) - x(t-dt) + a(t)*dt^2
        // For first frame or if we don't have lastPosition, use Euler step
        if (!this.lastPosition || this.lastPosition.equals(this.position)) {
            // Initial step: use simple Euler integration
            this.velocity.addMut(this.acceleration.multiply(deltaTime));
            this.lastPosition = this.position.clone();
            this.position.addMut(this.velocity.multiply(deltaTime));
        } else {
            // Proper Verlet integration
            const newPosition = this.position
                .multiply(2)
                .subtract(this.lastPosition)
                .add(this.acceleration.multiply(deltaTime * deltaTime));
            
            // Update lastPosition BEFORE changing position
            const tempPosition = this.position.clone();
            this.position = newPosition;
            this.lastPosition = tempPosition;
            
            // Calculate velocity from position difference (for display/energy calc)
            // v = (x(t) - x(t-dt)) / dt
            this.velocity = this.position.subtract(this.lastPosition).divide(deltaTime);
        }

        // Calculate kinetic energy
        this.kineticEnergy = 0.5 * this.mass * this.velocity.magnitudeSquared();

        // Update collision cooldowns (time-based)
        this.updateCollisionCooldowns(deltaTime);
        
        // Reset frame-based collision flag
        this.hasCollidedThisFrame = false;

        // Add to trail
        this.addToTrail();

        // Update visual effects
        this.updateVisualEffects(deltaTime);

        // Reset force for next frame
        this.resetForce();
    }

    // Alternative Euler integration (less stable but simpler)
    updateEuler(deltaTime) {
        if (this.fixed) return;

        this.acceleration = this.force.divide(this.mass);
        this.velocity.addMut(this.acceleration.multiply(deltaTime));
        this.lastPosition = this.position.clone();
        this.position.addMut(this.velocity.multiply(deltaTime));

        this.kineticEnergy = 0.5 * this.mass * this.velocity.magnitudeSquared();
        
        // Update collision cooldowns (time-based)
        this.updateCollisionCooldowns(deltaTime);
        
        // Reset frame-based collision flag
        this.hasCollidedThisFrame = false;
        
        this.addToTrail();
        this.updateVisualEffects(deltaTime);
        this.resetForce();
    }

    // Update visual effects like glow
    updateVisualEffects(deltaTime) {
        // Smooth glow transition
        const glowSpeed = 5.0;
        this.glowIntensity += (this.targetGlow - this.glowIntensity) * glowSpeed * deltaTime;
    }

    // Reset force accumulator
    resetForce() {
        this.force.set(0, 0);
    }

    // Apply force to this body
    applyForce(force) {
        this.force.addMut(force);
    }

    // Calculate gravitational force from another body
    calculateGravitationalForce(other, gravitationalConstant, softeningParameter = PHYSICS_CONSTANTS.SOFTENING_PARAMETER) {
        const direction = other.position.subtract(this.position);
        const distanceSquared = direction.magnitudeSquared();
        
        // Softening to prevent singularities
        const softenedDistanceSquared = distanceSquared + softeningParameter * softeningParameter;
        
        // Avoid unnecessary sqrt - we can normalize by dividing by distance directly
        const distance = Math.sqrt(softenedDistanceSquared);
        
        // F = G * m1 * m2 / r^2
        const forceMagnitude = gravitationalConstant * this.mass * other.mass / softenedDistanceSquared;
        
        // More efficient: direction / distance gives us the unit vector
        // This avoids calling normalize() which does another sqrt
        return direction.multiply(forceMagnitude / distance);
    }

    // Check if this body would collide with another
    wouldCollideWith(other, threshold = PHYSICS_CONSTANTS.COLLISION_THRESHOLD) {
        const distance = this.position.distance(other.position);
        return distance < threshold;
    }

    // Check if a point is inside this body (for mouse interaction)
    containsPoint(point, hitboxScale = RENDERING_CONSTANTS.BODY_HITBOX_SCALE) {
        const distance = this.position.distance(point);
        return distance <= this.radius * hitboxScale;
    }

    // Merge with another body (conservation of momentum and mass)
    static merge(body1, body2) {
        const totalMass = body1.mass + body2.mass;
        
        // Conservation of momentum: p = mv
        const newVelocity = body1.velocity
            .multiply(body1.mass)
            .add(body2.velocity.multiply(body2.mass))
            .divide(totalMass);
        
        // Conservation of position (weighted by mass)
        const newPosition = body1.position
            .multiply(body1.mass)
            .add(body2.position.multiply(body2.mass))
            .divide(totalMass);
        
        // Choose properties from the more massive body
        const dominant = body1.mass >= body2.mass ? body1 : body2;
        const newColor = dominant.color;
        const newTrailLength = Math.max(body1.maxTrailLength, body2.maxTrailLength);
        
        // Create merged body
        const merged = new Body(newPosition, newVelocity, totalMass, newColor, newTrailLength);
        merged.fixed = body1.fixed || body2.fixed;
        
        return merged;
    }

    // Set selection state
    setSelected(selected) {
        this.selected = selected;
        this.targetGlow = selected ? 1.0 : 0.0;
    }

    // Set hover state
    setHovered(hovered) {
        this.hovered = hovered;
        // Slight glow effect when hovered (but less than selected)
        if (!this.selected) {
            this.targetGlow = hovered ? 0.3 : 0.0;
        }
    }

    // Set drag state
    setBeingDragged(beingDragged) {
        this.beingDragged = beingDragged;
        // Enhanced glow when being dragged
        if (beingDragged) {
            this.targetGlow = 1.5;
        } else if (this.selected) {
            this.targetGlow = 1.0;
        } else if (this.hovered) {
            this.targetGlow = 0.3;
        } else {
            this.targetGlow = 0.0;
        }
    }

    // Get display information
    getDisplayInfo() {
        return {
            id: this.id,
            mass: this.mass.toFixed(1),
            position: `(${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)})`,
            velocity: `(${this.velocity.x.toFixed(1)}, ${this.velocity.y.toFixed(1)})`,
            speed: this.velocity.magnitude().toFixed(1),
            kineticEnergy: this.kineticEnergy.toFixed(1),
            potentialEnergy: this.potentialEnergy.toFixed(1)
        };
    }

    // Create a copy of this body
    clone() {
        const cloned = new Body(
            this.position.clone(),
            this.velocity.clone(),
            this.mass,
            this.color,
            this.maxTrailLength
        );
        cloned.fixed = this.fixed;
        cloned.trail = this.trail.map(pos => pos.clone());
        return cloned;
    }

    // Serialize to JSON
    toJSON() {
        return {
            position: { x: this.position.x, y: this.position.y },
            velocity: { x: this.velocity.x, y: this.velocity.y },
            mass: this.mass,
            color: this.color,
            maxTrailLength: this.maxTrailLength,
            fixed: this.fixed
        };
    }

    // Create from JSON
    static fromJSON(data) {
        const body = new Body(
            new Vector2D(data.position.x, data.position.y),
            new Vector2D(data.velocity.x, data.velocity.y),
            data.mass,
            data.color,
            data.maxTrailLength
        );
        body.fixed = data.fixed || false;
        return body;
    }

    // Apply impulse (instant change in velocity)
    applyImpulse(impulse) {
        this.velocity.addMut(impulse.divide(this.mass));
    }

    // Set velocity to zero
    stop() {
        this.velocity.set(0, 0);
        this.lastPosition = this.position.clone();
    }

    // Set position and update last position to prevent teleportation effects
    setPosition(newPosition) {
        const delta = newPosition.subtract(this.position);
        this.position.setFromVector(newPosition);
        this.lastPosition.addMut(delta);
        this.clearTrail();
    }

    // Get momentum vector
    getMomentum() {
        return this.velocity.multiply(this.mass);
    }

    // Get total energy (kinetic + potential)
    getTotalEnergy() {
        return this.kineticEnergy + this.potentialEnergy;
    }

    // Check if body is moving
    isMoving(threshold = 0.1) {
        return this.velocity.magnitude() > threshold;
    }

    // Predict future position
    predictPosition(time) {
        return this.position.add(this.velocity.multiply(time));
    }

    // Get orbital parameters relative to another body
    getOrbitalParameters(centralBody, gravitationalConstant = PHYSICS_CONSTANTS.GRAVITATIONAL_CONSTANT) {
        const relativePosition = this.position.subtract(centralBody.position);
        const relativeVelocity = this.velocity.subtract(centralBody.velocity);
        
        const distance = relativePosition.magnitude();
        const speed = relativeVelocity.magnitude();
        
        // Specific orbital energy
        const mu = gravitationalConstant * (this.mass + centralBody.mass);
        const specificEnergy = (speed * speed) / 2 - mu / distance;
        
        // Semi-major axis (negative for bound orbits)
        const semiMajorAxis = specificEnergy < 0 ? -mu / (2 * specificEnergy) : Infinity;
        
        // Eccentricity
        const angularMomentum = relativePosition.cross(relativeVelocity);
        const eccentricityVector = relativeVelocity
            .cross(new Vector2D(0, angularMomentum))
            .divide(mu)
            .subtract(relativePosition.normalize());
        const eccentricity = eccentricityVector.magnitude();
        
        return {
            distance: distance,
            speed: speed,
            semiMajorAxis: semiMajorAxis,
            eccentricity: eccentricity,
            isbound: specificEnergy < 0,
            period: specificEnergy < 0 ? 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu) : Infinity
        };
    }

    // Collision cooldown management methods
    setCollisionCooldownWith(otherBody, cooldownTime) {
        this.collisionCooldowns.set(otherBody.id, cooldownTime);
    }

    isInCollisionCooldownWith(otherBody) {
        return this.collisionCooldowns.has(otherBody.id) && this.collisionCooldowns.get(otherBody.id) > 0;
    }

    updateCollisionCooldowns(deltaTime) {
        // Update all cooldown timers
        for (const [bodyId, cooldownTime] of this.collisionCooldowns.entries()) {
            const newCooldownTime = Math.max(0, cooldownTime - deltaTime);
            if (newCooldownTime <= 0) {
                this.collisionCooldowns.delete(bodyId);
            } else {
                this.collisionCooldowns.set(bodyId, newCooldownTime);
            }
        }
    }

    clearAllCollisionCooldowns() {
        this.collisionCooldowns.clear();
    }
}
