/**
 * Enhanced Barnes-Hut Algorithm with optimized memory layout and force calculation
 * Based on the C++ reference implementation for maximum performance
 */

class OptimizedQuadTree {
    constructor(bounds, maxBodies = 1, depth = 0, maxDepth = 20) {
        this.bounds = bounds; // {x, y, width, height}
        this.maxBodies = maxBodies;
        this.depth = depth;
        this.maxDepth = maxDepth;
        
        // Structure of Arrays (SoA) for better memory layout and cache performance
        this.bodyCount = 0;
        this.maxCapacity = 16; // Will grow dynamically
        
        // Use typed arrays for better performance
        this.positions = new Float32Array(this.maxCapacity * 2); // [x1, y1, x2, y2, ...]
        this.masses = new Float32Array(this.maxCapacity);
        this.bodyIds = new Uint32Array(this.maxCapacity); // References to original bodies
        
        // Center of mass and total mass
        this.centerOfMass = { x: 0, y: 0 };
        this.totalMass = 0;
        
        // Children nodes
        this.children = null;
        this.divided = false;
        
        // Performance optimization: pre-allocate child bounds
        this.childBounds = null;
        this.precomputeChildBounds();
    }

    /**
     * Pre-compute child bounds for faster subdivision
     */
    precomputeChildBounds() {
        const halfWidth = this.bounds.width / 2;
        const halfHeight = this.bounds.height / 2;
        
        this.childBounds = {
            nw: { x: this.bounds.x, y: this.bounds.y, width: halfWidth, height: halfHeight },
            ne: { x: this.bounds.x + halfWidth, y: this.bounds.y, width: halfWidth, height: halfHeight },
            sw: { x: this.bounds.x, y: this.bounds.y + halfHeight, width: halfWidth, height: halfHeight },
            se: { x: this.bounds.x + halfWidth, y: this.bounds.y + halfHeight, width: halfWidth, height: halfHeight }
        };
    }

    /**
     * Resize internal arrays when capacity is exceeded
     */
    resize(newCapacity) {
        const oldPositions = this.positions;
        const oldMasses = this.masses;
        const oldBodyIds = this.bodyIds;
        
        this.maxCapacity = newCapacity;
        this.positions = new Float32Array(newCapacity * 2);
        this.masses = new Float32Array(newCapacity);
        this.bodyIds = new Uint32Array(newCapacity);
        
        // Copy old data
        this.positions.set(oldPositions.subarray(0, this.bodyCount * 2));
        this.masses.set(oldMasses.subarray(0, this.bodyCount));
        this.bodyIds.set(oldBodyIds.subarray(0, this.bodyCount));
    }

    /**
     * Insert a body into the quadtree (optimized version)
     */
    insert(body, bodyId) {
        // Check bounds
        if (!this.contains(body.position)) {
            return false;
        }

        // If we have room and no children, add the body
        if (this.bodyCount < this.maxBodies && !this.divided) {
            // Resize if needed
            if (this.bodyCount >= this.maxCapacity) {
                this.resize(this.maxCapacity * 2);
            }
            
            // Add body using SoA layout
            const idx = this.bodyCount;
            this.positions[idx * 2] = body.position.x;
            this.positions[idx * 2 + 1] = body.position.y;
            this.masses[idx] = body.mass;
            this.bodyIds[idx] = bodyId;
            this.bodyCount++;
            
            this.updateCenterOfMass();
            return true;
        }

        // Check depth limit
        if (this.depth >= this.maxDepth) {
            // Force add to this node
            if (this.bodyCount >= this.maxCapacity) {
                this.resize(this.maxCapacity * 2);
            }
            
            const idx = this.bodyCount;
            this.positions[idx * 2] = body.position.x;
            this.positions[idx * 2 + 1] = body.position.y;
            this.masses[idx] = body.mass;
            this.bodyIds[idx] = bodyId;
            this.bodyCount++;
            
            this.updateCenterOfMass();
            return true;
        }

        // Subdivide if not already divided
        if (!this.divided) {
            this.subdivide();
        }

        // Try to insert into children
        const inserted = (
            this.children.nw.insert(body, bodyId) ||
            this.children.ne.insert(body, bodyId) ||
            this.children.sw.insert(body, bodyId) ||
            this.children.se.insert(body, bodyId)
        );

        if (inserted) {
            this.updateCenterOfMass();
        }

        return inserted;
    }

