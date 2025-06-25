// Main application class that ties everything together
class NBodyApp {
    constructor() {
        this.canvas = document.getElementById('simulation-canvas');
        this.renderer = new Renderer(this.canvas);
        this.physics = new PhysicsEngine();
        this.ui = new UIManager();
        
        // Simulation state
        this.bodies = [];
        this.selectedBody = null;
        this.isRunning = false;
        this.isPaused = false;
        this.lastFrameTime = 0;
        
        // Input handling
        this.mousePos = new Vector2D(0, 0);
        this.isDragging = false;
        this.isAddingBody = false;
        this.dragOffset = new Vector2D(0, 0);
        this.lastMousePos = new Vector2D(0, 0);
        
        // Performance tracking
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.currentFPS = 60;
        
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.setupUICallbacks();
        this.setupCanvas();
        
        // Hide loading screen after initialization
        setTimeout(() => {
            this.ui.hideLoading();
        }, 1000);
        
        // Start the main loop
        this.startMainLoop();
        
        // Initial UI update
        this.updateUI();
        
        console.log('N-Body Simulation initialized successfully!');
        this.ui.showNotification('N-Body Simulation loaded!', 'success');
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onMouseWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Window events
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Keyboard events are handled by UI manager
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
    }

    setupCanvas() {
        this.updateCanvasSize();
    }

    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.width = rect.width;
        this.renderer.height = rect.height;
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

    update(deltaTime) {
        if (this.isRunning && !this.isPaused) {
            this.physics.update(this.bodies, deltaTime);
        }
        
        this.updateUI();
    }

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
    }

    // Event handlers
    onMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const worldPos = this.renderer.screenToWorld(x, y);
        
        this.mousePos = worldPos;
        this.lastMousePos = new Vector2D(x, y);
        
        if (event.button === 0) { // Left click
            const clickedBody = this.findBodyAtPosition(worldPos);
            
            if (event.shiftKey && clickedBody) {
                // Shift+click: start dragging
                this.selectedBody = clickedBody;
                this.isDragging = true;
                this.dragOffset = worldPos.subtract(clickedBody.position);
                this.canvas.style.cursor = 'grabbing';
            } else if (clickedBody) {
                // Regular click: select body
                this.selectBody(clickedBody);
            } else {
                // Click on empty space: add new body
                this.addBodyAtPosition(worldPos);
            }
        } else if (event.button === 2) { // Right click
            const clickedBody = this.findBodyAtPosition(worldPos);
            this.selectBody(clickedBody);
        }
    }

    onMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const worldPos = this.renderer.screenToWorld(x, y);
        
        this.mousePos = worldPos;
        
        if (this.isDragging && this.selectedBody) {
            // Update body position
            this.selectedBody.setPosition(worldPos.subtract(this.dragOffset));
        } else if (event.buttons === 4 || (event.buttons === 1 && event.ctrlKey)) {
            // Middle mouse or Ctrl+left mouse: pan camera
            const deltaX = x - this.lastMousePos.x;
            const deltaY = y - this.lastMousePos.y;
            this.renderer.panCamera(-deltaX, -deltaY);
        }
        
        this.lastMousePos = new Vector2D(x, y);
        
        // Update cursor
        const hoveredBody = this.findBodyAtPosition(worldPos);
        if (hoveredBody && !this.isDragging) {
            this.canvas.style.cursor = 'pointer';
        } else if (!this.isDragging) {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    onMouseUp(event) {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }

    onMouseWheel(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (event.deltaY < 0) {
            this.renderer.zoomIn(x, y);
        } else {
            this.renderer.zoomOut(x, y);
        }
    }

    onWindowResize() {
        this.updateCanvasSize();
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
            case 'body-mass':
                if (this.selectedBody) {
                    this.selectedBody.mass = value;
                    this.selectedBody.updateRadius();
                }
                break;
            case 'velocity-x':
                if (this.selectedBody) {
                    this.selectedBody.velocity.x = value;
                }
                break;
            case 'velocity-y':
                if (this.selectedBody) {
                    this.selectedBody.velocity.y = value;
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
            case 'help-btn':
                this.ui.showModal();
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
        }
    }

    onColorChange(color) {
        // This will be used for new bodies
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
                this.ui.showModal();
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
        this.ui.showNotification('Simulation reset', 'info');
    }

    clearAll() {
        this.bodies = [];
        this.selectedBody = null;
        this.isRunning = false;
        this.isPaused = false;
        this.ui.showNotification('All bodies cleared', 'info');
    }

    // Body management
    addBodyAtPosition(position) {
        const mass = this.ui.getSliderValue('body-mass');
        const vx = this.ui.getSliderValue('velocity-x');
        const vy = this.ui.getSliderValue('velocity-y');
        const trailLength = this.ui.getSliderValue('trail-length');
        const color = this.ui.getSelectedColor();
        
        const body = new Body(
            position,
            new Vector2D(vx, vy),
            mass,
            color,
            Math.round(trailLength)
        );
        
        this.bodies.push(body);
        this.selectBody(body);
    }

    findBodyAtPosition(position) {
        // Check from last to first (top to bottom in rendering order)
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            if (this.bodies[i].containsPoint(position)) {
                return this.bodies[i];
            }
        }
        return null;
    }

    selectBody(body) {
        // Deselect previous body
        if (this.selectedBody) {
            this.selectedBody.setSelected(false);
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
    }

    deleteSelectedBody() {
        if (this.selectedBody) {
            const index = this.bodies.indexOf(this.selectedBody);
            if (index !== -1) {
                this.bodies.splice(index, 1);
                this.selectedBody = null;
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
