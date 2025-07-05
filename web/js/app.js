// Configuration and constants
const DEBUG_MODE = false; // Set to false for production builds

// Debug logging utility
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

// Performance monitoring utility
class PerformanceMonitor {
    constructor() {
        this.measurements = new Map();
    }
    
    start(label) {
        this.measurements.set(label, performance.now());
    }
    
    end(label) {
        const startTime = this.measurements.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.measurements.delete(label);
            return duration;
        }
        return 0;
    }
}

// Global performance monitor instance
const perfMonitor = new PerformanceMonitor();

class NBodyApp {
    constructor() {
        this.canvas = document.getElementById('simulation-canvas');
        this.renderer = new Renderer(this.canvas);
        this.physics = new PhysicsEngine();
        this.ui = new UIManager();
        
        // Initialize GPU physics within the main physics engine
        this.physics.initializeGPUPhysics();
        
        this.ui.setRenderer(this.renderer);
        
        this.bodies = [];
        this.selectedBody = null;
        this.isRunning = false;
        this.isPaused = false;
        this.lastFrameTime = 0;
        
        // Input handling
        this.mousePos = new Vector2D(0, 0);
        this.isDragging = false;
        this.draggedBody = null; // Separate tracking for dragged body
        this.isAddingBody = false;
        this.dragOffset = new Vector2D(0, 0);
        this.lastMousePos = new Vector2D(0, 0);
        this.dragStartPosition = new Vector2D(0, 0); // Track drag start for orbit preview
        
        // Performance tracking
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.currentFPS = 60;
        
        this.useWebWorkers = false;
        this.physicsWorker = null;
        this.workerBusy = false;
        this.initialEnergy = null;
        
        // Store references for cleanup
        this.eventCleanupFunctions = [];
        this.intervalIds = [];
        
        this.initialize();
    }

    // Add cleanup method
    cleanup() {
        // Clear all intervals
        this.intervalIds.forEach(id => clearInterval(id));
        this.intervalIds = [];
        
        // Clean up event listeners
        this.eventCleanupFunctions.forEach(cleanup => cleanup());
        this.eventCleanupFunctions = [];
        
        // Clean up web worker
        if (this.physicsWorker) {
            this.physicsWorker.terminate();
            this.physicsWorker = null;
        }
        
        // Clean up GPU resources
        if (this.physics.gpuPhysics) {
            this.physics.gpuPhysics.cleanup();
        }
    }

    initialize() {
        this.setupEventListeners();
        this.setupUICallbacks();
        this.setupCanvas();
        
        // Initialize GPU status in UI
        this.updateGPUStatus();
        
        setTimeout(() => {
            this.ui.hideLoading();
        }, 1000);
        
        this.startMainLoop();
        
        // Initial UI update
        this.updateUI();
        
        debugLog('CelestialSim initialized successfully!');
        this.ui.showNotification('CelestialSim loaded!', 'success');
    }

    setupEventListeners() {
        // Store cleanup functions for proper removal
        const mouseDownHandler = (e) => this.onMouseDown(e);
        const mouseMoveHandler = (e) => this.onMouseMove(e);
        const mouseUpHandler = (e) => this.onMouseUp(e);
        const wheelHandler = (e) => this.onMouseWheel(e);
        const contextMenuHandler = (e) => e.preventDefault();
        const resizeHandler = () => this.onWindowResize();
        
        this.canvas.addEventListener('mousedown', mouseDownHandler);
        this.canvas.addEventListener('mousemove', mouseMoveHandler);
        this.canvas.addEventListener('mouseup', mouseUpHandler);
        this.canvas.addEventListener('wheel', wheelHandler);
        this.canvas.addEventListener('contextmenu', contextMenuHandler);
        window.addEventListener('resize', resizeHandler);
        
        // Store cleanup functions
        this.eventCleanupFunctions.push(
            () => this.canvas.removeEventListener('mousedown', mouseDownHandler),
            () => this.canvas.removeEventListener('mousemove', mouseMoveHandler),
            () => this.canvas.removeEventListener('mouseup', mouseUpHandler),
            () => this.canvas.removeEventListener('wheel', wheelHandler),
            () => this.canvas.removeEventListener('contextmenu', contextMenuHandler),
            () => window.removeEventListener('resize', resizeHandler)
        );
        
        // Handle browser zoom changes with proper cleanup
        let lastDevicePixelRatio = window.devicePixelRatio;
        const checkZoomChange = () => {
            if (window.devicePixelRatio !== lastDevicePixelRatio) {
                lastDevicePixelRatio = window.devicePixelRatio;
                this.updateCanvasSize();
            }
        };
        
        // Store interval ID for cleanup
        const zoomCheckInterval = setInterval(checkZoomChange, 500);
        this.intervalIds.push(zoomCheckInterval);
        
        // Also check on wheel events
        const wheelZoomHandler = (e) => {
            if (e.ctrlKey) {
                setTimeout(checkZoomChange, 100);
            }
        };
        window.addEventListener('wheel', wheelZoomHandler);
        this.eventCleanupFunctions.push(() => window.removeEventListener('wheel', wheelZoomHandler));
    }

    setupUICallbacks() {
        // Override UI manager callbacks
        this.ui.onSliderChange = (sliderId, value) => this.onSliderChange(sliderId, value);
        this.ui.onButtonClick = (buttonId) => this.onButtonClick(buttonId);
        this.ui.onCheckboxChange = (checkboxId, checked) => this.onCheckboxChange(checkboxId, checked);
        this.ui.onColorChange = (color) => this.onColorChange(color);
        this.ui.onPresetSelect = (preset) => this.onPresetSelect(preset);
        this.ui.onFileLoad = (file) => this.onFileLoad(file);
        this.ui.onKeyDown = (event) => this.onKeyDown(event);
        this.ui.onPerformanceSettingChange = (setting, value) => this.onPerformanceSettingChange(setting, value);
        this.ui.onCollisionTypeChange = (type) => this.onCollisionTypeChange(type);
        this.ui.onRestitutionChange = (value) => this.onRestitutionChange(value);
    }

