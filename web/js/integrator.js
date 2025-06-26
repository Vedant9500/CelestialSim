/**
 * Advanced numerical integrators for N-body simulation
 * Includes RK4 (Runge-Kutta 4th order) and other high-accuracy methods
 */

class Integrator {
    constructor() {
        this.method = 'rk4'; // default to RK4
    }

    /**
     * Runge-Kutta 4th order integrator
     * Much more accurate than Euler method, allows larger timesteps
     */
    integrateRK4(bodies, dt, forceCalculator) {
        const n = bodies.length;
        
        // Store initial state
        const initialStates = bodies.map(body => ({
            position: body.position.clone(),
            velocity: body.velocity.clone(),
            force: body.force.clone()
        }));

        // RK4 coefficients storage
        const k1_pos = new Array(n);
        const k1_vel = new Array(n);
        const k2_pos = new Array(n);
        const k2_vel = new Array(n);
        const k3_pos = new Array(n);
        const k3_vel = new Array(n);
        const k4_pos = new Array(n);
        const k4_vel = new Array(n);

        // K1: derivatives at current state
        forceCalculator(bodies);
        for (let i = 0; i < n; i++) {
            k1_pos[i] = bodies[i].velocity.clone();
            k1_vel[i] = bodies[i].force.clone().divide(bodies[i].mass);
        }

        // K2: derivatives at midpoint using K1
        this.updateBodiesRK4(bodies, initialStates, k1_pos, k1_vel, dt * 0.5);
        forceCalculator(bodies);
        for (let i = 0; i < n; i++) {
            k2_pos[i] = bodies[i].velocity.clone();
            k2_vel[i] = bodies[i].force.clone().divide(bodies[i].mass);
        }

        // K3: derivatives at midpoint using K2
        this.updateBodiesRK4(bodies, initialStates, k2_pos, k2_vel, dt * 0.5);
        forceCalculator(bodies);
        for (let i = 0; i < n; i++) {
            k3_pos[i] = bodies[i].velocity.clone();
            k3_vel[i] = bodies[i].force.clone().divide(bodies[i].mass);
        }

        // K4: derivatives at endpoint using K3
        this.updateBodiesRK4(bodies, initialStates, k3_pos, k3_vel, dt);
        forceCalculator(bodies);
        for (let i = 0; i < n; i++) {
            k4_pos[i] = bodies[i].velocity.clone();
            k4_vel[i] = bodies[i].force.clone().divide(bodies[i].mass);
        }

        // Final update using weighted average of all K values
        for (let i = 0; i < n; i++) {
            const body = bodies[i];
            const initial = initialStates[i];

            // Position update: x + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
            const pos_update = k1_pos[i].clone()
                .add(k2_pos[i].multiply(2))
                .add(k3_pos[i].multiply(2))
                .add(k4_pos[i])
                .multiply(dt / 6);

            // Velocity update: v + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
            const vel_update = k1_vel[i].clone()
                .add(k2_vel[i].multiply(2))
                .add(k3_vel[i].multiply(2))
                .add(k4_vel[i])
                .multiply(dt / 6);

            body.lastPosition = initial.position.clone();
            body.position = initial.position.add(pos_update);
            body.velocity = initial.velocity.add(vel_update);
            
            // Update body properties that are normally handled in update methods
            body.kineticEnergy = 0.5 * body.mass * body.velocity.magnitudeSquared();
            body.addToTrail();
            body.updateVisualEffects(dt);
            body.resetForce();
        }
    }

    /**
     * Helper method to update bodies for RK4 intermediate steps
     */
    updateBodiesRK4(bodies, initialStates, k_pos, k_vel, dt_factor) {
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            const initial = initialStates[i];
            
            body.position = initial.position.add(k_pos[i].clone().multiply(dt_factor));
            body.velocity = initial.velocity.add(k_vel[i].clone().multiply(dt_factor));
            body.resetForce();
        }
    }

    /**
     * Adaptive timestep RK4 - adjusts timestep based on local truncation error
     */
    integrateAdaptiveRK4(bodies, dt, forceCalculator, tolerance = 1e-6) {
        const originalDt = dt;
        let currentDt = dt;
        let maxError = 0;

        // Take one full step
        const fullStepBodies = bodies.map(body => body.clone());
        this.integrateRK4(fullStepBodies, currentDt, forceCalculator);

        // Take two half steps
        const halfStepBodies = bodies.map(body => body.clone());
        this.integrateRK4(halfStepBodies, currentDt * 0.5, forceCalculator);
        this.integrateRK4(halfStepBodies, currentDt * 0.5, forceCalculator);

        // Calculate error between full step and two half steps
        for (let i = 0; i < bodies.length; i++) {
            const posError = fullStepBodies[i].position.distance(halfStepBodies[i].position);
            const velError = fullStepBodies[i].velocity.distance(halfStepBodies[i].velocity);
            maxError = Math.max(maxError, posError, velError);
        }

        // Adjust timestep based on error
        if (maxError > tolerance) {
            currentDt *= 0.8 * Math.pow(tolerance / maxError, 0.25);
            return this.integrateAdaptiveRK4(bodies, currentDt, forceCalculator, tolerance);
        } else if (maxError < tolerance * 0.1) {
            currentDt = Math.min(originalDt * 1.2, originalDt * 2);
        }

        // Use the more accurate half-step result
        for (let i = 0; i < bodies.length; i++) {
            bodies[i].position = halfStepBodies[i].position;
            bodies[i].velocity = halfStepBodies[i].velocity;
        }

        return currentDt;
    }

    /**
     * Leapfrog integrator - good for energy conservation
     */
    integrateLeapfrog(bodies, dt, forceCalculator) {
        // Update velocities by half timestep
        forceCalculator(bodies);
        for (const body of bodies) {
            const acceleration = body.force.clone().divide(body.mass);
            body.velocity = body.velocity.add(acceleration.multiply(dt * 0.5));
        }

        // Update positions by full timestep
        for (const body of bodies) {
            body.position = body.position.add(body.velocity.clone().multiply(dt));
        }

        // Update forces at new positions
        bodies.forEach(body => body.resetForce());
        forceCalculator(bodies);

        // Update velocities by another half timestep
        for (const body of bodies) {
            const acceleration = body.force.clone().divide(body.mass);
            body.velocity = body.velocity.add(acceleration.multiply(dt * 0.5));
        }
    }

    /**
     * Velocity Verlet integrator - excellent energy conservation
     */
    integrateVerlet(bodies, dt, forceCalculator, previousAccelerations = null) {
        const accelerations = [];
        
        // Calculate current accelerations
        forceCalculator(bodies);
        for (let i = 0; i < bodies.length; i++) {
            accelerations[i] = bodies[i].force.clone().divide(bodies[i].mass);
        }

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            const a = accelerations[i];
            
            // Update position: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
            body.position = body.position.add(
                body.velocity.clone().multiply(dt).add(
                    a.clone().multiply(0.5 * dt * dt)
                )
            );
        }

        // Calculate new accelerations at new positions
        bodies.forEach(body => body.resetForce());
        forceCalculator(bodies);
        const newAccelerations = [];
        for (let i = 0; i < bodies.length; i++) {
            newAccelerations[i] = bodies[i].force.clone().divide(bodies[i].mass);
        }

        // Update velocities: v(t+dt) = v(t) + 0.5*[a(t) + a(t+dt)]*dt
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            const avgAcceleration = accelerations[i].add(newAccelerations[i]).multiply(0.5);
            body.velocity = body.velocity.add(avgAcceleration.multiply(dt));
        }

        return newAccelerations; // Return for next iteration
    }
}
