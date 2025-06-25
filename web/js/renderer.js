class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
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
        // Set up high DPI rendering
        const devicePixelRatio = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;
        
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.width = rect.width;
        this.height = rect.height;
        
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
        const radius = body.radius / this.camera.zoom;
        const x = body.position.x;
        const y = body.position.y;
        
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
        const glowRadius = radius * 2;
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
        const screenX = (worldX - this.camera.x) * this.camera.zoom + this.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + this.height / 2;
        return new Vector2D(screenX, screenY);
    }

    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - this.height / 2) / this.camera.zoom + this.camera.y;
        return new Vector2D(worldX, worldY);
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
}
