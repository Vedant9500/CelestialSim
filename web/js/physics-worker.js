/**
 * Web Worker for background physics calculations
 * Allows heavy computations to run without blocking the UI
 */

// Import necessary modules (note: Web Workers have limited access)
importScripts('vector2d.js', 'body.js', 'integrator.js', 'barnes-hut.js');

class PhysicsWorker {
    constructor() {
        this.gravitationalConstant = 100.0;
        this.softeningParameter = 20.0;
        this.integrator = new Integrator();
        this.barnesHutTheta = 0.5;
        
        console.log('PhysicsWorker initialized');
    }
    
    // Calculate forces using Barnes-Hut algorithm
    calculateForcesBarnesHut(bodies) {
        // Reset forces
        bodies.forEach(body => {
            body.resetForce();
            body.potentialEnergy = 0;
        });
        
        // Build quadtree
        const bounds = this.calculateBounds(bodies);
        const barnesHut = new QuadTree(bounds, 1);
        
        // Insert all bodies
        bodies.forEach(body => barnesHut.insert(body));
        
        // Calculate forces for each body
        bodies.forEach(body => {
            barnesHut.calculateForce(body, this.gravitationalConstant, this.softeningParameter, this.barnesHutTheta);
        });
        
        return bodies;
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
    
    // Perform physics simulation step
    simulateStep(bodiesData, deltaTime, config) {
        // Validate input parameters
        if (!Array.isArray(bodiesData) || typeof deltaTime !== 'number' || deltaTime <= 0 || !isFinite(deltaTime)) {
            throw new Error('Invalid simulation parameters');
        }
        
        // Reconstruct body objects from serialized data with validation
        const bodies = bodiesData.map((bodyData, index) => {
            // Validate body data structure
            if (!bodyData || !bodyData.position || !bodyData.velocity || 
                typeof bodyData.mass !== 'number' || bodyData.mass <= 0) {
                throw new Error(`Invalid body data at index ${index}`);
            }
            
            // Validate numerical values
            if (!isFinite(bodyData.position.x) || !isFinite(bodyData.position.y) ||
                !isFinite(bodyData.velocity.x) || !isFinite(bodyData.velocity.y) ||
                !isFinite(bodyData.mass)) {
                throw new Error(`Non-finite values in body data at index ${index}`);
            }
            
            const body = new Body(
                new Vector2D(bodyData.position.x, bodyData.position.y),
                new Vector2D(bodyData.velocity.x, bodyData.velocity.y),
                bodyData.mass,
                bodyData.color || '#ff4757',
                bodyData.trailLength || 50
            );
            body.id = bodyData.id || index;
            body.trail = Array.isArray(bodyData.trail) ? bodyData.trail : [];
            return body;
        });
        
        // Calculate forces
        if (config.forceMethod === 'barnes-hut' && bodies.length > 5) {
            this.calculateForcesBarnesHut(bodies);
        } else {
            this.calculateForcesNaive(bodies);
        }
        
        // Update positions using RK4 integrator
        if (config.integrationMethod === 'rk4') {
            this.integrator.integrateRK4(bodies, deltaTime, (bodies) => {
                if (config.forceMethod === 'barnes-hut' && bodies.length > 8) {
                    this.calculateForcesBarnesHut(bodies);
                } else {
                    this.calculateForcesNaive(bodies);
                }
            });
        } else {
            // Fallback to simple Verlet integration
            bodies.forEach(body => body.update(deltaTime));
        }
        
        // Calculate energy
        const energy = this.calculateTotalEnergy(bodies);
        
        // Serialize bodies back to transferable data with validation
        const serializedBodies = bodies.map(body => {
            // Validate body state before serialization
            if (!body.validateState()) {
                body.correctState();
            }
            
            return {
                id: body.id,
                position: { x: body.position.x, y: body.position.y },
                velocity: { x: body.velocity.x, y: body.velocity.y },
                mass: body.mass,
                radius: body.radius,
                color: body.color,
                trail: body.trail,
                kineticEnergy: body.kineticEnergy || 0,
                potentialEnergy: body.potentialEnergy || 0
            };
        });
        
        return {
            bodies: serializedBodies,
            energy: energy
        };
    }
    
    // Calculate forces using naive O(N²) method
    calculateForcesNaive(bodies) {
        // Reset forces
        bodies.forEach(body => body.resetForce());
        
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
                body2.applyForce(force.multiply(-1));
            }
        }
    }
    
    // Calculate total system energy
    calculateTotalEnergy(bodies) {
        let totalKinetic = 0;
        let totalPotential = 0;
        
        // Calculate kinetic energy
        bodies.forEach(body => {
            const kineticEnergy = 0.5 * body.mass * body.velocity.magnitudeSquared();
            totalKinetic += kineticEnergy;
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
                totalPotential += potentialEnergy;
            }
        }
        
        return {
            kinetic: totalKinetic,
            potential: totalPotential,
            total: totalKinetic + totalPotential
        };
    }
}

// Create worker instance
const physicsWorker = new PhysicsWorker();

// Handle messages from main thread
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    try {
        switch (type) {
            case 'simulate':
                const result = physicsWorker.simulateStep(
                    data.bodies,
                    data.deltaTime,
                    data.config
                );
                self.postMessage({
                    type: 'simulation-result',
                    data: result
                });
                break;
                
            case 'configure':
                if (data.gravitationalConstant !== undefined) {
                    physicsWorker.gravitationalConstant = data.gravitationalConstant;
                }
                if (data.softeningParameter !== undefined) {
                    physicsWorker.softeningParameter = data.softeningParameter;
                }
                if (data.barnesHutTheta !== undefined) {
                    physicsWorker.barnesHutTheta = data.barnesHutTheta;
                }
                self.postMessage({
                    type: 'configuration-updated',
                    data: { success: true }
                });
                break;
                
            default:
                console.warn('Unknown message type:', type);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            data: { 
                message: error.message,
                stack: error.stack
            }
        });
    }
};

console.log('PhysicsWorker ready');
