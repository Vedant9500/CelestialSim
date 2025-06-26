/**
 * Barnes-Hut Algorithm implementation for efficient N-body force calculations
 * Reduces complexity from O(N²) to O(N log N) using spatial subdivision
 */

class QuadTree {
    constructor(bounds, maxBodies = 1) {
        this.bounds = bounds; // {x, y, width, height}
        this.maxBodies = maxBodies;
        this.bodies = [];
        this.children = null;
        this.centerOfMass = null;
        this.totalMass = 0;
        this.divided = false;
    }

    /**
     * Insert a body into the quadtree
     */
    insert(body) {
        // Check if body is within bounds
        if (!this.contains(body.position)) {
            return false;
        }

        // If we have room and no children, add the body
        if (this.bodies.length < this.maxBodies && !this.divided) {
            this.bodies.push(body);
            this.updateCenterOfMass();
            return true;
        }

        // Otherwise, subdivide if not already divided
        if (!this.divided) {
            this.subdivide();
        }

        // Try to insert into children
        return (
            this.children.nw.insert(body) ||
            this.children.ne.insert(body) ||
            this.children.sw.insert(body) ||
            this.children.se.insert(body)
        );
    }

    /**
     * Check if a point is within this quadrant
     */
    contains(point) {
        return (
            point.x >= this.bounds.x &&
            point.x < this.bounds.x + this.bounds.width &&
            point.y >= this.bounds.y &&
            point.y < this.bounds.y + this.bounds.height
        );
    }

    /**
     * Subdivide this quadrant into four children
     */
    subdivide() {
        const x = this.bounds.x;
        const y = this.bounds.y;
        const w = this.bounds.width / 2;
        const h = this.bounds.height / 2;

        this.children = {
            nw: new QuadTree({ x: x, y: y, width: w, height: h }, this.maxBodies),
            ne: new QuadTree({ x: x + w, y: y, width: w, height: h }, this.maxBodies),
            sw: new QuadTree({ x: x, y: y + h, width: w, height: h }, this.maxBodies),
            se: new QuadTree({ x: x + w, y: y + h, width: w, height: h }, this.maxBodies)
        };

        this.divided = true;

        // Redistribute existing bodies to children
        for (const body of this.bodies) {
            this.children.nw.insert(body) ||
            this.children.ne.insert(body) ||
            this.children.sw.insert(body) ||
            this.children.se.insert(body);
        }

        // Clear bodies from this node (they're now in children)
        this.bodies = [];
        this.updateCenterOfMass();
    }

    /**
     * Update center of mass for this node
     */
    updateCenterOfMass() {
        let totalMass = 0;
        let massX = 0;
        let massY = 0;

        // Add contribution from direct bodies
        for (const body of this.bodies) {
            totalMass += body.mass;
            massX += body.position.x * body.mass;
            massY += body.position.y * body.mass;
        }

        // Add contribution from children
        if (this.divided) {
            for (const child of Object.values(this.children)) {
                if (child.totalMass > 0) {
                    totalMass += child.totalMass;
                    massX += child.centerOfMass.x * child.totalMass;
                    massY += child.centerOfMass.y * child.totalMass;
                }
            }
        }

        this.totalMass = totalMass;
        if (totalMass > 0) {
            this.centerOfMass = new Vector2D(massX / totalMass, massY / totalMass);
        } else {
            this.centerOfMass = new Vector2D(
                this.bounds.x + this.bounds.width / 2,
                this.bounds.y + this.bounds.height / 2
            );
        }
    }