    /**
     * Optimized subdivision using pre-computed bounds
     */
    subdivide() {
        if (this.divided) return;

        this.children = {
            nw: new OptimizedQuadTree(this.childBounds.nw, this.maxBodies, this.depth + 1, this.maxDepth),
            ne: new OptimizedQuadTree(this.childBounds.ne, this.maxBodies, this.depth + 1, this.maxDepth),
            sw: new OptimizedQuadTree(this.childBounds.sw, this.maxBodies, this.depth + 1, this.maxDepth),
            se: new OptimizedQuadTree(this.childBounds.se, this.maxBodies, this.depth + 1, this.maxDepth)
        };

        this.divided = true;

        // Redistribute bodies to children
        for (let i = 0; i < this.bodyCount; i++) {
            const bodyPos = {
                x: this.positions[i * 2],
                y: this.positions[i * 2 + 1]
            };
            const bodyMass = this.masses[i];
            const bodyId = this.bodyIds[i];
            
            // Create temporary body object for insertion
            const tempBody = { position: bodyPos, mass: bodyMass };
            
            this.children.nw.insert(tempBody, bodyId) ||
            this.children.ne.insert(tempBody, bodyId) ||
            this.children.sw.insert(tempBody, bodyId) ||
            this.children.se.insert(tempBody, bodyId);
        }

        // Clear bodies from this node
        this.bodyCount = 0;
        this.updateCenterOfMass();
    }

    /**
     * Optimized center of mass calculation
     */
    updateCenterOfMass() {
        let totalMass = 0;
        let massX = 0;
        let massY = 0;

        // Add contribution from direct bodies (vectorized)
        for (let i = 0; i < this.bodyCount; i++) {
            const mass = this.masses[i];
            const x = this.positions[i * 2];
            const y = this.positions[i * 2 + 1];
            
            totalMass += mass;
            massX += x * mass;
            massY += y * mass;
        }

        // Add contribution from children
        if (this.divided) {
            const childNodes = [this.children.nw, this.children.ne, this.children.sw, this.children.se];
            for (const child of childNodes) {
                if (child.totalMass > 0) {
                    totalMass += child.totalMass;
                    massX += child.centerOfMass.x * child.totalMass;
                    massY += child.centerOfMass.y * child.totalMass;
                }
            }
        }

        this.totalMass = totalMass;
        if (totalMass > 0) {
            this.centerOfMass.x = massX / totalMass;
            this.centerOfMass.y = massY / totalMass;
        } else {
            this.centerOfMass.x = this.bounds.x + this.bounds.width / 2;
            this.centerOfMass.y = this.bounds.y + this.bounds.height / 2;
        }
    }

    /**
     * Enhanced force calculation with optimized traversal
     * Based on the C++ implementation's shared memory approach
     */
    calculateForce(body, gravitationalConstant, softeningParameter, theta = 0.5) {
        // Use a pre-allocated force accumulator
        const force = { x: 0, y: 0 };
        
        // Stack-based traversal to avoid recursion overhead
        const nodeStack = [this];
        
        while (nodeStack.length > 0) {
            const node = nodeStack.pop();
            
            // Skip empty nodes
            if (node.totalMass === 0) continue;
            
            // Calculate distance and size
            const dx = node.centerOfMass.x - body.position.x;
            const dy = node.centerOfMass.y - body.position.y;
            const distanceSquared = dx * dx + dy * dy;
            const nodeSize = Math.max(node.bounds.width, node.bounds.height);
            const nodeSizeSquared = nodeSize * nodeSize;
            
            // Apply Barnes-Hut criteria or if it's a leaf node
            if (!node.divided || nodeSizeSquared < theta * theta * distanceSquared) {
                // For leaf nodes with bodies, calculate directly to avoid self-interaction
                if (!node.divided && node.bodyCount > 0) {
                    for (let i = 0; i < node.bodyCount; i++) {
                        const bx = node.positions[i * 2];
                        const by = node.positions[i * 2 + 1];
                        const bMass = node.masses[i];
                        
                        const bdx = bx - body.position.x;
                        const bdy = by - body.position.y;
                        const bDistanceSquared = bdx * bdx + bdy * bdy;
                        
                        // Skip self-interaction (same position means it's the same body)
                        if (bDistanceSquared < 1e-10) continue;
                        
                        const effectiveDistanceSquared = bDistanceSquared + softeningParameter * softeningParameter;
                        const invDistance = 1.0 / Math.sqrt(effectiveDistanceSquared);
                        const invDistanceCubed = invDistance * invDistance * invDistance;
                        const forceStrength = gravitationalConstant * bMass * invDistanceCubed;
                        
                        force.x += bdx * forceStrength;
                        force.y += bdy * forceStrength;
                    }
                } else if (distanceSquared > 0) {
                    // Internal node treated as single body
                    const effectiveDistanceSquared = distanceSquared + softeningParameter * softeningParameter;
                    const invDistance = 1.0 / Math.sqrt(effectiveDistanceSquared);
                    const invDistanceCubed = invDistance * invDistance * invDistance;
                    const forceStrength = gravitationalConstant * node.totalMass * invDistanceCubed;
                    
                    force.x += dx * forceStrength;
                    force.y += dy * forceStrength;
                }
            } else {
                // Add children to stack for further processing
                nodeStack.push(node.children.nw, node.children.ne, node.children.sw, node.children.se);
            }
        }
        
        return force;
    }