    setupCanvas() {
        this.updateCanvasSize();
    }

    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        
        // Set canvas internal resolution to match display size for crisp rendering
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;
        
        // Scale the canvas back down using CSS
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Update renderer with actual canvas size
        this.renderer.width = this.canvas.width;
        this.renderer.height = this.canvas.height;
        this.renderer.devicePixelRatio = devicePixelRatio;
        this.renderer.setupCanvas();
    }

    // Main game loop
    startMainLoop() {
        const loop = (currentTime) => {
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;
            
            this.update(deltaTime / 1000); // Convert to seconds
            this.render();
            this.updatePerformanceMetrics(currentTime);
            
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);
    }

    // This update method is replaced by the enhanced version below with Web Worker support

    render() {
        this.renderer.render(this.bodies, this.physics, this.selectedBody);
    }

    updatePerformanceMetrics(currentTime) {
        this.frameCount++;
        
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
            this.ui.updateFPS(this.currentFPS);
            
            // Update performance panel
            const performanceStats = this.physics.getPerformanceStats();
            performanceStats.fps = this.currentFPS;
            performanceStats.bodyCount = this.bodies.length;
            
            // Add GPU status to performance stats
            if (this.useGPU && this.physics.gpuPhysics && this.physics.gpuPhysics.isReady()) {
                performanceStats.method = `${performanceStats.method} (GPU)`;
                performanceStats.gpuAccelerated = true;
            } else {
                performanceStats.gpuAccelerated = false;
            }
            
            this.ui.updatePerformanceStats(performanceStats);
            
            // Update energy display
            const energyStats = this.physics.getEnergyStats();
            if (this.initialEnergy === null && energyStats.total !== 0) {
                this.initialEnergy = energyStats.total;
            }
            energyStats.initial = this.initialEnergy;
            this.ui.updateEnergyDisplay(energyStats);
            this.ui.updateEnergyChart(energyStats);
        }
    }

    updateUI() {
        // Update simulation status
        const status = this.isRunning ? (this.isPaused ? 'Paused' : 'Running') : 'Stopped';
        this.ui.updateStatus(status);
        
        // Update info panel
        const stats = this.physics.getSystemStats(this.bodies);
        this.ui.updateInfoPanel({
            bodyCount: this.bodies.length,
            totalMass: stats.totalMass,
            kineticEnergy: stats.kineticEnergy,
            potentialEnergy: stats.potentialEnergy
        });
        
        // Update mouse position
        this.ui.updateMousePosition(this.mousePos.x, this.mousePos.y);
        
        // Update selected body panel
        this.ui.updateSelectedBodyPanel(this.selectedBody);
        
        // Update play/pause button
        this.ui.updatePlayPauseButton(this.isRunning, this.isPaused);
        
        // Update dynamic reference panel if enabled
        this.updateDynamicReference();
    }

    // Event handlers
    onMouseDown(event) {
        this.debugMousePosition(event);
        
        const mousePos = this.getMousePosition(event);
        const worldPos = this.renderer.screenToWorld(mousePos.x, mousePos.y);
        
        this.mousePos = worldPos;
        this.lastMousePos = new Vector2D(mousePos.x, mousePos.y);
        this.dragStartPosition = worldPos.clone();
        
        if (event.button === 0) { // Left click
            const clickedBody = this.findBodyAtPosition(worldPos);
            
            if (clickedBody) {
                // Click on existing body: start dragging
                this.selectBody(clickedBody);
                this.isDragging = true;
                this.draggedBody = clickedBody;
                this.dragOffset = worldPos.subtract(clickedBody.position);
                this.canvas.style.cursor = 'grabbing';
                
                // Set visual state
                clickedBody.setBeingDragged(true);
                
                // Store original velocity for potential restoration
                this.draggedBody.originalVelocity = this.draggedBody.velocity.clone();
                
                // Optionally pause simulation while dragging
                if (this.isRunning && !this.isPaused) {
                    this.wasPausedForDrag = false;
                } else {
                    this.wasPausedForDrag = true;
                }
            } else {
                // Click on empty space: add new body or clear selection
                if (this.ui.isOrbitMode() && this.bodies.length > 0) {
                    // In orbit mode, don't add immediately - wait for mouse up
                    this.isAddingBody = true;
                } else {
                    // Regular mode: add body immediately
                    this.addBodyAtPosition(worldPos);
                }
                this.selectedBody = null;
            }
        } else if (event.button === 2) { // Right click
            const clickedBody = this.findBodyAtPosition(worldPos);
            if (clickedBody) {
                this.selectBody(clickedBody);
                // Show context menu options in the future
            } else {
                this.selectedBody = null;
            }
        }
    }

    onMouseMove(event) {
        const mousePos = this.getMousePosition(event);
        const worldPos = this.renderer.screenToWorld(mousePos.x, mousePos.y);
        
        this.mousePos = worldPos;
        this.mousePosition = worldPos; // For consistency with other references
        
        if (this.isDragging && this.draggedBody) {
            // Update dragged body position
            const newPosition = worldPos.subtract(this.dragOffset);
            this.draggedBody.setPosition(newPosition);
            
            // Update UI sliders to reflect new position if this is the selected body
            if (this.draggedBody === this.selectedBody) {
                this.ui.updateSelectedBodyPanel(this.selectedBody);
                this.updateDynamicReference(); // Update reference panel in real-time
            }
            
            // If in orbit mode, update the orbit preview in real-time
            if (this.ui.isOrbitMode()) {
                this.updateOrbitPreviewForDraggedBody();
            }
            
        } else if (event.buttons === 4 || (event.buttons === 1 && event.ctrlKey)) {
            // Middle mouse or Ctrl+left mouse: pan camera
            const deltaX = mousePos.x - this.lastMousePos.x;
            const deltaY = mousePos.y - this.lastMousePos.y;
            this.renderer.panCamera(-deltaX, -deltaY);
            
        } else if (this.ui.isOrbitMode() && this.bodies.length > 0) {
            this.updateOrbitPreview(worldPos);
        }
        
        this.lastMousePos = new Vector2D(mousePos.x, mousePos.y);
        
        // Update cursor based on what's under the mouse
        this.updateCursor(worldPos);
    }

    onMouseUp(event) {
        if (this.isDragging && this.draggedBody) {
            // Finished dragging a body
            this.isDragging = false;
            
            // Clear drag visual state
            this.draggedBody.setBeingDragged(false);
            
            // If in orbit mode, calculate and apply orbital velocity
            if (this.ui.isOrbitMode() && this.bodies.length > 1) {
                this.applyOrbitVelocityToDraggedBody();
            } else {
                // In normal mode, you can choose to keep velocity or reset it
                // For now, we'll preserve the original velocity
                // this.draggedBody.velocity = this.draggedBody.originalVelocity.clone();
            }
            
            this.draggedBody = null;
            this.canvas.style.cursor = 'crosshair';
            
            // Clear orbit preview
            this.renderer.setOrbitPreview(false);
            this.renderer.setLongTermPreview(false);
            
        } else if (this.isAddingBody && event.button === 0) {
            // Finished adding a new body
            this.isAddingBody = false;
            if (this.ui.isOrbitMode() && this.bodies.length > 0) {
                this.addBodyAtPosition(this.mousePos);
                
                // After adding a body, refresh orbit preview for potential next body
                setTimeout(() => {
                    if (this.ui.isOrbitMode() && this.mousePosition && this.bodies.length > 0) {
                        this.updateOrbitPreview(this.mousePosition);
                    }
                }, 50);
            }
        }
        
        // Update cursor for what's under the mouse now
        this.updateCursor(this.mousePos);
    }

    onMouseWheel(event) {
        event.preventDefault();
        const mousePos = this.getMousePosition(event);
        
        if (event.deltaY < 0) {
            this.renderer.zoomIn(mousePos.x, mousePos.y);
        } else {
            this.renderer.zoomOut(mousePos.x, mousePos.y);
        }
    }

    onWindowResize() {
        this.updateCanvasSize();
        // Debug coordinates after resize
        if (window.location.hash === '#debug') {
            this.renderer.debugCoordinates();
        }
    }

    // UI event handlers
    onSliderChange(sliderId, value) {
        switch (sliderId) {
            case 'gravity-strength':
                this.physics.setGravitationalConstant(100 * value);
                break;
            case 'time-scale':
                this.physics.setTimeScale(value);
                break;
            case 'prediction-depth':
                // Update the renderer's prediction depth and refresh orbit preview
                this.renderer.setPredictionDepth(value);
                if (this.ui.orbitMode && this.mousePosition && this.ui.getCheckboxValue('long-term-preview')) {
                    this.updateOrbitPreview(this.mousePosition);
                }
                break;
            case 'body-mass':
                if (this.selectedBody) {
                    // Ensure mass is never zero or negative
                    const safeMass = Math.max(0.1, value || 0.1);
                    this.selectedBody.mass = safeMass;
                    this.selectedBody.updateRadius();
                    this.updateDynamicReference(); // Update reference panel
                    
                    // Update UI if the value was corrected
                    if (safeMass !== value) {
                        this.ui.updateSlider('body-mass', safeMass);
                    }
                }
                
                // Update orbit preview in orbit mode since mass affects orbital dynamics
                if (this.ui.orbitMode && this.mousePosition) {
                    this.updateOrbitPreview(this.mousePosition);
                }
                break;
            case 'velocity-x':
                if (this.selectedBody) {
                    this.selectedBody.velocity.x = value;
                    this.updateDynamicReference(); // Update reference panel
                }
                break;
            case 'velocity-y':
                if (this.selectedBody) {
                    this.selectedBody.velocity.y = value;
                    this.updateDynamicReference(); // Update reference panel
                }
                break;
            case 'trail-length':
                if (this.selectedBody) {
                    this.selectedBody.maxTrailLength = Math.round(value);
                }
                break;
        }
    }

    onButtonClick(buttonId) {
        switch (buttonId) {
            case 'play-pause':
                this.toggleSimulation();
                break;
            case 'reset':
                this.resetSimulation();
                break;
            case 'clear':
                this.clearAll();
                break;
            case 'zoom-in':
                this.renderer.zoomIn(this.renderer.width / 2, this.renderer.height / 2);
                break;
            case 'zoom-out':
                this.renderer.zoomOut(this.renderer.width / 2, this.renderer.height / 2);
                break;
            case 'center-view':
                this.renderer.camera.x = 0;
                this.renderer.camera.y = 0;
                break;
            case 'fit-view':
                this.renderer.fitAllBodies(this.bodies);
                break;
            case 'save-config':
                this.saveConfiguration();
                break;
            case 'load-config':
                this.ui.triggerFileLoad();
                break;
            case 'export-video':
                this.ui.showNotification('Video export not yet implemented', 'info');
                break;
            case 'delete-selected':
                this.deleteSelectedBody();
                break;
        }
    }

    onCheckboxChange(checkboxId, checked) {
        switch (checkboxId) {
            case 'collision-enabled':
                this.physics.setCollisionEnabled(checked);
                break;
            case 'show-trails':
                this.renderer.setShowTrails(checked);
                break;
            case 'show-grid':
                this.renderer.setShowGrid(checked);
                break;
            case 'show-forces':
                this.renderer.setShowForces(checked);
                break;
            case 'long-term-preview':
                this.renderer.showLongTermPreview = checked;
                // Trigger a recalculation of orbit preview if in orbit mode
                if (this.ui.orbitMode && this.mousePosition) {
                    this.updateOrbitPreview(this.mousePosition);
                }
                break;
            case 'show-collision-bounds':
                this.renderer.setShowCollisionBounds(checked);
                break;
            case 'adaptive-timestep':
                this.physics.setConfiguration({ adaptiveTimeStep: checked });
                break;
            case 'web-workers':
                this.setWebWorkersEnabled(checked);
                break;
        }
    }

    onCollisionTypeChange(type) {
        this.physics.setCollisionType(type);
    }

    onRestitutionChange(value) {
        this.physics.setRestitutionCoefficient(value);
    }

    onColorChange(color) {
    }

    onPresetSelect(preset) {
        this.loadPreset(preset);
    }

    onFileLoad(file) {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    this.loadConfiguration(config);
                    this.ui.showNotification('Configuration loaded successfully!', 'success');
                } catch (error) {
                    this.ui.showNotification('Error loading configuration: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        }
    }

    onKeyDown(event) {
        // Ignore if typing in input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key.toLowerCase()) {
            case ' ':
                event.preventDefault();
                this.toggleSimulation();
                break;
            case 'r':
                this.resetSimulation();
                break;
            case 'c':
                this.clearAll();
                break;
            case 't':
                const showTrails = this.ui.getCheckboxValue('show-trails');
                this.ui.updateCheckbox('show-trails', !showTrails);
                this.renderer.setShowTrails(!showTrails);
                break;
            case 'g':
                const showGrid = this.ui.getCheckboxValue('show-grid');
                this.ui.updateCheckbox('show-grid', !showGrid);
                this.renderer.setShowGrid(!showGrid);
                break;
            case 'f':
                const showForces = this.ui.getCheckboxValue('show-forces');
                this.ui.updateCheckbox('show-forces', !showForces);
                this.renderer.setShowForces(!showForces);
                break;
            case 'delete':
                this.deleteSelectedBody();
                break;
            case '?':
            case 'f1':
                event.preventDefault();
                this.ui.showModal();
                break;
            case 'i':
                this.toggleReferencePanel();
                break;
            case 'escape':
                this.ui.hideModal();
                this.selectedBody = null;
                break;
        }
    }

    // Simulation control methods
    toggleSimulation() {
        if (this.isRunning) {
            this.isPaused = !this.isPaused;
        } else {
            this.isRunning = true;
            this.isPaused = false;
        }
    }

    startSimulation() {
        this.isRunning = true;
        this.isPaused = false;
        
        // Clear orbit previews when simulation starts
        this.renderer.setOrbitPreview(false);
        this.renderer.setLongTermPreview(false);
    }

    pauseSimulation() {
        this.isPaused = true;
    }

    stopSimulation() {
        this.isRunning = false;
        this.isPaused = false;
    }

    resetSimulation() {
        this.physics.resetBodies(this.bodies);
        this.isRunning = false;
        this.isPaused = false;
        
        // Clear orbit previews
        this.renderer.setOrbitPreview(false);
        this.renderer.setLongTermPreview(false);
        
        this.ui.showNotification('Simulation reset', 'info');
    }

    clearAll() {
        this.bodies = [];
        this.selectedBody = null;
        this.isRunning = false;
        this.isPaused = false;
        
        // Clear orbit previews
        this.renderer.setOrbitPreview(false);
        this.renderer.setLongTermPreview(false);
        
        this.updateDynamicReference(); // Update reference panel after clearing
        this.ui.showNotification('All bodies cleared', 'info');
    }

    // Body management
    addBodyAtPosition(position) {
        let mass = this.ui.getSliderValue('body-mass');
        // Ensure mass is never zero or negative
        mass = Math.max(0.1, mass || 50); // Default to 50 if invalid
        
        const trailLength = this.ui.getSliderValue('trail-length');
        const color = this.ui.getSelectedColor();
        
        let velocity = new Vector2D(0, 0);
        
        if (this.ui.isOrbitMode()) {
            // Find nearest body to orbit around
            const targetBody = this.findNearestBody(position);
            
            if (targetBody) {
                // Calculate orbital velocity
                velocity = this.ui.calculateOrbitalVelocity(targetBody, position, this.physics.gravitationalConstant);
                this.ui.showNotification(`Orbiting around nearest body (mass: ${targetBody.mass})`, 'success');
            } else {
                this.ui.showNotification('No bodies found to orbit around', 'warning');
            }
        } else {
            // Manual mode: use slider values
            const vx = this.ui.getSliderValue('velocity-x');
            const vy = this.ui.getSliderValue('velocity-y');
            velocity = new Vector2D(vx, vy);
        }
        
        const body = new Body(
            position,
            velocity,
            mass,
            color,
            Math.round(trailLength)
        );
        
        this.bodies.push(body);
        
        // IMPORTANT: Calculate initial forces for the new body immediately if simulation is running
        // This ensures the body participates in physics from the first frame
        if (this.isRunning && !this.isPaused) {
            // Use setTimeout to ensure the body is fully added to the array first
            setTimeout(() => {
                this.calculateInitialForcesForBody(body);
            }, 0);
        }
        
        this.selectBody(body, true); // Pass flag to indicate this is a new body
        
        // Reset velocity sliders to zero for the next body (in manual mode)
        // In orbit mode, keep them as they show the calculated orbital velocity
        if (!this.ui.isOrbitMode()) {
            this.ui.setSliderValue('velocity-x', 0);
            this.ui.setSliderValue('velocity-y', 0);
        }
        
        // If we're still in orbit mode and have a mouse position, update orbit preview immediately
        // This ensures the preview shows up for the next potential body
        if (this.ui.isOrbitMode() && this.mousePosition && this.bodies.length > 0) {
            // Use a small timeout to ensure the body is fully added and processed
            setTimeout(() => {
                this.updateOrbitPreview(this.mousePosition);
            }, 10);
        }
    }

    // Calculate initial forces for a newly added body
    calculateInitialForcesForBody(newBody) {
        // Reset the new body's force
        newBody.resetForce();
        
        // Calculate forces between the new body and all existing bodies
        for (const existingBody of this.bodies) {
            if (existingBody === newBody) continue; // Skip self
            
            // Calculate force between new body and existing body
            const force = newBody.calculateGravitationalForce(
                existingBody, 
                this.physics.gravitationalConstant, 
                this.physics.softeningParameter
            );
            
            // Apply force to new body only
            // The regular physics will handle the reciprocal forces in the next step
            newBody.applyForce(force);
        }
        
        debugLog(`Initial force calculated for new body: ${newBody.force.magnitude().toFixed(2)}`);
    }

    findNearestBody(position) {
        let nearestBody = null;
        let minDistance = Infinity;
        
        for (const body of this.bodies) {
            const distance = body.position.distance(position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestBody = body;
            }
        }
        
        return nearestBody;
    }

    // Update orbit preview for a body being dragged
    updateOrbitPreviewForDraggedBody() {
        if (!this.draggedBody || !this.ui.orbitMode) return;
        
        // Calculate orbit preview from the dragged body's new position
        const draggedBodyPos = this.draggedBody.position.clone();
        
        // Find the most massive body (excluding the dragged body) to orbit around
        let primaryBody = null;
        let maxMass = 0;
        
        this.bodies.forEach(body => {
            if (body !== this.draggedBody && body.mass > maxMass) {
                maxMass = body.mass;
                primaryBody = body;
            }
        });
        
        if (primaryBody) {
            // Calculate orbital velocity for the dragged body at its new position
            const orbitalVelocity = this.ui.calculateOrbitalVelocity(primaryBody, draggedBodyPos, this.physics.gravitationalConstant);
            
            // Create a temporary body for orbit preview
            const tempBody = new Body(
                new Vector2D(draggedBodyPos.x, draggedBodyPos.y),
                new Vector2D(orbitalVelocity.x, orbitalVelocity.y),
                this.draggedBody.mass,
                this.draggedBody.color,
                this.draggedBody.color
            );
            
            // Calculate and render orbit preview
            this.renderer.renderOrbitPreview([tempBody], this.bodies, this.physics, 500);
        }
    }

    updateOrbitPreview(mousePosition) {
        const targetBody = this.findNearestBody(mousePosition);
        
        if (!targetBody) {
            this.renderer.setOrbitPreview(false);
            this.renderer.setLongTermPreview(false);
            return;
        }
        
        // Get current settings
        const mass = this.ui.getSliderValue('body-mass');
        const color = this.ui.getSelectedColor();
        
        // Calculate orbital velocity
        const velocity = this.ui.calculateOrbitalVelocity(targetBody, mousePosition, this.physics.gravitationalConstant);
        
        // Create a preview body
        const previewBody = new Body(mousePosition, velocity, mass, color);
        
        // Calculate regular orbit preview
        const orbitData = this.renderer.calculateOrbitPreview(previewBody, this.bodies, this.physics);
        
        // Show the regular preview
        this.renderer.setOrbitPreview(true, orbitData);
        
        // Calculate long-term preview if enabled
        if (this.renderer.showLongTermPreview) {
            const longTermData = this.renderer.calculateLongTermOrbitPreview(previewBody, this.bodies, this.physics);
            this.renderer.setLongTermPreview(true, longTermData);
        } else {
            this.renderer.setLongTermPreview(false);
        }
    }

    findBodyAtPosition(position) {
        let closestBody = null;
        let minDistance = Infinity;
        const maxClickRadius = 20; // Larger hit area for easier clicking
        
        // Check from last to first (top to bottom in rendering order)
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            const body = this.bodies[i];
            const distance = body.position.distance(position);
            const hitRadius = Math.max(body.radius, 8); // Minimum 8 pixel hit radius
            
            if (distance <= hitRadius) {
                // Direct hit - return immediately
                return body;
            } else if (distance <= maxClickRadius && distance < minDistance) {
                // Within extended click area - track closest
                closestBody = body;
                minDistance = distance;
            }
        }
        
        return closestBody;
    }

    selectBody(body, isNewBody = false) {
        // Deselect previous body
        if (this.selectedBody) {
            this.selectedBody.setSelected(false);
        }
        
        // Only clear orbit previews when selecting existing bodies, not when adding new ones
        if (!isNewBody) {
            this.renderer.setOrbitPreview(false);
            this.renderer.setLongTermPreview(false);
        }
        
        this.selectedBody = body;
        
        if (body) {
            body.setSelected(true);
            
            // Update UI sliders to match body properties
            this.ui.updateSlider('body-mass', body.mass);
            this.ui.updateSlider('velocity-x', body.velocity.x);
            this.ui.updateSlider('velocity-y', body.velocity.y);
            this.ui.updateSlider('trail-length', body.maxTrailLength);
        }
        
        // Update dynamic reference panel
        this.updateDynamicReference();
    }

    deleteSelectedBody() {
        if (this.selectedBody) {
            const index = this.bodies.indexOf(this.selectedBody);
            if (index !== -1) {
                this.bodies.splice(index, 1);
                this.selectedBody = null;
                this.updateDynamicReference(); // Update reference panel after deletion
                this.ui.showNotification('Body deleted', 'info');
            }
        }
    }

    // Preset and configuration management
    loadPreset(presetName) {
        try {
            this.bodies = Presets.getPreset(presetName);
            this.selectedBody = null;
            this.isRunning = false;
            this.isPaused = false;
            
            // Fit view to show all bodies
            setTimeout(() => {
                this.renderer.fitAllBodies(this.bodies);
            }, 100);
            
            this.ui.showNotification(`Loaded preset: ${presetName}`, 'success');
        } catch (error) {
            this.ui.showNotification('Error loading preset: ' + error.message, 'error');
        }
    }

    saveConfiguration() {
        const config = {
            bodies: this.bodies.map(body => body.toJSON()),
            physics: {
                gravitationalConstant: this.physics.gravitationalConstant,
                timeScale: this.physics.timeScale,
                collisionEnabled: this.physics.collisionEnabled
            },
            renderer: {
                showTrails: this.renderer.showTrails,
                showGrid: this.renderer.showGrid,
                showForces: this.renderer.showForces
            },
            camera: {
                x: this.renderer.camera.x,
                y: this.renderer.camera.y,
                zoom: this.renderer.camera.zoom
            },
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const filename = `nbody-config-${new Date().toISOString().slice(0, 10)}.json`;
        const content = JSON.stringify(config, null, 2);
        
        this.ui.downloadFile(filename, content);
        this.ui.showNotification('Configuration saved!', 'success');
    }

    loadConfiguration(config) {
        try {
            // Load bodies
            this.bodies = config.bodies.map(bodyData => Body.fromJSON(bodyData));
            
            // Load physics settings
            if (config.physics) {
                this.physics.gravitationalConstant = config.physics.gravitationalConstant || 100;
                this.physics.timeScale = config.physics.timeScale || 1.0;
                this.physics.collisionEnabled = config.physics.collisionEnabled !== false;
                
                // Update UI
                this.ui.updateSlider('gravity-strength', this.physics.gravitationalConstant / 100);
                this.ui.updateSlider('time-scale', this.physics.timeScale);
                this.ui.updateCheckbox('collision-enabled', this.physics.collisionEnabled);
            }
            
            // Load renderer settings
            if (config.renderer) {
                this.renderer.showTrails = config.renderer.showTrails !== false;
                this.renderer.showGrid = config.renderer.showGrid !== false;
                this.renderer.showForces = config.renderer.showForces === true;
                
                // Update UI
                this.ui.updateCheckbox('show-trails', this.renderer.showTrails);
                this.ui.updateCheckbox('show-grid', this.renderer.showGrid);
                this.ui.updateCheckbox('show-forces', this.renderer.showForces);
            }
            
            // Load camera settings
            if (config.camera) {
                this.renderer.camera.x = config.camera.x || 0;
                this.renderer.camera.y = config.camera.y || 0;
                this.renderer.camera.zoom = config.camera.zoom || 1.0;
                this.renderer.camera.targetZoom = this.renderer.camera.zoom;
            }
            
            this.selectedBody = null;
            this.isRunning = false;
            this.isPaused = false;
            
        } catch (error) {
            throw new Error('Invalid configuration format: ' + error.message);
        }
    }

    // Performance settings handler
    onPerformanceSettingChange(setting, value) {
        switch (setting) {
            case 'integration-method':
                this.physics.setConfiguration({ integrationMethod: value });
                break;
            case 'physics-method':
                this.physics.setConfiguration({ forceCalculationMethod: value });
                break;
            case 'force-method':
                this.physics.setConfiguration({ forceCalculationMethod: value });
                break;
            case 'barnes-hut-theta':
                this.physics.setConfiguration({ barnesHutTheta: value });
                break;
            case 'gpu-acceleration':
                this.setGPUEnabled(value);
                break;
            case 'adaptive-timestep':
                this.physics.setConfiguration({ adaptiveTimeStep: value });
                break;
        }
    }

    // GPU acceleration control
    setGPUEnabled(enabled) {
        const gpuPhysics = this.physics.gpuPhysics;
        if (!gpuPhysics || !gpuPhysics.isReady() && enabled) {
            this.ui.showNotification('GPU acceleration not supported on this device', 'warning');
            const gpuCheckbox = document.getElementById('gpu-acceleration');
            const gpuToggle = document.getElementById('gpu-toggle');
            if (gpuCheckbox) gpuCheckbox.checked = false;
            if (gpuToggle) gpuToggle.checked = false;
            this.ui.updateComputeModeDisplay('CPU');
            return;
        }
        
        this.useGPU = enabled;
        this.physics.setConfiguration({ useGPUPhysics: enabled });
        
        // Update toggle state if changed programmatically
        const gpuToggle = document.getElementById('gpu-toggle');
        if (gpuToggle && gpuToggle.checked !== enabled) {
            gpuToggle.checked = enabled;
        }
        
        // Update display
        this.ui.updateComputeModeDisplay(enabled ? 'GPU' : 'CPU');
        
        if (enabled) {
            console.log('GPU acceleration enabled');
            this.ui.showNotification('GPU acceleration enabled', 'success');
        } else {
            console.log('GPU acceleration disabled');
            this.ui.showNotification('GPU acceleration disabled', 'info');
        }
    }

    // Web Workers control
    setWebWorkersEnabled(enabled) {
        this.useWebWorkers = enabled;
        
        if (enabled && !this.physicsWorker) {
            this.initializeWebWorker();
        } else if (!enabled && this.physicsWorker) {
            this.physicsWorker.terminate();
            this.physicsWorker = null;
            this.workerBusy = false;
        }
    }

    // Initialize Web Worker for background physics
    initializeWebWorker() {
        try {
            this.physicsWorker = new Worker('js/physics-worker.js');
            
            this.physicsWorker.onmessage = (e) => {
                const { type, data } = e.data;
                
                switch (type) {
                    case 'simulation-result':
                        // Check if worker is still supposed to be busy (prevent race conditions)
                        if (!this.workerBusy) {
                            console.warn('Received worker result but worker not marked as busy - ignoring stale result');
                            return;
                        }
                        
                        // Validate worker data before using it
                        if (!data || !Array.isArray(data.bodies)) {
                            console.warn('Invalid worker data received, ignoring');
                            this.workerBusy = false;
                            return;
                        }
                        
                        // Update bodies with worker results
                        this.updateBodiesFromWorker(data.bodies);
                        
                        // Update energy tracking
                        if (data.energy) {
                            this.physics.totalKineticEnergy = data.energy.kinetic || 0;
                            this.physics.totalPotentialEnergy = data.energy.potential || 0;
                            this.physics.totalEnergy = data.energy.total || 0;
                        }
                        
                        // Mark worker as no longer busy
                        this.workerBusy = false;
                        
                        // Clear timeout since worker completed successfully
                        if (this.workerTimeoutId) {
                            clearTimeout(this.workerTimeoutId);
                            this.workerTimeoutId = null;
                        }
                        
                        // Reset timeout counter on successful completion
                        this.workerTimeoutCount = 0;
                        break;
                        
                    case 'error':
                        console.error('Physics worker error:', data.message);
                        this.workerBusy = false; // Ensure flag is cleared on error
                        this.setWebWorkersEnabled(false);
                        break;
                        
                    default:
                        console.warn('Unknown worker message type:', type);
                        break;
                }
            };
            
            this.physicsWorker.onerror = (error) => {
                console.error('Physics worker error:', error);
                this.workerBusy = false; // Ensure flag is cleared on error
                this.setWebWorkersEnabled(false);
            };
            
            // Configure worker with current physics settings
            this.physicsWorker.postMessage({
                type: 'configure',
                data: {
                    gravitationalConstant: this.physics.gravitationalConstant,
                    softeningParameter: this.physics.softeningParameter,
                    barnesHutTheta: this.physics.barnesHutTheta
                }
            });
            
        } catch (error) {
            console.error('Failed to initialize Web Worker:', error);
            this.useWebWorkers = false;
        }
    }

    // Update bodies from worker results
    updateBodiesFromWorker(workerBodies) {
        if (!Array.isArray(workerBodies)) {
            console.warn('Invalid worker bodies data received');
            return;
        }
        
        workerBodies.forEach((workerBody, index) => {
            if (index < this.bodies.length && workerBody) {
                const body = this.bodies[index];
                
                // Validate worker body data before applying
                if (workerBody.position && 
                    typeof workerBody.position.x === 'number' && 
                    typeof workerBody.position.y === 'number' &&
                    isFinite(workerBody.position.x) && 
                    isFinite(workerBody.position.y)) {
                    body.position.x = workerBody.position.x;
                    body.position.y = workerBody.position.y;
                }
                
                if (workerBody.velocity && 
                    typeof workerBody.velocity.x === 'number' && 
                    typeof workerBody.velocity.y === 'number' &&
                    isFinite(workerBody.velocity.x) && 
                    isFinite(workerBody.velocity.y)) {
                    body.velocity.x = workerBody.velocity.x;
                    body.velocity.y = workerBody.velocity.y;
                }
                
                // Update energy values with validation
                if (typeof workerBody.kineticEnergy === 'number' && isFinite(workerBody.kineticEnergy)) {
                    body.kineticEnergy = workerBody.kineticEnergy;
                }
                if (typeof workerBody.potentialEnergy === 'number' && isFinite(workerBody.potentialEnergy)) {
                    body.potentialEnergy = workerBody.potentialEnergy;
                }
                
                // Update trails if needed (with validation)
                if (Array.isArray(workerBody.trail)) {
                    body.trail = workerBody.trail;
                }
            }
        });
    }

    // Enhanced update method with Web Worker and GPU support
    update(deltaTime) {
        // Validate and clean up bodies before physics update
        this.validateAndCleanBodies();
        
        if (this.isRunning && !this.isPaused) {
            if (this.useGPU && this.physics.gpuPhysics && this.physics.gpuPhysics.isReady() && this.bodies.length > 0) {
                // Use GPU acceleration for physics
                this.updateWithGPU(deltaTime);
            } else if (this.useWebWorkers && this.physicsWorker && !this.workerBusy && this.bodies.length > 8) {
                // Use Web Worker for large simulations
                this.updateWithWebWorker(deltaTime);
            } else {
                // Use main thread physics
                this.physics.update(this.bodies, deltaTime);
            }
        }
        
        this.updateUI();
    }

    // Update simulation using GPU acceleration
    updateWithGPU(deltaTime) {
        try {
            // Update bodies using GPU physics
            const gpuSuccess = this.physics.gpuPhysics.update(this.bodies, deltaTime);
            
            if (!gpuSuccess) {
                // GPU physics returned false, fall back to CPU for this frame only
                console.warn('GPU physics temporarily unavailable, falling back to CPU for this frame');
                this.physics.update(this.bodies, deltaTime);
                // Don't disable GPU permanently for temporary failures
            }
        } catch (error) {
            console.error('GPU physics update failed, disabling GPU acceleration:', error);
            // Permanently disable GPU physics due to error
            this.useGPU = false;
            this.physics.setConfiguration({ useGPUPhysics: false });
            
            // Update UI state consistently
            const gpuCheckbox = document.getElementById('gpu-acceleration');
            const gpuToggle = document.getElementById('gpu-toggle');
            if (gpuCheckbox) gpuCheckbox.checked = false;
            if (gpuToggle) gpuToggle.checked = false;
            this.ui.updateComputeModeDisplay('CPU');
            
            // Fallback to CPU physics for this frame
            this.physics.update(this.bodies, deltaTime);
            this.ui.showNotification('GPU acceleration failed, switched to CPU', 'warning');
        }
    }

    // Update simulation using Web Worker
    updateWithWebWorker(deltaTime) {
        if (this.workerBusy) {
            // Worker is busy, fall back to CPU physics for this frame
            this.physics.update(this.bodies, deltaTime);
            return;
        }
        
        this.workerBusy = true;
        
        try {
            // Serialize bodies for worker
            const serializedBodies = this.bodies.map(body => ({
                id: body.id,
                position: { x: body.position.x, y: body.position.y },
                velocity: { x: body.velocity.x, y: body.velocity.y },
                mass: body.mass,
                radius: body.radius,
                color: body.color,
                trail: body.trail || []
            }));
            
            // Send simulation step to worker
            this.physicsWorker.postMessage({
                type: 'simulate',
                data: {
                    bodies: serializedBodies,
                    deltaTime: deltaTime,
                    config: {
                        integrationMethod: this.physics.integrationMethod,
                        forceMethod: this.physics.forceCalculationMethod
                    }
                }
            });
            
            // Set a timeout to prevent worker from hanging indefinitely
            this.workerTimeoutId = setTimeout(() => {
                if (this.workerBusy) {
                    console.warn('Worker timeout - forcing worker busy flag reset');
                    this.workerBusy = false;
                    // Optionally restart the worker if it's consistently timing out
                    this.workerTimeoutCount = (this.workerTimeoutCount || 0) + 1;
                    if (this.workerTimeoutCount > 3) {
                        console.warn('Worker has timed out multiple times, disabling Web Worker');
                        this.setWebWorkersEnabled(false);
                    }
                }
            }, 150); // 150ms timeout
            
        } catch (error) {
            console.error('Error sending data to worker:', error);
            this.workerBusy = false;
            // Fall back to CPU physics
            this.physics.update(this.bodies, deltaTime);
        }
    }

    // Utility methods
    updateDynamicReference() {
        // Update the dynamic reference panel if visible
        if (this.ui.referenceShown) {
            this.ui.updateDynamicReference(this.bodies, this.selectedBody);
        }
    }

    updateGPUStatus() {
        // Update GPU status indicator in the UI
        const gpuStatus = document.getElementById('gpu-status');
        const gpuCheckbox = document.getElementById('gpu-acceleration');
        const gpuToggle = document.getElementById('gpu-toggle');
        
        const gpuPhysics = this.physics.gpuPhysics;
        
        if (gpuStatus && gpuCheckbox) {
            if (gpuPhysics && gpuPhysics.isReady()) {
                const gpuInfo = gpuPhysics.getPerformanceInfo();
                
                gpuStatus.textContent = 'Available';
                gpuStatus.className = 'gpu-status available';
                gpuStatus.title = `GPU.js ${gpuInfo.mode}\nMax Bodies: ${gpuInfo.maxBodies || 'Unknown'}`;
                gpuCheckbox.disabled = false;
                if (gpuToggle) gpuToggle.disabled = false;
                
                console.log('GPU acceleration is available:', gpuInfo);
            } else {
                gpuStatus.textContent = 'Not Available';
                gpuStatus.className = 'gpu-status unavailable';
                gpuStatus.title = 'GPU acceleration is not supported on this device';
                gpuCheckbox.disabled = true;
                gpuCheckbox.checked = false;
                if (gpuToggle) {
                    gpuToggle.disabled = true;
                    gpuToggle.checked = false;
                }
                this.useGPU = false;
                
                console.log('GPU acceleration not available');
            }
        }
        
        // Initialize compute mode display
        this.ui.updateComputeModeDisplay(this.useGPU ? 'GPU' : 'CPU');
    }

    validateAndCleanBodies() {
        // Remove any invalid bodies (NaN positions, etc.)
        this.bodies = this.bodies.filter(body => {
            if (!body || !body.position || !body.velocity) {
                console.warn('Removing invalid body:', body);
                return false;
            }
            
            if (isNaN(body.position.x) || isNaN(body.position.y) || 
                isNaN(body.velocity.x) || isNaN(body.velocity.y)) {
                console.warn('Removing body with NaN values:', body);
                return false;
            }
            
            return true;
        });
    }

    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return new Vector2D(
            (event.clientX - rect.left) * scaleX,
            (event.clientY - rect.top) * scaleY
        );
    }

    debugMousePosition(event) {
        // Debug helper for mouse position issues
        const rect = this.canvas.getBoundingClientRect();
        const clientPos = new Vector2D(event.clientX - rect.left, event.clientY - rect.top);
        const mousePos = this.getMousePosition(event);
        const worldPos = this.renderer.screenToWorld(mousePos.x, mousePos.y);
        
        console.debug('Mouse Debug:', {
            client: clientPos,
            screen: mousePos,
            world: worldPos,
            devicePixelRatio: this.renderer.devicePixelRatio
        });
    }

    // Get body at a specific world position (for mouse interactions)
    getBodyAtPosition(worldPos) {
        // Check bodies in reverse order (last drawn = on top)
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            const body = this.bodies[i];
            const distance = body.position.distance(worldPos);
            
            // Use a slightly larger radius for easier clicking
            const clickRadius = Math.max(body.radius, 15);
            
            if (distance <= clickRadius) {
                return body;
            }
        }
        return null;
    }

    // Update cursor based on what's under the mouse
    updateCursor(worldPos) {
        const bodyUnderMouse = this.getBodyAtPosition(worldPos);
        
        if (bodyUnderMouse) {
            // Mouse is over a body
            if (this.ui.orbitMode) {
                this.canvas.style.cursor = 'copy'; // Orbit mode - copy cursor
            } else {
                this.canvas.style.cursor = 'grab'; // Normal mode - grab cursor
            }
        } else if (this.ui.orbitMode && this.bodies.length > 0) {
            this.canvas.style.cursor = 'crosshair'; // Orbit mode with bodies available
        } else {
            this.canvas.style.cursor = 'crosshair'; // Default adding cursor
        }
        
        // Update cursor during drag operations
        if (this.isDragging) {
            this.canvas.style.cursor = 'grabbing';
        }
    }

    applyOrbitVelocityToDraggedBody() {
        if (!this.draggedBody || this.bodies.length < 2) {
            return;
        }

        // Find the nearest body to calculate orbital velocity around
        const draggedBodyPos = this.draggedBody.position;
        let nearestBody = null;
        let minDistance = Infinity;

        for (const body of this.bodies) {
            if (body === this.draggedBody) continue;
            
            const distance = draggedBodyPos.distance(body.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestBody = body;
            }
        }

        if (nearestBody) {
            // Calculate orbital velocity around the nearest body
            const orbitalVelocity = this.ui.calculateOrbitalVelocity(
                nearestBody, 
                draggedBodyPos, 
                this.physics.gravitationalConstant
            );
            
            // Apply the orbital velocity to the dragged body
            this.draggedBody.velocity = new Vector2D(orbitalVelocity.x, orbitalVelocity.y);
            
            debugLog(`Applied orbital velocity to dragged body: ${orbitalVelocity.magnitude().toFixed(2)}`);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.nbodyApp = new NBodyApp();
});

// Handle page visibility change to pause/resume simulation
document.addEventListener('visibilitychange', () => {
    if (window.nbodyApp) {
        if (document.hidden) {
            // Page is hidden, pause simulation to save resources
            window.nbodyApp.pauseSimulation();
        }
        // Note: We don't automatically resume when page becomes visible
        // to avoid unexpected behavior
    }
});

// Handle errors gracefully
window.addEventListener('error', (event) => {
    console.error('Application error:', event.error);
    if (window.nbodyApp && window.nbodyApp.ui) {
        window.nbodyApp.ui.showNotification('An error occurred. Check console for details.', 'error');
    }
});

// Prevent default drag behavior
document.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
document.addEventListener('dragover', (e) => e.preventDefault());