    /**
     * Calculate force on a body using Barnes-Hut approximation
     */
    calculateForce(body, theta = 0.5, gravitationalConstant = 100) {
        // If this is an empty node, return zero force
        if (this.totalMass === 0) {
            return new Vector2D(0, 0);
        }

        // Calculate distance to center of mass
        const distance = body.position.distance(this.centerOfMass);
        
        // Avoid self-interaction
        if (distance === 0) {
            return new Vector2D(0, 0);
        }

        // Calculate the ratio s/d where s is the width of the region
        const s = Math.max(this.bounds.width, this.bounds.height);
        const ratio = s / distance;

        // If the node is sufficiently far away (s/d < θ), treat as single body
        if (ratio < theta || !this.divided) {
            const direction = this.centerOfMass.subtract(body.position);
            const distanceSquared = distance * distance;
            const forceMagnitude = gravitationalConstant * body.mass * this.totalMass / distanceSquared;
            
            return direction.normalize().multiply(forceMagnitude);
        }

        // Otherwise, recursively calculate force from children
        let totalForce = new Vector2D(0, 0);
        if (this.divided) {
            for (const child of Object.values(this.children)) {
                totalForce = totalForce.add(child.calculateForce(body, theta, gravitationalConstant));
            }
        }

        return totalForce;
    }

    /**
     * Query all bodies in a given range (for debugging/visualization)
     */
    query(range, found = []) {
        // Check if range intersects with this quadrant
        if (!this.intersects(range)) {
            return found;
        }

        // Add bodies in this quadrant that are within range
        for (const body of this.bodies) {
            if (this.pointInRange(body.position, range)) {
                found.push(body);
            }
        }

        // Recursively search children
        if (this.divided) {
            this.children.nw.query(range, found);
            this.children.ne.query(range, found);
            this.children.sw.query(range, found);
            this.children.se.query(range, found);
        }

        return found;
    }

    /**
     * Check if this quadrant intersects with a range
     */
    intersects(range) {
        return !(
            range.x > this.bounds.x + this.bounds.width ||
            range.x + range.width < this.bounds.x ||
            range.y > this.bounds.y + this.bounds.height ||
            range.y + range.height < this.bounds.y
        );
    }

    /**
     * Check if a point is within a range
     */
    pointInRange(point, range) {
        return (
            point.x >= range.x &&
            point.x <= range.x + range.width &&
            point.y >= range.y &&
            point.y <= range.y + range.height
        );
    }

    /**
     * Get all bodies in the tree (for debugging)
     */
    getAllBodies() {
        let allBodies = [...this.bodies];
        
        if (this.divided) {
            for (const child of Object.values(this.children)) {
                allBodies = allBodies.concat(child.getAllBodies());
            }
        }
        
        return allBodies;
    }
}

/**
 * Barnes-Hut force calculator
 */
class BarnesHutCalculator {
    constructor(theta = 0.5) {
        this.theta = theta; // Barnes-Hut approximation parameter
    }

    /**
     * Calculate forces for all bodies using Barnes-Hut algorithm
     */
    calculateForces(bodies, gravitationalConstant = 100) {
        if (bodies.length === 0) return;

        // Reset all forces
        bodies.forEach(body => body.resetForce());

        // Find bounds for the quadtree
        const bounds = this.calculateBounds(bodies);
        
        // Build the quadtree
        const quadTree = new QuadTree(bounds);
        for (const body of bodies) {
            quadTree.insert(body);
        }

        // Calculate forces for each body
        for (const body of bodies) {
            const force = quadTree.calculateForce(body, this.theta, gravitationalConstant);
            body.force = body.force.add(force);
        }
    }

    /**
     * Calculate bounds that encompass all bodies with some padding
     */
    calculateBounds(bodies) {
        if (bodies.length === 0) {
            return { x: -1000, y: -1000, width: 2000, height: 2000 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const body of bodies) {
            minX = Math.min(minX, body.position.x);
            minY = Math.min(minY, body.position.y);
            maxX = Math.max(maxX, body.position.x);
            maxY = Math.max(maxY, body.position.y);
        }

        // Add 20% padding
        const padding = 0.2;
        const width = maxX - minX;
        const height = maxY - minY;
        const padX = width * padding;
        const padY = height * padding;

        return {
            x: minX - padX,
            y: minY - padY,
            width: width + 2 * padX,
            height: height + 2 * padY
        };
    }

    /**
     * Set the theta parameter for approximation quality
     * Lower theta = more accurate but slower
     * Higher theta = less accurate but faster
     */
    setTheta(theta) {
        this.theta = theta;
    }
}
