class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // Camera system
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0,
            targetZoom: 1.0,
            smoothing: 0.1
        };
        
        // Visual settings
        this.showTrails = true;
        this.showGrid = true;
        this.showForces = false;
        this.showInfo = true;
        this.showCenterOfMass = false;
        
        // Performance settings
        this.maxTrailPoints = 100;
        this.particleEffects = true;
        
        // Visual effects
        this.glowEffect = true;
        this.antiAliasing = true;
        
        // Orbit preview
        this.showOrbitPreview = false;
        this.orbitPreviewPoints = [];
        this.orbitPreviewMaxPoints = 1200;
        this.orbitPreviewSteps = 4000; // More steps for ultra-smooth orbits
        this.orbitPreviewTimeStep = 0.002; // Smaller timestep for smoothness
        
        // Grid settings
        this.gridSpacing = 50;
        this.gridColor = 'rgba(100, 255, 218, 0.1)';
        
        // Color schemes
        this.backgroundColor = '#000000';
        this.textColor = '#ffffff';
        this.selectionColor = '#64ffda';
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 60;
        
        this.setupCanvas();
    }

    setupCanvas() {
        // Use the device pixel ratio provided by the app or default
        const dpr = this.devicePixelRatio || window.devicePixelRatio || 1;
        
        // Scale the context to ensure crisp rendering
        this.ctx.scale(dpr, dpr);
        
        // Update internal dimensions
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Enable anti-aliasing
        if (this.antiAliasing) {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        }
    }

    // Clear the canvas
    clear() {
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Main render function
    render(bodies, physicsEngine, selectedBody = null) {
        this.clear();
        
        // Update camera
        this.updateCamera();
        
        // Save context state
        this.ctx.save();
        
        // Apply camera transformation
        this.applyCamera();
        
        // Draw grid
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // Draw center cross
        this.drawCenterCross();
        
        // Draw center of mass
        if (this.showCenterOfMass && bodies.length > 1) {
            const centerOfMass = physicsEngine.getCenterOfMass(bodies);
            this.drawCenterOfMass(centerOfMass);
        }
        
        // Draw trails
        if (this.showTrails) {
            this.drawTrails(bodies);
        }
        
        // Draw force vectors
        if (this.showForces) {
            this.drawForceVectors(bodies);
        }
        
        // Draw bodies
        this.drawBodies(bodies, selectedBody);
        
        // Draw orbit preview
        this.drawOrbitPreview();
        
        // Restore context state
        this.ctx.restore();
        
        // Draw UI overlays
        this.drawUIOverlays(bodies, physicsEngine, selectedBody);
        
        // Update performance metrics
        this.updatePerformanceMetrics();
    }

    updateCamera() {
        // Smooth zoom transition
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.smoothing;
    }

    applyCamera() {
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);
    }

    drawGrid() {
        const spacing = this.gridSpacing;
        const zoom = this.camera.zoom;
        const effectiveSpacing = spacing * zoom;
        
        // Only draw grid if spacing is large enough
        if (effectiveSpacing < 20) return;
        
        this.ctx.strokeStyle = this.gridColor;
        this.ctx.lineWidth = 1 / zoom;
        
        const startX = Math.floor((this.camera.x - this.width / (2 * zoom)) / spacing) * spacing;
        const endX = Math.ceil((this.camera.x + this.width / (2 * zoom)) / spacing) * spacing;
        const startY = Math.floor((this.camera.y - this.height / (2 * zoom)) / spacing) * spacing;
        const endY = Math.ceil((this.camera.y + this.height / (2 * zoom)) / spacing) * spacing;
        
        this.ctx.beginPath();
        
        // Vertical lines
        for (let x = startX; x <= endX; x += spacing) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y += spacing) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        
        this.ctx.stroke();
    }

    drawCenterCross() {
        this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.8)';
        this.ctx.lineWidth = 2 / this.camera.zoom;
        
        const size = 20 / this.camera.zoom;
        
        this.ctx.beginPath();
        this.ctx.moveTo(-size, 0);
        this.ctx.lineTo(size, 0);
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(0, size);
        this.ctx.stroke();
    }

    drawCenterOfMass(centerOfMass) {
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 1.0)';
        this.ctx.lineWidth = 2 / this.camera.zoom;
        
        const size = 8 / this.camera.zoom;
        
        this.ctx.beginPath();
        this.ctx.arc(centerOfMass.x, centerOfMass.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw cross
        this.ctx.beginPath();
        this.ctx.moveTo(centerOfMass.x - size, centerOfMass.y);
        this.ctx.lineTo(centerOfMass.x + size, centerOfMass.y);
        this.ctx.moveTo(centerOfMass.x, centerOfMass.y - size);
        this.ctx.lineTo(centerOfMass.x, centerOfMass.y + size);
        this.ctx.stroke();
    }

    drawTrails(bodies) {
        bodies.forEach(body => {
            if (body.trail.length < 2) return;
            
            const trail = body.trail.slice(-this.maxTrailPoints);
            
            for (let i = 1; i < trail.length; i++) {
                const alpha = (i / trail.length) * 0.8;
                const thickness = (i / trail.length) * 3 + 0.5;
                
                this.ctx.strokeStyle = this.hexToRgba(body.color, alpha);
                this.ctx.lineWidth = thickness / this.camera.zoom;
                this.ctx.lineCap = 'round';
                
                this.ctx.beginPath();
                this.ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                this.ctx.lineTo(trail[i].x, trail[i].y);
                this.ctx.stroke();
            }
        });
    }

    drawForceVectors(bodies) {
        const scale = 0.001; // Scale factor for force visualization
        
        bodies.forEach(body => {
            if (body.force.isZero()) return;
            
            const forceScale = scale / this.camera.zoom;
            const endPoint = body.position.add(body.force.multiply(forceScale));
            
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            this.ctx.lineWidth = 2 / this.camera.zoom;
            this.ctx.lineCap = 'round';
            
            // Draw force vector
            this.ctx.beginPath();
            this.ctx.moveTo(body.position.x, body.position.y);
            this.ctx.lineTo(endPoint.x, endPoint.y);
            this.ctx.stroke();
            
            // Draw arrowhead
            const arrowSize = 5 / this.camera.zoom;
            const angle = body.force.angle();
            
            this.ctx.beginPath();
            this.ctx.moveTo(endPoint.x, endPoint.y);
            this.ctx.lineTo(
                endPoint.x - arrowSize * Math.cos(angle - 0.5),
                endPoint.y - arrowSize * Math.sin(angle - 0.5)
            );
            this.ctx.moveTo(endPoint.x, endPoint.y);
            this.ctx.lineTo(
                endPoint.x - arrowSize * Math.cos(angle + 0.5),
                endPoint.y - arrowSize * Math.sin(angle + 0.5)
            );
            this.ctx.stroke();
        });
    }

    drawBodies(bodies, selectedBody) {
        // Sort bodies by size for proper rendering order
        const sortedBodies = [...bodies].sort((a, b) => b.radius - a.radius);
        
        sortedBodies.forEach(body => {
            this.drawBody(body, body === selectedBody);
        });
    }

    drawBody(body, isSelected = false) {
        // Validate body and its properties
        if (!body || !body.position || !isFinite(body.radius) || body.radius <= 0) {
            return; // Skip invalid bodies
        }
        
        // Use world radius and let camera transformation handle scaling
        // But ensure minimum screen visibility
        const minScreenRadius = 2; // minimum pixels on screen
        const worldRadius = body.radius;
        const screenRadius = worldRadius * this.camera.zoom;
        const radius = screenRadius < minScreenRadius ? minScreenRadius / this.camera.zoom : worldRadius;
        
        const x = body.position.x;
        const y = body.position.y;
        
        // Validate coordinates
        if (!isFinite(x) || !isFinite(y)) {
            return; // Skip bodies with invalid positions
        }
        
        // Glow effect for selected body
        if (isSelected && this.glowEffect) {
            this.drawGlow(x, y, radius, body.color);
        }
        
        // Main body
        this.ctx.fillStyle = body.color;
        this.ctx.strokeStyle = isSelected ? this.selectionColor : 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = (isSelected ? 3 : 1) / this.camera.zoom;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Highlight
        if (radius > 5) {
            const highlightColor = this.lightenColor(body.color, 0.3);
            this.ctx.fillStyle = highlightColor;
            
            this.ctx.beginPath();
            this.ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Velocity vector for selected body (when paused)
        if (isSelected && !body.velocity.isZero()) {
            this.drawVelocityVector(body);
        }
        
        // Mass label for large bodies
        if (radius > 15 && this.camera.zoom > 0.5) {
            this.drawMassLabel(body);
        }
    }

    drawGlow(x, y, radius, color) {
        // Ensure we have valid, finite values
        if (!isFinite(x) || !isFinite(y) || !isFinite(radius) || radius <= 0) {
            return; // Skip drawing glow for invalid values
        }
        
        const glowRadius = radius * 2;
        
        // Double-check that both radii are valid
        if (!isFinite(glowRadius) || glowRadius <= radius) {
            return;
        }
        
        const gradient = this.ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
        
        gradient.addColorStop(0, this.hexToRgba(color, 0.3));
        gradient.addColorStop(1, this.hexToRgba(color, 0));
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawVelocityVector(body) {
        const scale = 3 / this.camera.zoom;
        const endPoint = body.position.add(body.velocity.multiply(scale));
        
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3 / this.camera.zoom;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(body.position.x, body.position.y);
        this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.stroke();
        
        // Arrowhead
        const arrowSize = 8 / this.camera.zoom;
        const angle = body.velocity.angle();
        
        this.ctx.beginPath();
        this.ctx.moveTo(endPoint.x, endPoint.y);
        this.ctx.lineTo(
            endPoint.x - arrowSize * Math.cos(angle - 0.3),
            endPoint.y - arrowSize * Math.sin(angle - 0.3)
        );
        this.ctx.lineTo(
            endPoint.x - arrowSize * Math.cos(angle + 0.3),
            endPoint.y - arrowSize * Math.sin(angle + 0.3)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawMassLabel(body) {
        this.ctx.fillStyle = this.textColor;
        this.ctx.font = `${Math.max(10, 14 / this.camera.zoom)}px Inter`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const massText = body.mass.toFixed(0);
        this.ctx.fillText(massText, body.position.x, body.position.y);
    }

    drawUIOverlays(bodies, physicsEngine, selectedBody) {
        // Reset transformation for UI elements
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Draw zoom level
        this.drawZoomLevel();
        
        // Draw body count
        this.drawBodyCount(bodies.length);
        
        // Draw energy information
        if (this.showInfo) {
            this.drawEnergyInfo(physicsEngine);
        }
        
        // Draw mouse coordinates
        // This will be handled by the main app
    }

    drawZoomLevel() {
        const zoomText = `${(this.camera.zoom * 100).toFixed(0)}%`;
        document.getElementById('zoom-level').textContent = zoomText;
    }

    drawBodyCount(count) {
        document.getElementById('body-count').textContent = count.toString();
    }

    drawEnergyInfo(physicsEngine) {
        document.getElementById('kinetic-energy').textContent = physicsEngine.totalKineticEnergy.toFixed(1);
        document.getElementById('potential-energy').textContent = physicsEngine.totalPotentialEnergy.toFixed(1);
    }

    // Camera controls
    setZoom(zoom, centerX = this.width / 2, centerY = this.height / 2) {
        const oldZoom = this.camera.targetZoom;
        this.camera.targetZoom = Math.max(0.1, Math.min(10, zoom));
        
        // Zoom towards point
        const worldPos = this.screenToWorld(centerX, centerY);
        const zoomRatio = this.camera.targetZoom / oldZoom;
        
        this.camera.x = worldPos.x - (worldPos.x - this.camera.x) / zoomRatio;
        this.camera.y = worldPos.y - (worldPos.y - this.camera.y) / zoomRatio;
    }

    zoomIn(centerX, centerY) {
        this.setZoom(this.camera.targetZoom * 1.2, centerX, centerY);
    }

    zoomOut(centerX, centerY) {
        this.setZoom(this.camera.targetZoom / 1.2, centerX, centerY);
    }

    panCamera(deltaX, deltaY) {
        this.camera.x += deltaX / this.camera.zoom;
        this.camera.y += deltaY / this.camera.zoom;
    }

    centerOnBodies(bodies) {
        if (bodies.length === 0) {
            this.camera.x = 0;
            this.camera.y = 0;
            return;
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
        
        this.camera.x = (minX + maxX) / 2;
        this.camera.y = (minY + maxY) / 2;
    }

    fitAllBodies(bodies) {
        if (bodies.length === 0) return;
        
        this.centerOnBodies(bodies);
        
        let minX = bodies[0].position.x;
        let maxX = bodies[0].position.x;
        let minY = bodies[0].position.y;
        let maxY = bodies[0].position.y;
        
        bodies.forEach(body => {
            minX = Math.min(minX, body.position.x - body.radius);
            maxX = Math.max(maxX, body.position.x + body.radius);
            minY = Math.min(minY, body.position.y - body.radius);
            maxY = Math.max(maxY, body.position.y + body.radius);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 1.2; // 20% padding
        
        const zoomX = (this.width * 0.8) / (width * padding);
        const zoomY = (this.height * 0.8) / (height * padding);
        
        this.camera.targetZoom = Math.min(zoomX, zoomY, 2.0);
    }

    // Coordinate conversion
    worldToScreen(worldX, worldY) {
        const canvasWidth = this.width / this.devicePixelRatio;
        const canvasHeight = this.height / this.devicePixelRatio;
        
        const screenX = (worldX - this.camera.x) * this.camera.zoom + canvasWidth / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + canvasHeight / 2;
        return new Vector2D(screenX, screenY);
    }

    screenToWorld(screenX, screenY) {
        // Convert from canvas coordinates to world coordinates
        // screenX and screenY should already be in canvas pixel coordinates
        const canvasWidth = this.width / this.devicePixelRatio;
        const canvasHeight = this.height / this.devicePixelRatio;
        
        const worldX = (screenX - canvasWidth / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - canvasHeight / 2) / this.camera.zoom + this.camera.y;
        return new Vector2D(worldX, worldY);
    }

    // Debugging method to troubleshoot coordinate conversion issues
    debugCoordinates() {
        const rect = this.canvas.getBoundingClientRect();
        console.log('Canvas Debug Info:', {
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            displayWidth: rect.width,
            displayHeight: rect.height,
            devicePixelRatio: this.devicePixelRatio,
            zoom: this.camera.zoom,
            cameraX: this.camera.x,
            cameraY: this.camera.y
        });
    }

    // Utility functions
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    lightenColor(hex, amount) {
        const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount * 255);
        const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount * 255);
        const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount * 255);
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    updatePerformanceMetrics() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }

    // Orbit Preview System
    calculateOrbitPreview(previewBody, existingBodies, physicsEngine) {
        this.orbitPreviewPoints = [];
        
        // Find the primary body to orbit around
        const targetBody = this.findPrimaryBody(previewBody.position, existingBodies);
        if (!targetBody) return { points: [], stable: false, collision: false };
        
        // Create a copy of the preview body for simulation
        const testBody = new Body(
            previewBody.position.clone(),
            previewBody.velocity.clone(),
            previewBody.mass,
            previewBody.color
        );
        
        // Create copies of existing bodies
        const testBodies = existingBodies.map(body => new Body(
            body.position.clone(),
            body.velocity.clone(),
            body.mass,
            body.color
        ));
        
        // Add the test body to the simulation
        testBodies.push(testBody);
        
        // Track orbital parameters for completion detection
        const initialPosition = testBody.position.clone();
        const centerPosition = targetBody.position.clone();
        let initialAngle = Math.atan2(
            initialPosition.y - centerPosition.y,
            initialPosition.x - centerPosition.x
        );
        
        let collisionDetected = false;
        let stableOrbit = true;
        let orbitCompleted = false;
        let angleSum = 0;
        let lastAngle = initialAngle;
        let minDistance = Infinity;
        let maxDistance = 0;
        let crossedInitialAngle = false;
        
        for (let step = 0; step < this.orbitPreviewSteps && !orbitCompleted; step++) {
            // Store position for preview
            const currentDistance = testBody.position.distance(centerPosition);
            minDistance = Math.min(minDistance, currentDistance);
            maxDistance = Math.max(maxDistance, currentDistance);
            
            this.orbitPreviewPoints.push({
                position: testBody.position.clone(),
                velocity: testBody.velocity.magnitude(),
                stable: !collisionDetected && stableOrbit,
                distance: currentDistance
            });
            
            // Calculate current angle relative to center
            const currentAngle = Math.atan2(
                testBody.position.y - centerPosition.y,
                testBody.position.x - centerPosition.x
            );
            
            // Track angle changes to detect orbit completion
            let angleDiff = currentAngle - lastAngle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            angleSum += angleDiff;
            lastAngle = currentAngle;
            
            // Check if we've completed approximately one orbit (2π radians)
            if (Math.abs(angleSum) > 1.8 * Math.PI && step > 100) {
                // Check if we're close to the starting position
                const distanceFromStart = testBody.position.distance(initialPosition);
                const averageDistance = (minDistance + maxDistance) / 2;
                
                if (distanceFromStart < averageDistance * 0.3) {
                    orbitCompleted = true;
                    stableOrbit = true;
                }
            }
            
            // Check for collisions with other bodies
            for (const otherBody of testBodies) {
                if (otherBody !== testBody) {
                    const distance = testBody.position.distance(otherBody.position);
                    if (distance < physicsEngine.collisionThreshold) {
                        collisionDetected = true;
                        stableOrbit = false;
                        break;
                    }
                }
            }
            
            // Check if orbit is getting too eccentric or escaping
            if (currentDistance > maxDistance * 3 || testBody.velocity.magnitude() > 300) {
                stableOrbit = false;
                // Continue a bit more to show escape trajectory
                if (step > this.orbitPreviewSteps * 0.3) break;
            }
            
            // Reset forces
            testBodies.forEach(body => body.resetForce());
            
            // Calculate forces using the same physics engine
            physicsEngine.calculateForcesNaive(testBodies);
            
            // Update only the test body position
            testBody.update(this.orbitPreviewTimeStep);
            
            // Stop if collision detected and we have enough points
            if (collisionDetected && this.orbitPreviewPoints.length > 50) {
                break;
            }
        }
        
        // If we completed an orbit, close the loop
        if (orbitCompleted && this.orbitPreviewPoints.length > 0) {
            // Add a few more points to close the orbit smoothly
            this.orbitPreviewPoints.push(this.orbitPreviewPoints[0]);
        }
        
        // Optimize points for smooth rendering while maintaining curve quality
        this.orbitPreviewPoints = this.optimizeOrbitPoints(this.orbitPreviewPoints);
        
        return {
            points: this.orbitPreviewPoints,
            stable: stableOrbit && (orbitCompleted || !collisionDetected),
            collision: collisionDetected,
            completed: orbitCompleted
        };
    }

    findPrimaryBody(position, bodies) {
        let primaryBody = null;
        let minDistance = Infinity;
        
        for (const body of bodies) {
            const distance = body.position.distance(position);
            if (distance < minDistance) {
                minDistance = distance;
                primaryBody = body;
            }
        }
        
        return primaryBody;
    }

    drawOrbitPreview() {
        if (!this.showOrbitPreview || this.orbitPreviewPoints.length === 0) {
            return;
        }
        
        this.ctx.save();
        
        // Enable anti-aliasing for smoother curves
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Determine orbit style based on stability
        const lastPoint = this.orbitPreviewPoints[this.orbitPreviewPoints.length - 1];
        const isStable = lastPoint?.stable;
        const hasCollision = this.orbitPreviewPoints.some(point => !point.stable);
        
        // Set line style based on orbit type
        if (hasCollision) {
            // Red spiral for collision course
            this.ctx.strokeStyle = 'rgba(255, 107, 107, 0.9)';
            this.ctx.setLineDash([5, 5]);
            this.ctx.lineWidth = 3;
        } else if (isStable) {
            // Bright green for stable orbit
            this.ctx.strokeStyle = 'rgba(81, 207, 102, 0.9)';
            this.ctx.setLineDash([]);
            this.ctx.lineWidth = 3;
        } else {
            // Yellow for unstable/escape trajectory
            this.ctx.strokeStyle = 'rgba(255, 212, 59, 0.9)';
            this.ctx.setLineDash([10, 5]);
            this.ctx.lineWidth = 2;
        }
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Draw the orbit path with a glowing effect
        this.ctx.shadowColor = this.ctx.strokeStyle;
        this.ctx.shadowBlur = isStable ? 12 : 6;
        
        // Draw main orbit line with smooth curves
        this.ctx.beginPath();
        
        if (this.orbitPreviewPoints.length > 6) {
            // Use smooth spline curve for best quality
            this.drawSmoothOrbitCurveSpline();
        } else if (this.orbitPreviewPoints.length > 2) {
            // Use simple quadratic curves for fewer points
            this.drawSmoothOrbitCurve();
        } else if (this.orbitPreviewPoints.length === 2) {
            // Simple line for just two points
            this.ctx.moveTo(this.orbitPreviewPoints[0].position.x, this.orbitPreviewPoints[0].position.y);
            this.ctx.lineTo(this.orbitPreviewPoints[1].position.x, this.orbitPreviewPoints[1].position.y);
        } else if (this.orbitPreviewPoints.length === 1) {
            // Just a point
            this.ctx.arc(this.orbitPreviewPoints[0].position.x, this.orbitPreviewPoints[0].position.y, 2, 0, Math.PI * 2);
        }
        
        this.ctx.stroke();
        
        // Reset shadow for other elements
        this.ctx.shadowBlur = 0;
        
        // Draw start and end points
        this.drawOrbitEndpoints();
        
        // Add directional arrows along the path
        this.drawOrbitDirectionArrows();
        
        // Draw orbit statistics
        this.drawOrbitInfo();
        
        this.ctx.restore();
    }

    drawOrbitEndpoints() {
        if (this.orbitPreviewPoints.length === 0) return;
        
        // Draw starting point (larger, brighter)
        const startPoint = this.orbitPreviewPoints[0];
        // Use world coordinates directly since camera transformation is already applied
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(100, 255, 218, 0.8)';
        this.ctx.strokeStyle = 'rgba(100, 255, 218, 1)';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(startPoint.position.x, startPoint.position.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Add a small arrow to show initial direction
        if (this.orbitPreviewPoints.length > 1) {
            const nextPoint = this.orbitPreviewPoints[1];
            // Use world coordinates directly
            const direction = {
                x: nextPoint.position.x - startPoint.position.x,
                y: nextPoint.position.y - startPoint.position.y
            };
            const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
            
            if (length > 0) {
                direction.x /= length;
                direction.y /= length;
                
                this.ctx.translate(startPoint.position.x, startPoint.position.y);
                this.ctx.rotate(Math.atan2(direction.y, direction.x));
                
                this.ctx.beginPath();
                this.ctx.moveTo(8, 0);
                this.ctx.lineTo(3, -3);
                this.ctx.lineTo(3, 3);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }
        
        this.ctx.restore();
    }

    drawOrbitInfo() {
        if (this.orbitPreviewPoints.length === 0) return;
        
        // Calculate orbit statistics
        let minDistance = Infinity;
        let maxDistance = 0;
        
        this.orbitPreviewPoints.forEach(point => {
            if (point.distance) {
                minDistance = Math.min(minDistance, point.distance);
                maxDistance = Math.max(maxDistance, point.distance);
            }
        });
        
        const eccentricity = maxDistance > 0 ? (maxDistance - minDistance) / maxDistance : 0;
        const lastPoint = this.orbitPreviewPoints[this.orbitPreviewPoints.length - 1];
        
        // Draw info box near the mouse cursor (in screen coordinates)
        this.ctx.save();
        
        // Reset transformations for UI overlay
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const infoX = this.width * 0.02;
        const infoY = this.height * 0.15;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(infoX, infoY, 200, 80);
        
        this.ctx.fillStyle = lastPoint?.stable ? '#51cf66' : '#ff6b6b';
        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.fillText(lastPoint?.stable ? 'Stable Orbit' : 'Unstable Trajectory', infoX + 10, infoY + 20);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.fillText(`Eccentricity: ${eccentricity.toFixed(3)}`, infoX + 10, infoY + 40);
        this.ctx.fillText(`Points: ${this.orbitPreviewPoints.length}`, infoX + 10, infoY + 60);
        
        this.ctx.restore();
    }

    drawOrbitDirectionArrows() {
        if (this.orbitPreviewPoints.length < 10) return;
        
        // Adjust arrow spacing based on number of points for better distribution
        const totalPoints = this.orbitPreviewPoints.length;
        const desiredArrows = Math.min(8, Math.max(3, totalPoints / 80));
        const arrowSpacing = Math.floor(totalPoints / desiredArrows);
        
        this.ctx.save();
        this.ctx.fillStyle = this.ctx.strokeStyle; // Use same color as orbit line
        this.ctx.globalAlpha = 0.8; // Slightly transparent
        
        for (let i = arrowSpacing; i < this.orbitPreviewPoints.length - arrowSpacing; i += arrowSpacing) {
            const current = this.orbitPreviewPoints[i];
            const next = this.orbitPreviewPoints[Math.min(i + 3, this.orbitPreviewPoints.length - 1)];
            
            if (!current || !next) continue;
            
            // Calculate arrow direction using a slightly ahead point for smoother direction
            const direction = {
                x: next.position.x - current.position.x,
                y: next.position.y - current.position.y
            };
            
            const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
            if (length > 1) { // Only draw if there's sufficient direction change
                direction.x /= length;
                direction.y /= length;
                
                // Draw small arrow
                this.ctx.save();
                this.ctx.translate(current.position.x, current.position.y);
                this.ctx.rotate(Math.atan2(direction.y, direction.x));
                
                // Make arrows smaller and more elegant
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(-6, -2.5);
                this.ctx.lineTo(-6, 2.5);
                this.ctx.closePath();
                this.ctx.fill();
                
                this.ctx.restore();
            }
        }
        
        this.ctx.restore();
    }

    setOrbitPreview(show, previewData = null) {
        this.showOrbitPreview = show;
        if (previewData) {
            this.orbitPreviewPoints = previewData.points || [];
        } else {
            this.orbitPreviewPoints = [];
        }
    }

    // Settings
    setShowTrails(show) {
        this.showTrails = show;
    }

    setShowGrid(show) {
        this.showGrid = show;
    }

    setShowForces(show) {
        this.showForces = show;
    }

    setShowInfo(show) {
        this.showInfo = show;
    }

    setShowCenterOfMass(show) {
        this.showCenterOfMass = show;
    }

    toggleAntiAliasing() {
        this.antiAliasing = !this.antiAliasing;
        this.ctx.imageSmoothingEnabled = this.antiAliasing;
    }

    // Resize handling
    resize() {
        this.setupCanvas();
    }

    // Screenshot functionality
    getScreenshot() {
        return this.canvas.toDataURL('image/png');
    }

    drawSmoothOrbitCurve() {
        const points = this.orbitPreviewPoints;
        if (points.length < 3) return;
        
        // Start at the first point
        this.ctx.moveTo(points[0].position.x, points[0].position.y);
        
        // For a smooth curve, we'll use quadratic curves with calculated control points
        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i].position;
            const next = points[i + 1].position;
            
            // Calculate control point as the midpoint between current and next
            const controlX = (current.x + next.x) / 2;
            const controlY = (current.y + next.y) / 2;
            
            // Draw quadratic curve to the control point
            this.ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
        }
        
        // Draw final segment to the last point
        const lastPoint = points[points.length - 1].position;
        const secondLastPoint = points[points.length - 2].position;
        this.ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y);
    }

    drawSmoothOrbitCurveSpline() {
        // Alternative implementation using Catmull-Rom splines for even smoother curves
        const points = this.orbitPreviewPoints;
        if (points.length < 4) {
            this.drawSmoothOrbitCurve();
            return;
        }
        
        this.ctx.moveTo(points[0].position.x, points[0].position.y);
        
        // Draw curves between each set of 4 points
        for (let i = 0; i < points.length - 3; i++) {
            const p0 = points[i].position;
            const p1 = points[i + 1].position;
            const p2 = points[i + 2].position;
            const p3 = points[i + 3].position;
            
            // Calculate Catmull-Rom spline control points
            const tension = 0.3; // Adjust for curve smoothness
            
            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;
            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;
            
            // Draw cubic Bézier curve
            this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        
        // Connect to the last point
        const lastPoint = points[points.length - 1].position;
        this.ctx.lineTo(lastPoint.x, lastPoint.y);
    }

    optimizeOrbitPoints(points) {
        if (points.length <= 50) return points; // Don't optimize small arrays
        
        // Use Douglas-Peucker algorithm variant for curve simplification
        const optimized = [];
        const tolerance = 2.0; // Pixel tolerance for curve simplification
        
        // Always keep the first point
        optimized.push(points[0]);
        
        let lastKeptIndex = 0;
        
        for (let i = 2; i < points.length; i++) {
            const lastPoint = points[lastKeptIndex].position;
            const currentPoint = points[i].position;
            const testPoint = points[i - 1].position;
            
            // Calculate distance from test point to line between last kept and current
            const distance = this.pointToLineDistance(testPoint, lastPoint, currentPoint);
            
            if (distance > tolerance || i - lastKeptIndex > 15) {
                // Keep the previous point and update last kept index
                optimized.push(points[i - 1]);
                lastKeptIndex = i - 1;
            }
        }
        
        // Always keep the last point
        if (points.length > 0) {
            optimized.push(points[points.length - 1]);
        }
        
        return optimized;
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            return Math.sqrt(A * A + B * B);
        }
        
        const param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
