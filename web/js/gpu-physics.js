/**
 * GPU.js Accelerated N-body Physics Engine
 * 
 * Uses GPU.js library for high-performance GPU computation
 * Supports thousands of bodies with real-time simulation
 */
class GPUPhysicsEngine {
    constructor() {
        this.gpu = null;
        this.isSupported = false;
        this.isInitialized = false;
        
        // GPU.js kernels
        this.calculateForcesKernel = null;
        this.updatePositionsKernel = null;
        this.calculateEnergiesKernel = null;
        
        // Performance tracking
        this.performanceStats = {
            gpuTime: 0,
            lastUpdateTime: 0,
            lastBodyCount: 0
        };
        
        // Configuration
        this.maxBodies = 10000; // Much higher limit with GPU.js
        this.currentBodyCount = 0;
        
        // Physics parameters
        this.gravitationalConstant = 0.5;
        this.softeningFactor = 100.0;
        
        this.initialize();
    }

    initialize() {
        try {
            console.log('Initializing GPU.js Physics Engine...');
            
            // Check if GPU.js is available
            if (typeof GPU === 'undefined') {
                console.warn('GPU.js library not found - GPU acceleration disabled');
                this.isSupported = false;
                return;
            }
            
            // Initialize GPU.js
            this.gpu = new GPU({
                mode: 'gpu' // Prefer GPU, fallback to CPU if needed
            });
            
            // Get GPU capabilities
            const maxTexSize = this.gpu.maxTexSize;
            this.maxBodies = Math.min(this.maxBodies, Math.floor(maxTexSize / 4)); // Conservative estimate
            
            console.log('GPU.js initialized successfully');
            console.log('- Mode:', this.gpu.mode);
            console.log('- Max texture size:', maxTexSize);
            console.log('- Max bodies supported:', this.maxBodies);
            
            this.createKernels();
            
            this.isSupported = true;
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Failed to initialize GPU.js Physics Engine:', error);
            this.isSupported = false;
            this.isInitialized = false;
        }
    }

    createKernels() {
        console.log('Creating GPU.js compute kernels...');
        
        // Kernel to calculate gravitational forces for each body
        this.calculateForcesKernel = this.gpu.createKernel(function(
            positionsX, positionsY, masses, 
            gravConstant, softening, bodyCount
        ) {
            const i = this.thread.x;
            
            let forceX = 0;
            let forceY = 0;
            
            const myPosX = positionsX[i];
            const myPosY = positionsY[i];
            const myMass = masses[i];
            
            // Calculate forces from all other bodies
            for (let j = 0; j < bodyCount; j++) {
                if (i === j) continue;
                
                const otherPosX = positionsX[j];
                const otherPosY = positionsY[j];
                const otherMass = masses[j];
                
                const dx = otherPosX - myPosX;
                const dy = otherPosY - myPosY;
                const distanceSq = dx * dx + dy * dy + softening;
                const distance = Math.sqrt(distanceSq);
                
                // F = G * m1 * m2 / r^2, but we want acceleration so F/m1
                const forceMagnitude = gravConstant * otherMass / distanceSq;
                
                forceX += forceMagnitude * (dx / distance);
                forceY += forceMagnitude * (dy / distance);
            }
            
            return [forceX, forceY];
        }, {
            output: [this.maxBodies],
            pipeline: true,
            immutable: true
        });
        
        // Kernel to update positions and velocities using calculated forces
        this.updatePositionsKernel = this.gpu.createKernel(function(
            positionsX, positionsY, velocitiesX, velocitiesY, 
            forcesX, forcesY, deltaTime, bodyCount
        ) {
            const i = this.thread.x;
            
            if (i >= bodyCount) {
                return [positionsX[i], positionsY[i], velocitiesX[i], velocitiesY[i]];
            }
            
            // Semi-implicit Euler integration
            const newVelX = velocitiesX[i] + forcesX[i] * deltaTime;
            const newVelY = velocitiesY[i] + forcesY[i] * deltaTime;
            
            const newPosX = positionsX[i] + newVelX * deltaTime;
            const newPosY = positionsY[i] + newVelY * deltaTime;
            
            return [newPosX, newPosY, newVelX, newVelY];
        }, {
            output: [this.maxBodies],
            pipeline: true,
            immutable: true
        });
        
        // Kernel to calculate kinetic and potential energies
        this.calculateEnergiesKernel = this.gpu.createKernel(function(
            positionsX, positionsY, velocitiesX, velocitiesY, masses,
            gravConstant, bodyCount
        ) {
            const i = this.thread.x;
            
            if (i >= bodyCount) {
                return [0, 0];
            }
            
            const myMass = masses[i];
            const velX = velocitiesX[i];
            const velY = velocitiesY[i];
            
            // Kinetic energy: 0.5 * m * v^2
            const kineticEnergy = 0.5 * myMass * (velX * velX + velY * velY);
            
            // Potential energy: sum of -G * m1 * m2 / r for all pairs
            let potentialEnergy = 0;
            const myPosX = positionsX[i];
            const myPosY = positionsY[i];
            
            for (let j = i + 1; j < bodyCount; j++) {
                const otherMass = masses[j];
                const otherPosX = positionsX[j];
                const otherPosY = positionsY[j];
                
                const dx = otherPosX - myPosX;
                const dy = otherPosY - myPosY;
                const distance = Math.sqrt(dx * dx + dy * dy + 1.0); // Small softening
                
                potentialEnergy -= gravConstant * myMass * otherMass / distance;
            }
            
            return [kineticEnergy, potentialEnergy];
        }, {
            output: [this.maxBodies],
            pipeline: true,
            immutable: true
        });
        
        console.log('GPU.js kernels created successfully');
    }

