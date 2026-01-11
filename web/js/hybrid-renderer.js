/**
 * Hybrid Renderer - Automatically selects the best rendering method
 * Falls back gracefully from WebGL to Canvas 2D based on:
 * - Browser support
 * - Performance requirements
 * - User preferences
 */

class HybridRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderingMode = 'auto'; // 'auto', 'webgl', 'canvas2d'
        this.currentRenderer = null;
        this.performanceMode = 'balanced'; // 'performance', 'balanced', 'quality'
        
        // Performance monitoring
        this.frameTime = 0;
        this.averageFrameTime = 0;
        this.frameCount = 0;
        this.performanceHistory = [];
        this.maxPerformanceHistory = 60; // 1 second at 60fps
        
        // Auto-switching thresholds
        this.performanceThresholds = {
            webglToCanvas: 20.0,  // Switch to canvas if WebGL frame time > 20ms
            canvasToWebgl: 8.0,   // Switch to WebGL if canvas frame time < 8ms
            bodyCountThreshold: 100 // Use WebGL for 100+ bodies
        };
        
        // Fallback detection
        this.webglSupported = this.checkWebGLSupport();
        this.lastRendererSwitch = 0;
        this.switchCooldown = 2000; // 2 seconds between switches
        
        this.initializeRenderer();
    }

    checkWebGLSupport() {
        try {
            const testCanvas = document.createElement('canvas');
            const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
            return gl !== null;
        } catch (e) {
            return false;
        }
    }

    initializeRenderer() {
        if (this.renderingMode === 'canvas2d' || !this.webglSupported) {
            this.initializeCanvas2D();
        } else {
            this.initializeWebGL();
        }
    }

    initializeWebGL() {
        try {
            this.currentRenderer = new WebGLRenderer(this.canvas);
            this.activeMode = 'webgl';
            console.log('WebGL Renderer initialized');
        } catch (error) {
            console.warn('WebGL initialization failed:', error.message);
            this.initializeCanvas2D();
        }
    }

    initializeCanvas2D() {
        // Create optimized Canvas 2D renderer
        this.currentRenderer = new OptimizedCanvas2DRenderer(this.canvas);
        this.activeMode = 'canvas2d';
        console.log('Canvas 2D Renderer initialized');
    }

    render(bodies, physicsEngine, selectedBody = null) {
        const startTime = performance.now();
        
        // Auto-switch renderer based on performance if enabled
        if (this.renderingMode === 'auto') {
            this.evaluateRendererSwitch(bodies.length);
        }
        
        // Render with current renderer
        this.currentRenderer.render(bodies, physicsEngine, selectedBody);
        
        // Track performance
        this.frameTime = performance.now() - startTime;
        this.updatePerformanceHistory();
        
        return this.getStats();
    }

    evaluateRendererSwitch(bodyCount) {
        const now = performance.now();
        
        // Don't switch too frequently
        if (now - this.lastRendererSwitch < this.switchCooldown) {
            return;
        }
        
        const avgFrameTime = this.getAverageFrameTime();
        
        // Switch from WebGL to Canvas 2D if performance is poor
        if (this.activeMode === 'webgl' && avgFrameTime > this.performanceThresholds.webglToCanvas) {
            console.log(`Switching to Canvas 2D due to poor WebGL performance (${avgFrameTime.toFixed(2)}ms)`);
            this.initializeCanvas2D();
            this.lastRendererSwitch = now;
            return;
        }
        
        // Switch from Canvas 2D to WebGL if conditions are favorable
        if (this.activeMode === 'canvas2d' && 
            this.webglSupported && 
            bodyCount >= this.performanceThresholds.bodyCountThreshold &&
            avgFrameTime < this.performanceThresholds.canvasToWebgl) {
            console.log(`Switching to WebGL due to high body count (${bodyCount}) and good performance`);
            this.initializeWebGL();
            this.lastRendererSwitch = now;
            return;
        }
    }

    updatePerformanceHistory() {
        this.performanceHistory.push(this.frameTime);
        
        if (this.performanceHistory.length > this.maxPerformanceHistory) {
            this.performanceHistory.shift();
        }
        
        this.frameCount++;
    }

    getAverageFrameTime() {
        if (this.performanceHistory.length === 0) return 0;
        
        const sum = this.performanceHistory.reduce((a, b) => a + b, 0);
        return sum / this.performanceHistory.length;
    }

    // Delegate methods to current renderer
    setCamera(x, y, zoom) {
        if (this.currentRenderer && this.currentRenderer.setCamera) {
            this.currentRenderer.setCamera(x, y, zoom);
        }
    }

    setZoom(zoom) {
        if (this.currentRenderer && this.currentRenderer.setZoom) {
            this.currentRenderer.setZoom(zoom);
        }
    }

    // Zoom control methods
    zoomIn(factor = 1.2) {
        if (this.currentRenderer && this.currentRenderer.zoomIn) {
            this.currentRenderer.zoomIn(factor);
        } else {
            // Fallback implementation
            const camera = this.camera;
            camera.targetZoom = Math.min(camera.targetZoom * factor, 10.0);
        }
    }

    zoomOut(factor = 1.2) {
        if (this.currentRenderer && this.currentRenderer.zoomOut) {
            this.currentRenderer.zoomOut(factor);
        } else {
            // Fallback implementation
            const camera = this.camera;
            camera.targetZoom = Math.max(camera.targetZoom / factor, 0.1);
        }
    }

    // Camera panning methods
    panCamera(deltaX, deltaY) {
        if (this.currentRenderer && this.currentRenderer.panCamera) {
            this.currentRenderer.panCamera(deltaX, deltaY);
        } else {
            // Fallback implementation
            const camera = this.camera;
            camera.x += deltaX / camera.zoom;
            camera.y += deltaY / camera.zoom;
        }
    }

    setShowTrails(show) {
        if (this.currentRenderer && this.currentRenderer.setShowTrails) {
            this.currentRenderer.setShowTrails(show);
        }
    }

    setShowGrid(show) {
        if (this.currentRenderer && this.currentRenderer.setShowGrid) {
            this.currentRenderer.setShowGrid(show);
        }
    }

    // Camera property getter - delegate to current renderer
    get camera() {
        if (this.currentRenderer && this.currentRenderer.camera) {
            return this.currentRenderer.camera;
        }
        // Return a default camera object if no renderer is available
        return {
            x: 0,
            y: 0,
            zoom: 1.0,
            targetZoom: 1.0,
            smoothing: 0.1
        };
    }

    // Camera controls
    panCamera(deltaX, deltaY) {
        const camera = this.camera;
        camera.x += deltaX / camera.zoom;
        camera.y += deltaY / camera.zoom;
        
        if (this.currentRenderer && this.currentRenderer.panCamera) {
            this.currentRenderer.panCamera(deltaX, deltaY);
        }
    }

    zoomCamera(factor, centerX = null, centerY = null) {
        const camera = this.camera;
        const oldZoom = camera.zoom;
        camera.targetZoom = Math.max(0.1, Math.min(10.0, camera.targetZoom * factor));
        
        // Zoom toward a specific point if provided
        if (centerX !== null && centerY !== null) {
            const worldPoint = this.screenToWorld(centerX, centerY);
            camera.x = worldPoint.x - (centerX - this.canvas.width / 2) / camera.targetZoom;
            camera.y = worldPoint.y - (centerY - this.canvas.height / 2) / camera.targetZoom;
        }
        
        if (this.currentRenderer && this.currentRenderer.zoomCamera) {
            this.currentRenderer.zoomCamera(factor, centerX, centerY);
        }
    }

    setZoomLevel(zoom) {
        const camera = this.camera;
        camera.targetZoom = Math.max(0.1, Math.min(10.0, zoom));
        
        if (this.currentRenderer && this.currentRenderer.setZoomLevel) {
            this.currentRenderer.setZoomLevel(zoom);
        }
    }

    getCameraZoom() {
        return this.camera.zoom;
    }

    setCameraPosition(x, y) {
        const camera = this.camera;
        camera.x = x;
        camera.y = y;
        
        if (this.currentRenderer && this.currentRenderer.setCameraPosition) {
            this.currentRenderer.setCameraPosition(x, y);
        }
    }

    // Screen to world coordinate conversion
    screenToWorld(screenX, screenY) {
        if (this.currentRenderer && this.currentRenderer.screenToWorld) {
            const result = this.currentRenderer.screenToWorld(screenX, screenY);
            // Ensure we return a Vector2D object
            if (result && typeof result.x === 'number' && typeof result.y === 'number') {
                return new Vector2D(result.x, result.y);
            }
        }
        
        // Fallback implementation for coordinate conversion
        const camera = this.camera;
        const rect = this.canvas.getBoundingClientRect();
        
        // Convert screen coordinates to canvas coordinates
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;
        
        // Convert to world coordinates
        const worldX = (canvasX - this.canvas.width / 2) / camera.zoom + camera.x;
        const worldY = (canvasY - this.canvas.height / 2) / camera.zoom + camera.y;
        
        return new Vector2D(worldX, worldY);
    }

    // World to screen coordinate conversion
    worldToScreen(worldX, worldY) {
        if (this.currentRenderer && this.currentRenderer.worldToScreen) {
            return this.currentRenderer.worldToScreen(worldX, worldY);
        }
        
        // Fallback implementation
        const camera = this.camera;
        const screenX = (worldX - camera.x) * camera.zoom + this.canvas.width / 2;
        const screenY = (worldY - camera.y) * camera.zoom + this.canvas.height / 2;
        
        return { x: screenX, y: screenY };
    }

    // Additional delegate methods
    renderOrbitPreview(...args) {
        if (this.currentRenderer && this.currentRenderer.renderOrbitPreview) {
            return this.currentRenderer.renderOrbitPreview(...args);
        }
    }

    setShowOrbitPreview(show) {
        if (this.currentRenderer && this.currentRenderer.setShowOrbitPreview) {
            this.currentRenderer.setShowOrbitPreview(show);
        }
    }

    setLongTermPreview(show) {
        if (this.currentRenderer && this.currentRenderer.setLongTermPreview) {
            this.currentRenderer.setLongTermPreview(show);
        }
    }

    // Rendering optimization methods
    setFrustumCulling(enabled) {
        this.frustumCulling = enabled;
        if (this.currentRenderer && this.currentRenderer.setFrustumCulling) {
            this.currentRenderer.setFrustumCulling(enabled);
        }
    }

    setLODEnabled(enabled) {
        this.lodEnabled = enabled;
        if (this.currentRenderer && this.currentRenderer.setLODEnabled) {
            this.currentRenderer.setLODEnabled(enabled);
        }
    }

    // Canvas setup method (delegated to current renderer)
    setupCanvas() {
        if (this.currentRenderer && this.currentRenderer.setupCanvas) {
            this.currentRenderer.setupCanvas();
        }
    }

    // Update renderer dimensions
    updateDimensions(width, height, devicePixelRatio) {
        this.width = width;
        this.height = height;
        this.devicePixelRatio = devicePixelRatio;
        
        if (this.currentRenderer) {
            this.currentRenderer.width = width;
            this.currentRenderer.height = height;
            this.currentRenderer.devicePixelRatio = devicePixelRatio;
            
            if (this.currentRenderer.setupCanvas) {
                this.currentRenderer.setupCanvas();
            }
        }
    }

    // Settings
    setRenderingMode(mode) {
        if (mode === this.renderingMode) return;
        
        this.renderingMode = mode;
        
        if (mode === 'webgl' && this.webglSupported) {
            this.initializeWebGL();
        } else if (mode === 'canvas2d') {
            this.initializeCanvas2D();
        }
        // 'auto' mode will be handled in render()
    }

    setPerformanceMode(mode) {
        this.performanceMode = mode;
        
        // Update thresholds based on performance mode
        switch (mode) {
            case 'performance':
                this.performanceThresholds.webglToCanvas = 25.0;
                this.performanceThresholds.bodyCountThreshold = 50;
                break;
            case 'balanced':
                this.performanceThresholds.webglToCanvas = 20.0;
                this.performanceThresholds.bodyCountThreshold = 100;
                break;
            case 'quality':
                this.performanceThresholds.webglToCanvas = 15.0;
                this.performanceThresholds.bodyCountThreshold = 200;
                break;
        }
    }

    // Get comprehensive stats
    getStats() {
        const baseStats = {
            activeMode: this.activeMode,
            frameTime: this.frameTime,
            averageFrameTime: this.getAverageFrameTime(),
            frameCount: this.frameCount,
            webglSupported: this.webglSupported,
            renderingMode: this.renderingMode,
            performanceMode: this.performanceMode
        };
        
        // Add renderer-specific stats
        if (this.currentRenderer && this.currentRenderer.getStats) {
            return { ...baseStats, ...this.currentRenderer.getStats() };
        }
        
        return baseStats;
    }

    resize(width, height) {
        if (this.currentRenderer && this.currentRenderer.resize) {
            this.currentRenderer.resize(width, height);
        }
    }

    destroy() {
        if (this.currentRenderer && this.currentRenderer.destroy) {
            this.currentRenderer.destroy();
        }
    }
}

