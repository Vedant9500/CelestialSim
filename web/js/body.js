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
        this.id = Body.generateId();
        
        // Visual properties
        this.glowIntensity = 0;
        this.targetGlow = 0;
        
        // Physics properties
        this.fixed = false; // Can be set to true to make immovable
        this.lastPosition = position.clone();
        
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
        return Math.max(3, Math.sqrt(this.mass / 5) + 2);
    }

    // Update radius when mass changes
    updateRadius() {
        this.radius = this.calculateRadius();
    }

    // Add position to trail
    addToTrail() {
        this.trail.push(this.position.clone());
        while (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
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
            // Verlet integration with consistent timestep
            const newPosition = this.position
                .multiply(2)
                .subtract(this.lastPosition)
                .add(this.acceleration.multiply(deltaTime * deltaTime));
            
            this.lastPosition = this.position.clone();
            this.position = newPosition;
            
            // Calculate velocity from position difference
            this.velocity = this.position.subtract(this.lastPosition).divide(deltaTime);
        }

        // Calculate kinetic energy
        this.kineticEnergy = 0.5 * this.mass * this.velocity.magnitudeSquared();

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
    calculateGravitationalForce(other, gravitationalConstant, softeningParameter = 20) {
        const direction = other.position.subtract(this.position);
        const distanceSquared = direction.magnitudeSquared();
        
        // Softening to prevent singularities
        const softenedDistanceSquared = distanceSquared + softeningParameter * softeningParameter;
        const distance = Math.sqrt(softenedDistanceSquared);
        
        // F = G * m1 * m2 / r^2
        const forceMagnitude = gravitationalConstant * this.mass * other.mass / softenedDistanceSquared;
        
        // Return force vector
        return direction.normalize().multiply(forceMagnitude);
    }

    // Check if this body would collide with another
    wouldCollideWith(other, threshold = 15) {
        const distance = this.position.distance(other.position);
        return distance < threshold;
    }

    // Check if a point is inside this body (for mouse interaction)
    containsPoint(point, hitboxScale = 1.2) {
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
    getOrbitalParameters(centralBody) {
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
}
