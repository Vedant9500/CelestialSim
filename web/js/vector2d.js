class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Static methods for creating vectors
    static zero() {
        return new Vector2D(0, 0);
    }

    static fromAngle(angle, magnitude = 1) {
        return new Vector2D(
            Math.cos(angle) * magnitude,
            Math.sin(angle) * magnitude
        );
    }

    static random(minMagnitude = 0, maxMagnitude = 1) {
        const angle = Math.random() * Math.PI * 2;
        const magnitude = minMagnitude + Math.random() * (maxMagnitude - minMagnitude);
        return Vector2D.fromAngle(angle, magnitude);
    }

    // Basic arithmetic operations
    add(other) {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    multiply(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }

    divide(scalar) {
        if (Math.abs(scalar) < Number.EPSILON) {
            console.warn('Vector2D: Division by near-zero value detected, returning zero vector');
            return new Vector2D(0, 0);
        }
        return new Vector2D(this.x / scalar, this.y / scalar);
    }

    // Mutating operations
    addMut(other) {
        if (!other || typeof other.x !== 'number' || typeof other.y !== 'number') {
            console.warn('Vector2D: Invalid vector in addMut operation');
            return this;
        }
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subtractMut(other) {
        if (!other || typeof other.x !== 'number' || typeof other.y !== 'number') {
            console.warn('Vector2D: Invalid vector in subtractMut operation');
            return this;
        }
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    multiplyMut(scalar) {
        if (typeof scalar !== 'number' || !isFinite(scalar)) {
            console.warn('Vector2D: Invalid scalar in multiplyMut operation');
            return this;
        }
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    divideMut(scalar) {
        if (Math.abs(scalar) < Number.EPSILON) {
            console.warn('Vector2D: Division by near-zero value in divideMut, no operation performed');
            return this;
        }
        this.x /= scalar;
        this.y /= scalar;
        return this;
    }

    // Vector properties
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    magnitudeSquared() {
        return this.x * this.x + this.y * this.y;
    }

    distance(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceSquared(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return dx * dx + dy * dy;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    // Vector normalization
    normalize() {
        const mag = this.magnitude();
        if (mag > 0) {
            return this.divide(mag);
        }
        return new Vector2D(0, 0);
    }

    normalizeMut() {
        const mag = this.magnitude();
        if (mag > 0) {
            this.divideMut(mag);
        }
        return this;
    }

    // Dot and cross products
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    cross(other) {
        return this.x * other.y - this.y * other.x;
    }

    // Vector rotation
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2D(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    rotateMut(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    // Projection
    project(other) {
        const otherMagSq = other.magnitudeSquared();
        if (otherMagSq === 0) return new Vector2D(0, 0);
        const dotProduct = this.dot(other);
        return other.multiply(dotProduct / otherMagSq);
    }

    // Reflection
    reflect(normal) {
        const normalizedNormal = normal.normalize();
        return this.subtract(normalizedNormal.multiply(2 * this.dot(normalizedNormal)));
    }

    // Linear interpolation
    lerp(other, t) {
        const clampedT = Math.max(0, Math.min(1, t));
        return new Vector2D(
            this.x + (other.x - this.x) * clampedT,
            this.y + (other.y - this.y) * clampedT
        );
    }

    // Limit magnitude
    limit(maxMagnitude) {
        const mag = this.magnitude();
        if (mag > maxMagnitude) {
            return this.normalize().multiply(maxMagnitude);
        }
        return new Vector2D(this.x, this.y);
    }

    limitMut(maxMagnitude) {
        const mag = this.magnitude();
        if (mag > maxMagnitude) {
            this.normalizeMut().multiplyMut(maxMagnitude);
        }
        return this;
    }

    // Utility methods
    clone() {
        return new Vector2D(this.x, this.y);
    }

    equals(other, epsilon = 1e-10) {
        return Math.abs(this.x - other.x) < epsilon && Math.abs(this.y - other.y) < epsilon;
    }

    toString() {
        return `Vector2D(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }

    toArray() {
        return [this.x, this.y];
    }

    fromArray(array) {
        this.x = array[0] || 0;
        this.y = array[1] || 0;
        return this;
    }

    // Check if vector is zero
    isZero(epsilon = 1e-10) {
        return this.magnitudeSquared() < epsilon * epsilon;
    }

    // Get perpendicular vector (rotate 90 degrees counterclockwise)
    perpendicular() {
        return new Vector2D(-this.y, this.x);
    }

    // Set components
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    setFromVector(other) {
        this.x = other.x;
        this.y = other.y;
        return this;
    }
}