/**
 * Optimized Canvas 2D Renderer
 * Improved version of the original renderer with better performance
 */
class OptimizedCanvas2DRenderer {
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
        
        // Performance optimizations
        this.enableCulling = true;
        this.enableLOD = true;
        this.lodThresholds = {
            high: 10,    // Full detail above 10 screen pixels
            medium: 5,   // Medium detail 5-10 pixels
            low: 2       // Low detail 2-5 pixels
        };
        
        // Cached gradients and patterns
        this.gradientCache = new Map();
        this.maxCacheSize = 100;
        
        // Pre-calculated values
        this.viewBounds = { left: 0, right: 0, top: 0, bottom: 0 };
        
        // Performance tracking
        this.stats = {
            drawCalls: 0,
            bodiesRendered: 0,
            bodiesCulled: 0,
            renderTime: 0,
            fps: 60
        };
        
        this.setupCanvas();
    }

    setupCanvas() {
        // Scale for device pixel ratio
        const dpr = this.devicePixelRatio;
        this.ctx.scale(dpr, dpr);
        
        // Enable optimizations
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Set text rendering optimizations
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
    }

    clear() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    updateCamera() {
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.smoothing;
        
        // Update view bounds for culling
        const halfWidth = this.width / (2 * this.camera.zoom);
        const halfHeight = this.height / (2 * this.camera.zoom);
        
        this.viewBounds.left = this.camera.x - halfWidth;
        this.viewBounds.right = this.camera.x + halfWidth;
        this.viewBounds.top = this.camera.y - halfHeight;
        this.viewBounds.bottom = this.camera.y + halfHeight;
    }

    render(bodies, physicsEngine, selectedBody = null) {
        const startTime = performance.now();
        
        this.clear();
        this.updateCamera();
        
        // Setup transformation matrix
        this.ctx.save();
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Reset stats
        this.stats.drawCalls = 0;
        this.stats.bodiesRendered = 0;
        this.stats.bodiesCulled = 0;
        
        // Render grid if enabled
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // Render trails first (so they appear behind bodies)
        if (this.showTrails) {
            this.drawTrails(bodies);
        }
        
        // Render bodies with culling and LOD
        this.drawBodies(bodies, selectedBody);
        
        this.ctx.restore();
        
        // Update performance stats
        this.stats.renderTime = performance.now() - startTime;
        this.stats.fps = 1000 / this.stats.renderTime;
    }

    drawBodies(bodies, selectedBody) {
        for (const body of bodies) {
            // Frustum culling
            if (this.enableCulling && !this.isBodyVisible(body)) {
                this.stats.bodiesCulled++;
                continue;
            }
            
            // Level of detail
            const screenRadius = body.radius * this.camera.zoom;
            const lodLevel = this.getLODLevel(screenRadius);
            
            this.drawBody(body, body === selectedBody, lodLevel);
            this.stats.bodiesRendered++;
            this.stats.drawCalls++;
        }
    }

    isBodyVisible(body) {
        const margin = body.radius;
        return (
            body.position.x + margin >= this.viewBounds.left &&
            body.position.x - margin <= this.viewBounds.right &&
            body.position.y + margin >= this.viewBounds.top &&
            body.position.y - margin <= this.viewBounds.bottom
        );
    }

    getLODLevel(screenRadius) {
        if (!this.enableLOD) return 'high';
        
        if (screenRadius >= this.lodThresholds.high) return 'high';
        if (screenRadius >= this.lodThresholds.medium) return 'medium';
        if (screenRadius >= this.lodThresholds.low) return 'low';
        return 'point';
    }

    drawBody(body, isSelected, lodLevel) {
        const x = body.position.x;
        const y = body.position.y;
        const radius = Math.max(body.radius, 2 / this.camera.zoom); // Minimum screen size
        
        // Point rendering for very small bodies
        if (lodLevel === 'point') {
            this.ctx.fillStyle = body.color;
            this.ctx.fillRect(x - 1, y - 1, 2, 2);
            return;
        }
        
        // Selection glow
        if (isSelected) {
            this.drawGlow(x, y, radius * 2, body.color);
        }
        
        // Main body
        this.ctx.fillStyle = body.color;
        this.ctx.strokeStyle = isSelected ? '#64ffda' : 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = (isSelected ? 3 : 1) / this.camera.zoom;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // High detail features
        if (lodLevel === 'high' && radius > 5) {
            // Highlight
            const highlightColor = this.lightenColor(body.color, 0.3);
            this.ctx.fillStyle = highlightColor;
            this.ctx.beginPath();
            this.ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawGlow(x, y, radius, color) {
        const gradient = this.getGradient(color, radius);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    getGradient(color, radius) {
        const key = `${color}_${radius}`;
        
        if (this.gradientCache.has(key)) {
            return this.gradientCache.get(key);
        }
        
        const gradient = this.ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius);
        gradient.addColorStop(0, this.hexToRgba(color, 0.3));
        gradient.addColorStop(1, this.hexToRgba(color, 0));
        
        // Cache management
        if (this.gradientCache.size >= this.maxCacheSize) {
            const firstKey = this.gradientCache.keys().next().value;
            this.gradientCache.delete(firstKey);
        }
        
        this.gradientCache.set(key, gradient);
        return gradient;
    }

    drawTrails(bodies) {
        this.ctx.lineWidth = 2 / this.camera.zoom;
        this.ctx.lineCap = 'round';
        
        for (const body of bodies) {
            if (!body.trail || body.trail.length < 2) continue;
            
            // Simple culling for trails
            if (this.enableCulling && !this.isBodyVisible(body)) continue;
            
            this.ctx.strokeStyle = this.hexToRgba(body.color, 0.6);
            this.ctx.beginPath();
            
            const trail = body.trail;
            this.ctx.moveTo(trail[0].x, trail[0].y);
            
            for (let i = 1; i < trail.length; i++) {
                this.ctx.lineTo(trail[i].x, trail[i].y);
            }
            
            this.ctx.stroke();
        }
    }

    drawGrid() {
        const gridSize = 100;
        const zoom = this.camera.zoom;
        
        if (zoom < 0.1) return; // Don't draw grid when too zoomed out
        
        this.ctx.strokeStyle = 'rgba(100, 255, 218, 0.1)';
        this.ctx.lineWidth = 1 / zoom;
        
        const bounds = this.viewBounds;
        const startX = Math.floor(bounds.left / gridSize) * gridSize;
        const endX = Math.ceil(bounds.right / gridSize) * gridSize;
        const startY = Math.floor(bounds.top / gridSize) * gridSize;
        const endY = Math.ceil(bounds.bottom / gridSize) * gridSize;
        
        this.ctx.beginPath();
        
        // Vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.moveTo(x, bounds.top);
            this.ctx.lineTo(x, bounds.bottom);
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.moveTo(bounds.left, y);
            this.ctx.lineTo(bounds.right, y);
        }
        
        this.ctx.stroke();
    }

    // Utility functions
    hexToRgba(hex, alpha) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return `rgba(255, 255, 255, ${alpha})`;
        
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    lightenColor(hex, factor) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return hex;
        
        const r = Math.min(255, parseInt(result[1], 16) + factor * 255);
        const g = Math.min(255, parseInt(result[2], 16) + factor * 255);
        const b = Math.min(255, parseInt(result[3], 16) + factor * 255);
        
        return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    }

    // Control methods
    setCamera(x, y, zoom) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.targetZoom = zoom;
    }

    setZoom(zoom) {
        this.camera.targetZoom = Math.max(0.1, Math.min(10.0, zoom));
    }

    // Zoom control methods
    zoomIn(factor = 1.2) {
        this.camera.targetZoom = Math.min(this.camera.targetZoom * factor, 10.0);
    }

    zoomOut(factor = 1.2) {
        this.camera.targetZoom = Math.max(this.camera.targetZoom / factor, 0.1);
    }

    // Camera panning methods
    panCamera(deltaX, deltaY) {
        this.camera.x += deltaX / this.camera.zoom;
        this.camera.y += deltaY / this.camera.zoom;
    }

    setShowTrails(show) {
        this.showTrails = show;
    }

    setShowGrid(show) {
        this.showGrid = show;
    }

    // Camera controls
    panCamera(deltaX, deltaY) {
        this.camera.x += deltaX / this.camera.zoom;
        this.camera.y += deltaY / this.camera.zoom;
    }

    zoomCamera(factor, centerX = null, centerY = null) {
        const oldZoom = this.camera.zoom;
        this.camera.targetZoom = Math.max(0.1, Math.min(10.0, this.camera.targetZoom * factor));
        
        // Zoom toward a specific point if provided
        if (centerX !== null && centerY !== null) {
            const worldPoint = this.screenToWorld(centerX, centerY);
            this.camera.x = worldPoint.x - (centerX - this.width / 2) / this.camera.targetZoom;
            this.camera.y = worldPoint.y - (centerY - this.height / 2) / this.camera.targetZoom;
        }
    }

    setZoomLevel(zoom) {
        this.camera.targetZoom = Math.max(0.1, Math.min(10.0, zoom));
    }

    getCameraZoom() {
        return this.camera.zoom;
    }

    setCameraPosition(x, y) {
        this.camera.x = x;
        this.camera.y = y;
    }

    // Screen to world coordinate conversion
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Convert screen coordinates to canvas coordinates
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;
        
        // Convert to world coordinates accounting for camera transform
        const worldX = (canvasX - this.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (canvasY - this.height / 2) / this.camera.zoom + this.camera.y;
        
        return new Vector2D(worldX, worldY);
    }

    // World to screen coordinate conversion
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.zoom + this.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + this.height / 2;
        
        return { x: screenX, y: screenY };
    }

    // Rendering optimization methods
    setFrustumCulling(enabled) {
        this.enableCulling = enabled;
    }

    setLODEnabled(enabled) {
        this.enableLOD = enabled;
    }

    // Orbit preview methods (placeholder)
    renderOrbitPreview(...args) {
        // Placeholder for orbit preview rendering
        // The original renderer has this functionality
    }

    setShowOrbitPreview(show) {
        this.showOrbitPreview = show;
    }

    setLongTermPreview(show) {
        this.showLongTermPreview = show;
    }

    getStats() {
        return { ...this.stats };
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.setupCanvas();
    }

    destroy() {
        this.gradientCache.clear();
    }
}
