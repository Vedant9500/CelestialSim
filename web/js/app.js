// Main application class that ties everything together
class NBodyApp {
    constructor() {
        this.canvas = document.getElementById('simulation-canvas');
        this.renderer = new Renderer(this.canvas);
        this.physics = new PhysicsEngine();
        this.ui = new UIManager();
        
        // Pass renderer reference to UI for orbit preview
        this.ui.setRenderer(this.renderer);
        
        // Simulation state
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
        
        // Handle browser zoom changes
        let lastDevicePixelRatio = window.devicePixelRatio;
        const checkZoomChange = () => {
            if (window.devicePixelRatio !== lastDevicePixelRatio) {
                lastDevicePixelRatio = window.devicePixelRatio;
                this.updateCanvasSize();
            }
        };
        
        // Check for zoom changes periodically
        setInterval(checkZoomChange, 500);
        
        // Also check on various events that might indicate zoom change
        window.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                setTimeout(checkZoomChange, 100);
            }
        });
        
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

    update(deltaTime) {
        // Validate and clean up bodies before physics update
        this.validateAndCleanBodies();
        
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
            
        } else if (this.ui.isOrbitMode() && this.bodies.length > 0 && this.isAddingBody) {
            // Show orbit preview when adding a new body in orbit mode
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
            
        } else if (this.isAddingBody && event.button === 0) {
            // Finished adding a new body
            this.isAddingBody = false;
            if (this.ui.isOrbitMode() && this.bodies.length > 0) {
                this.addBodyAtPosition(this.mousePos);
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
            case 'help-btn':
                this.ui.showModal();
                break;
            case 'reference-toggle':
                this.toggleReferencePanel();
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
        this.selectBody(body);
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

    updateOrbitPreview(mousePosition) {
        const targetBody = this.findNearestBody(mousePosition);
        
        if (!targetBody) {
            this.renderer.setOrbitPreview(false);
            return;
        }
        
        // Get current settings
        const mass = this.ui.getSliderValue('body-mass');
        const color = this.ui.getSelectedColor();
        
        // Calculate orbital velocity
        const velocity = this.ui.calculateOrbitalVelocity(targetBody, mousePosition, this.physics.gravitationalConstant);
        
        // Create a preview body
        const previewBody = new Body(mousePosition, velocity, mass, color);
        
        // Calculate orbit preview
        const orbitData = this.renderer.calculateOrbitPreview(previewBody, this.bodies, this.physics);
        
        // Show the preview
        this.renderer.setOrbitPreview(true, orbitData);
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

    toggleReferencePanel() {
        const referencePanel = document.getElementById('reference-panel');
        const toggleButton = document.getElementById('reference-toggle');
        
        if (referencePanel && toggleButton) {
            const isShown = referencePanel.classList.contains('show');
            
            if (isShown) {
                referencePanel.classList.remove('show');
                toggleButton.innerHTML = '<i class="fas fa-ruler"></i> Scale Reference';
                toggleButton.title = 'Show Scale Reference';
            } else {
                referencePanel.classList.add('show');
                toggleButton.innerHTML = '<i class="fas fa-times"></i> Hide Reference';
                toggleButton.title = 'Hide Scale Reference';
            }
        }
    }

    updateCursor(worldPos) {
        // Clear previous hover states
        this.bodies.forEach(body => body.setHovered(false));
        
        if (this.isDragging) {
            this.canvas.style.cursor = 'grabbing';
        } else {
            const hoveredBody = this.findBodyAtPosition(worldPos);
            if (hoveredBody) {
                hoveredBody.setHovered(true);
                this.canvas.style.cursor = 'grab';
            } else if (this.ui.isOrbitMode()) {
                this.canvas.style.cursor = 'crosshair';
            } else {
                this.canvas.style.cursor = 'crosshair';
            }
        }
    }

    updateOrbitPreviewForDraggedBody() {
        if (!this.draggedBody || this.bodies.length < 2) return;
        
        // Create a temporary body for orbit preview calculation
        const previewBody = {
            position: this.draggedBody.position.clone(),
            velocity: new Vector2D(0, 0), // Will be calculated by orbit mode
            mass: this.draggedBody.mass,
            color: this.draggedBody.color
        };
        
        // Get other bodies (excluding the dragged one)
        const otherBodies = this.bodies.filter(body => body !== this.draggedBody);
        
        // Calculate orbital velocity
        const orbitalData = this.calculateOrbitVelocity(previewBody.position, otherBodies);
        if (orbitalData) {
            previewBody.velocity = orbitalData.velocity;
            
            // Calculate and show orbit preview
            const orbitData = this.renderer.calculateOrbitPreview(previewBody, otherBodies, this.physics);
            this.renderer.setOrbitPreview(true, orbitData);
        }
    }

    applyOrbitVelocityToDraggedBody() {
        if (!this.draggedBody || this.bodies.length < 2) return;
        
        // Get other bodies (excluding the dragged one)
        const otherBodies = this.bodies.filter(body => body !== this.draggedBody);
        
        // Calculate and apply orbital velocity
        const orbitalData = this.calculateOrbitVelocity(this.draggedBody.position, otherBodies);
        if (orbitalData) {
            this.draggedBody.velocity = orbitalData.velocity.clone();
            
            // Update UI to reflect new velocity
            if (this.draggedBody === this.selectedBody) {
                this.ui.updateSelectedBodyPanel(this.selectedBody);
            }
            
            console.log(`Applied orbital velocity: (${orbitalData.velocity.x.toFixed(2)}, ${orbitalData.velocity.y.toFixed(2)}) around body at distance ${orbitalData.distance.toFixed(2)}`);
        }
    }

    calculateOrbitVelocity(position, otherBodies) {
        if (otherBodies.length === 0) return null;
        
        // Find the closest body to orbit around
        let targetBody = null;
        let minDistance = Infinity;
        
        for (const body of otherBodies) {
            const distance = body.position.distance(position);
            if (distance < minDistance && distance > 0) {
                minDistance = distance;
                targetBody = body;
            }
        }
        
        if (!targetBody) return null;
        
        const direction = targetBody.position.subtract(position);
        const distance = direction.magnitude();
        
        if (distance === 0) return null;
        
        // Calculate orbital speed: v = sqrt(GM/r)
        const gravitationalConstant = this.physics.gravitationalConstant;
        const orbitalSpeed = Math.sqrt(gravitationalConstant * targetBody.mass / distance);
        
        // Get perpendicular direction for circular orbit (counterclockwise)
        const perpendicular = new Vector2D(-direction.y, direction.x).normalize();
        
        // Add the target body's velocity to make the orbit relative to the moving target
        const relativeVelocity = perpendicular.multiply(orbitalSpeed);
        const absoluteVelocity = relativeVelocity.add(targetBody.velocity);
        
        return {
            velocity: absoluteVelocity,
            targetBody: targetBody,
            distance: distance,
            orbitalSpeed: orbitalSpeed
        };
    }

    updateDynamicReference() {
        const selectedBodyInfo = document.getElementById('selected-body-info');
        const referenceTitle = document.getElementById('reference-title');
        const noteText = document.getElementById('reference-note-text');
        
        if (this.selectedBody) {
            // Show selected body section
            selectedBodyInfo.style.display = 'block';
            referenceTitle.textContent = `Scale Reference - Body #${this.selectedBody.id}`;
            
            // Update body information
            this.updateSelectedBodyReference();
            
            // Update note
            noteText.textContent = `Selected body is ${this.getBodyMassComparison(this.selectedBody.mass)}. Drag to move or adjust properties!`;
            
            // Show relevant comparison bodies
            this.updateComparisonBodies();
            
        } else {
            // Hide selected body section
            selectedBodyInfo.style.display = 'none';
            referenceTitle.textContent = 'Real-World Scale Reference';
            noteText.textContent = 'Select a body to see detailed real-world comparisons and scale information!';
            
            // Hide all comparison bodies
            this.hideAllComparisonBodies();
        }
    }

    updateSelectedBodyReference() {
        if (!this.selectedBody) return;
        
        const body = this.selectedBody;
        
        // Mass
        const massValue = document.getElementById('body-mass-value');
        const massReal = document.getElementById('body-mass-real');
        if (massValue && massReal) {
            massValue.textContent = `${body.mass.toFixed(1)} units`;
            massReal.textContent = `≈ ${this.formatScientific(body.mass * 5.97e24)} kg`;
        }
        
        // Position
        const positionValue = document.getElementById('body-position-value');
        const positionReal = document.getElementById('body-position-real');
        if (positionValue && positionReal) {
            positionValue.textContent = `(${body.position.x.toFixed(1)}, ${body.position.y.toFixed(1)})`;
            const distanceAU = Math.sqrt(body.position.x * body.position.x + body.position.y * body.position.y);
            positionReal.textContent = `≈ ${distanceAU.toFixed(3)} AU from center`;
        }
        
        // Velocity
        const velocityValue = document.getElementById('body-velocity-value');
        const velocityReal = document.getElementById('body-velocity-real');
        if (velocityValue && velocityReal) {
            const speed = body.velocity.magnitude();
            velocityValue.textContent = `${speed.toFixed(1)} units`;
            velocityReal.textContent = `≈ ${(speed * 29.78).toFixed(1)} km/s`;
        }
        
        // Kinetic Energy
        const kineticValue = document.getElementById('body-kinetic-value');
        const kineticReal = document.getElementById('body-kinetic-real');
        if (kineticValue && kineticReal) {
            const ke = 0.5 * body.mass * body.velocity.magnitudeSquared();
            kineticValue.textContent = `${this.formatNumber(ke)} units`;
            // Real kinetic energy in Joules (very rough approximation)
            const realKE = ke * 5.97e24 * (29780 * 29780);
            kineticReal.textContent = `≈ ${this.formatScientific(realKE)} J`;
        }
    }

    updateComparisonBodies() {
        if (!this.selectedBody) return;
        
        const mass = this.selectedBody.mass;
        
        // Show comparison bodies based on selected mass
        const sunComparison = document.getElementById('comparison-sun');
        const moonComparison = document.getElementById('comparison-moon');
        const jupiterComparison = document.getElementById('comparison-jupiter');
        const marsComparison = document.getElementById('comparison-mars');
        
        // Always show some references, but highlight relevant ones
        if (sunComparison) {
            sunComparison.style.display = 'flex';
            const ratio = 333000 / mass;
            document.getElementById('sun-mass-comparison').textContent = 
                `${ratio.toFixed(0)}x this body (333,000 units)`;
                
            if (mass > 100000) {
                sunComparison.classList.add('highlight');
                setTimeout(() => sunComparison.classList.remove('highlight'), 3000);
            }
        }
        
        if (moonComparison) {
            moonComparison.style.display = 'flex';
            const ratio = mass / 0.012;
            document.getElementById('moon-mass-comparison').textContent = 
                `${ratio.toFixed(1)}x Moon mass (0.012 units)`;
                
            if (mass < 1) {
                moonComparison.classList.add('highlight');
                setTimeout(() => moonComparison.classList.remove('highlight'), 3000);
            }
        }
        
        if (jupiterComparison) {
            jupiterComparison.style.display = 'flex';
            const ratio = 318 / mass;
            document.getElementById('jupiter-mass-comparison').textContent = 
                `${ratio.toFixed(1)}x this body (318 units)`;
                
            if (mass > 100 && mass < 1000) {
                jupiterComparison.classList.add('highlight');
                setTimeout(() => jupiterComparison.classList.remove('highlight'), 3000);
            }
        }
        
        if (marsComparison) {
            marsComparison.style.display = 'flex';
            const ratio = mass / 0.107;
            document.getElementById('mars-mass-comparison').textContent = 
                `${ratio.toFixed(1)}x Mars mass (0.107 units)`;
                
            if (mass < 5 && mass > 0.05) {
                marsComparison.classList.add('highlight');
                setTimeout(() => marsComparison.classList.remove('highlight'), 3000);
            }
        }
    }

    hideAllComparisonBodies() {
        const comparisonElements = [
            'comparison-sun', 'comparison-moon', 
            'comparison-jupiter', 'comparison-mars'
        ];
        
        comparisonElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
                element.classList.remove('highlight');
            }
        });
    }

    getBodyMassComparison(mass) {
        if (mass > 100000) return "stellar mass scale";
        if (mass > 10000) return "massive star/brown dwarf scale";
        if (mass > 1000) return "gas giant scale";
        if (mass > 100) return "super-Earth scale";
        if (mass > 10) return "large planet scale";
        if (mass > 1) return "Earth-like scale";
        if (mass > 0.1) return "Mars-like scale";
        if (mass > 0.01) return "Moon-like scale";
        return "asteroid scale";
    }

    formatNumber(num) {
        if (num === 0) return "0";
        if (Math.abs(num) >= 1000000) return this.formatScientific(num);
        if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + "k";
        if (Math.abs(num) >= 1) return num.toFixed(1);
        if (Math.abs(num) >= 0.01) return num.toFixed(3);
        return this.formatScientific(num);
    }

    formatScientific(num) {
        if (num === 0) return "0";
        const exp = Math.floor(Math.log10(Math.abs(num)));
        const mantissa = num / Math.pow(10, exp);
        return `${mantissa.toFixed(2)} × 10^${exp}`;
    }

    validateAndCleanBodies() {
        // Remove any bodies with invalid properties
        this.bodies = this.bodies.filter(body => {
            const isValid = body && 
                           body.position && 
                           isFinite(body.position.x) && 
                           isFinite(body.position.y) &&
                           isFinite(body.mass) && 
                           body.mass > 0 &&
                           isFinite(body.radius) && 
                           body.radius > 0;
            
            if (!isValid) {
                console.warn('Removing invalid body:', body);
                // If this was the selected body, clear selection
                if (body === this.selectedBody) {
                    this.selectedBody = null;
                }
            }
            
            return isValid;
        });
    }

    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Calculate the scale between the canvas display size and its internal resolution
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // Calculate mouse position relative to canvas, accounting for browser zoom
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        // Convert from high-DPI coordinates to logical coordinates
        const logicalX = x / this.renderer.devicePixelRatio;
        const logicalY = y / this.renderer.devicePixelRatio;
        
        return { x: logicalX, y: logicalY };
    }

    debugMousePosition(event) {
        if (window.location.hash === '#debug') {
            const mousePos = this.getMousePosition(event);
            const worldPos = this.renderer.screenToWorld(mousePos.x, mousePos.y);
            
            console.log('Mouse Debug:', {
                clientX: event.clientX,
                clientY: event.clientY,
                canvasX: mousePos.x,
                canvasY: mousePos.y,
                worldX: worldPos.x.toFixed(2),
                worldY: worldPos.y.toFixed(2)
            });
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