    /**
     * Optimized bounds checking
     */
    contains(position) {
        return position.x >= this.bounds.x &&
               position.x < this.bounds.x + this.bounds.width &&
               position.y >= this.bounds.y &&
               position.y < this.bounds.y + this.bounds.height;
    }

    /**
     * Clear the tree for reuse
     */
    clear() {
        this.bodyCount = 0;
        this.totalMass = 0;
        this.centerOfMass.x = 0;
        this.centerOfMass.y = 0;
        this.divided = false;
        this.children = null;
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        let totalNodes = 1;
        let totalBodies = this.bodyCount;
        let maxDepthReached = this.depth;
        
        if (this.divided) {
            const childStats = [
                this.children.nw.getMemoryStats(),
                this.children.ne.getMemoryStats(),
                this.children.sw.getMemoryStats(),
                this.children.se.getMemoryStats()
            ];
            
            for (const stats of childStats) {
                totalNodes += stats.nodes;
                totalBodies += stats.bodies;
                maxDepthReached = Math.max(maxDepthReached, stats.maxDepth);
            }
        }
        
        return {
            nodes: totalNodes,
            bodies: totalBodies,
            maxDepth: maxDepthReached,
            memoryUsage: {
                positions: this.positions.byteLength,
                masses: this.masses.byteLength,
                bodyIds: this.bodyIds.byteLength
            }
        };
    }
}

/**
 * Enhanced Barnes-Hut Force Calculator with optimized algorithms
 */
class OptimizedBarnesHutForceCalculator {
    constructor() {
        this.tree = null;
        this.theta = 0.5; // Barnes-Hut approximation parameter
        this.stats = {
            forceCalculations: 0,
            treeConstructionTime: 0,
            forceCalculationTime: 0,
            totalBodies: 0
        };
    }

    /**
     * Calculate forces for all bodies using optimized Barnes-Hut
     */
    calculateForces(bodies, gravitationalConstant, softeningParameter) {
        const startTime = performance.now();
        
        // Reset statistics
        this.stats.forceCalculations = 0;
        this.stats.totalBodies = bodies.length;
        
        // Build tree with optimized bounds calculation
        const constructionStart = performance.now();
        this.buildTree(bodies);
        this.stats.treeConstructionTime = performance.now() - constructionStart;
        
        // Calculate forces
        const forceStart = performance.now();
        const forces = new Array(bodies.length);
        
        for (let i = 0; i < bodies.length; i++) {
            forces[i] = this.tree.calculateForce(bodies[i], gravitationalConstant, softeningParameter, this.theta);
            this.stats.forceCalculations++;
        }
        
        this.stats.forceCalculationTime = performance.now() - forceStart;
        
        return forces;
    }

    /**
     * Build tree with optimized bounds calculation
     */
    buildTree(bodies) {
        if (bodies.length === 0) return;
        
        // Calculate bounds more efficiently
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const body of bodies) {
            minX = Math.min(minX, body.position.x);
            maxX = Math.max(maxX, body.position.x);
            minY = Math.min(minY, body.position.y);
            maxY = Math.max(maxY, body.position.y);
        }
        
        // Add padding to bounds
        const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
        const bounds = {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + 2 * padding,
            height: maxY - minY + 2 * padding
        };
        
        // Create new tree
        this.tree = new OptimizedQuadTree(bounds);
        
        // Insert all bodies
        for (let i = 0; i < bodies.length; i++) {
            this.tree.insert(bodies[i], i);
        }
    }

    /**
     * Get performance statistics
     */
    getStats() {
        const treeStats = this.tree ? this.tree.getMemoryStats() : { nodes: 0, bodies: 0, maxDepth: 0 };
        
        return {
            ...this.stats,
            efficiency: this.stats.totalBodies > 0 ? this.stats.forceCalculations / (this.stats.totalBodies * this.stats.totalBodies) : 0,
            treeStats
        };
    }

    /**
     * Set Barnes-Hut approximation parameter
     */
    setTheta(theta) {
        this.theta = Math.max(0.1, Math.min(1.0, theta));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OptimizedQuadTree, OptimizedBarnesHutForceCalculator };
}