    // Main update method
    update(bodies, deltaTime) {
        if (!this.isReady() || bodies.length === 0) {
            return false;
        }

        if (bodies.length > this.maxBodies) {
            console.warn(`GPU.js Physics: Too many bodies (${bodies.length}), max supported: ${this.maxBodies}`);
            return false;
        }
        
        // Validate input parameters
        if (!Array.isArray(bodies) || typeof deltaTime !== 'number' || deltaTime <= 0 || !isFinite(deltaTime)) {
            console.warn('GPU Physics: Invalid input parameters');
            return false;
        }
        
        // Validate all bodies have valid numerical values
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (!body || !body.position || !body.velocity || 
                !isFinite(body.position.x) || !isFinite(body.position.y) ||
                !isFinite(body.velocity.x) || !isFinite(body.velocity.y) ||
                !isFinite(body.mass) || body.mass <= 0) {
                console.warn(`GPU Physics: Invalid body data detected at index ${i}, falling back to CPU`);
                return false;
            }
        }

        try {
            const startTime = performance.now();
            
            this.currentBodyCount = bodies.length;
            
            // Prepare data arrays for GPU.js
            const positionsX = new Float32Array(this.maxBodies);
            const positionsY = new Float32Array(this.maxBodies);
            const velocitiesX = new Float32Array(this.maxBodies);
            const velocitiesY = new Float32Array(this.maxBodies);
            const masses = new Float32Array(this.maxBodies);
            
            // Copy body data to arrays
            for (let i = 0; i < bodies.length; i++) {
                const body = bodies[i];
                positionsX[i] = body.position.x;
                positionsY[i] = body.position.y;
                velocitiesX[i] = body.velocity.x;
                velocitiesY[i] = body.velocity.y;
                masses[i] = body.mass;
            }
            
            // Calculate forces on GPU
            const forces = this.calculateForcesKernel(
                positionsX, positionsY, masses,
                this.gravitationalConstant, this.softeningFactor, bodies.length
            );
            
            // Validate force calculation results
            if (!forces || !Array.isArray(forces) || forces.length < bodies.length) {
                console.warn('GPU Physics: Invalid force calculation results');
                return false;
            }
            
            // Extract force components
            const forcesX = new Float32Array(this.maxBodies);
            const forcesY = new Float32Array(this.maxBodies);
            
            for (let i = 0; i < this.maxBodies; i++) {
                if (forces[i] && Array.isArray(forces[i]) && forces[i].length >= 2) {
                    forcesX[i] = forces[i][0];
                    forcesY[i] = forces[i][1];
                } else {
                    forcesX[i] = 0;
                    forcesY[i] = 0;
                }
            }
            
            // Update positions and velocities on GPU
            const newState = this.updatePositionsKernel(
                positionsX, positionsY, velocitiesX, velocitiesY,
                forcesX, forcesY, deltaTime, bodies.length
            );
            
            // Validate position update results
            if (!newState || !Array.isArray(newState) || newState.length < bodies.length) {
                console.warn('GPU Physics: Invalid position update results');
                return false;
            }
            
            // Copy results back to bodies with validation
            for (let i = 0; i < bodies.length; i++) {
                const body = bodies[i];
                const result = newState[i];
                
                if (!result || !Array.isArray(result) || result.length < 4) {
                    console.warn(`GPU Physics: Invalid result for body ${i}`);
                    return false;
                }
                
                // Validate each component before assignment
                const newPosX = result[0];
                const newPosY = result[1];
                const newVelX = result[2];
                const newVelY = result[3];
                
                if (!isFinite(newPosX) || !isFinite(newPosY) || !isFinite(newVelX) || !isFinite(newVelY)) {
                    console.warn(`GPU Physics: Non-finite values detected for body ${i}`);
                    return false;
                }
                
                body.position.x = newPosX;
                body.position.y = newPosY;
                body.velocity.x = newVelX;
                body.velocity.y = newVelY;
            }
            
            this.performanceStats.gpuTime = performance.now() - startTime;
            this.performanceStats.lastBodyCount = bodies.length;
            
            return true;
            
        } catch (error) {
            console.error('GPU.js Physics error:', error);
            this.isSupported = false;
            return false;
        }
    }

    // Calculate system energies (useful for monitoring conservation)
    calculateEnergies(bodies) {
        if (!this.isReady() || bodies.length === 0) {
            return { kinetic: 0, potential: 0, total: 0 };
        }

        try {
            // Prepare data arrays
            const positionsX = new Float32Array(this.maxBodies);
            const positionsY = new Float32Array(this.maxBodies);
            const velocitiesX = new Float32Array(this.maxBodies);
            const velocitiesY = new Float32Array(this.maxBodies);
            const masses = new Float32Array(this.maxBodies);
            
            for (let i = 0; i < bodies.length; i++) {
                const body = bodies[i];
                positionsX[i] = body.position.x;
                positionsY[i] = body.position.y;
                velocitiesX[i] = body.velocity.x;
                velocitiesY[i] = body.velocity.y;
                masses[i] = body.mass;
            }
            
            // Calculate energies on GPU
            const energies = this.calculateEnergiesKernel(
                positionsX, positionsY, velocitiesX, velocitiesY, masses,
                this.gravitationalConstant, bodies.length
            );
            
            // Sum up energies
            let totalKinetic = 0;
            let totalPotential = 0;
            
            for (let i = 0; i < bodies.length; i++) {
                totalKinetic += energies[i][0];
                totalPotential += energies[i][1];
            }
            
            return {
                kinetic: totalKinetic,
                potential: totalPotential,
                total: totalKinetic + totalPotential
            };
            
        } catch (error) {
            console.error('Energy calculation error:', error);
            return { kinetic: 0, potential: 0, total: 0 };
        }
    }

    // Performance and status methods
    isReady() {
        return this.isSupported && this.isInitialized && this.gpu && this.calculateForcesKernel;
    }

    getPerformanceStats() {
        return {
            gpuTime: this.performanceStats.gpuTime,
            isActive: this.isSupported && this.currentBodyCount > 0,
            bodyCount: this.currentBodyCount,
            maxBodies: this.maxBodies,
            mode: this.gpu ? this.gpu.mode : 'unavailable'
        };
    }
    
    getPerformanceInfo() {
        if (!this.gpu) {
            return {
                isSupported: false,
                maxBodies: 0,
                mode: 'unavailable',
                lastGpuTime: 0
            };
        }
        
        return {
            isSupported: this.isSupported,
            maxBodies: this.maxBodies,
            currentBodies: this.currentBodyCount,
            mode: this.gpu.mode,
            lastGpuTime: this.performanceStats.gpuTime,
            maxTexSize: this.gpu.maxTexSize
        };
    }

    // Configuration methods
    setGravitationalConstant(value) {
        this.gravitationalConstant = value;
    }

    setSofteningFactor(value) {
        this.softeningFactor = value;
    }

    // Cleanup
    cleanup() {
        if (this.calculateForcesKernel) {
            this.calculateForcesKernel.destroy();
            this.calculateForcesKernel = null;
        }
        
        if (this.updatePositionsKernel) {
            this.updatePositionsKernel.destroy();
            this.updatePositionsKernel = null;
        }
        
        if (this.calculateEnergiesKernel) {
            this.calculateEnergiesKernel.destroy();
            this.calculateEnergiesKernel = null;
        }
        
        if (this.gpu) {
            this.gpu.destroy();
            this.gpu = null;
        }
        
        this.isSupported = false;
        this.isInitialized = false;
    }

    dispose() {
        this.cleanup();
    }
}

// Export for use in main application
window.GPUPhysicsEngine = GPUPhysicsEngine;