class UIManager {
    constructor() {
        this.sliders = new Map();
        this.buttons = new Map();
        this.checkboxes = new Map();
        this.colorPicker = null;
        this.selectedColor = '#ff4757';
        this.orbitMode = false;
        this.referenceShown = false; // Reference panel state
        this.performanceShown = false; // Performance panel state
        this.energyShown = false; // Energy panel state
        this.renderer = null; // Will be set by app
        this.tooltipElement = null;
        
        // Bind tooltip methods for proper event listener handling
        this.boundShowTooltip = (e) => this.showTooltip(e.target, e);
        this.boundHideTooltip = () => this.hideTooltip();
        this.boundUpdatePosition = (e) => this.updateTooltipPosition(e);
        
        this.initializeSliders();
        this.initializeButtons();
        this.initializeCheckboxes();
        this.initializeColorPicker();
        this.initializeModal();
        this.initializeModeButtons();
        this.initializePerformanceControls();
        this.initializeEnergyChart();
        this.setupEventListeners();
        this.initializeTooltips();
        this.initializeEnergyChart();
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    initializeSliders() {
        // Define all sliders with their configurations
        const sliderConfigs = [
            { id: 'gravity-strength', min: 0.1, max: 3.0, step: 0.1, default: 1.0, extendedMax: 50, format: (v) => v.toFixed(1) },
            { id: 'time-scale', min: 0.1, max: 3.0, step: 0.1, default: 1.0, extendedMax: 10, format: (v) => v.toFixed(1) + 'x' },
            { id: 'prediction-depth', min: 100, max: 10000, step: 200, default: 1000, extendedMax: 20000, format: (v) => Math.round(v).toString() },
            { id: 'body-mass', min: 1, max: 200, step: 1, default: 50, extendedMax: 10000, format: (v) => Math.round(v).toString() },
            { id: 'velocity-x', min: -50, max: 50, step: 1, default: 0, extendedMax: 1000, format: (v) => Math.round(v).toString() },
            { id: 'velocity-y', min: -50, max: 50, step: 1, default: 0, extendedMax: 1000, format: (v) => Math.round(v).toString() },
            { id: 'trail-length', min: 0, max: 100, step: 1, default: 50, extendedMax: 1000, format: (v) => Math.round(v).toString() }
        ];

        sliderConfigs.forEach(config => {
            const slider = document.getElementById(config.id);
            const input = document.getElementById(config.id + '-input');
            
            if (slider && input) {
                slider.min = config.min;
                slider.max = config.max;
                slider.step = config.step;
                slider.value = config.default;
                input.value = config.default;
                
                // Sync slider to input
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    input.value = value;
                    this.onSliderChange(config.id, value);
                });
                
                // Sync input to slider
                input.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    
                    // Special validation for mass to prevent zero or negative values
                    if (config.id === 'body-mass' && (isNaN(value) || value <= 0)) {
                        value = config.min; // Reset to minimum safe value
                        input.value = value; // Update the input field
                    }
                    
                    // Only update slider if value is within range
                    if (value >= config.min && value <= config.max) {
                        slider.value = value;
                    }
                    this.onSliderChange(config.id, value);
                });
                
                // Also validate on blur (when user finishes typing)
                input.addEventListener('blur', (e) => {
                    let value = parseFloat(e.target.value);
                    
                    if (config.id === 'body-mass' && (isNaN(value) || value <= 0)) {
                        value = config.min;
                        input.value = value;
                        slider.value = value;
                        this.onSliderChange(config.id, value);
                    }
                });
                
                this.sliders.set(config.id, { element: slider, input, config });
            }
        });
    }

    initializeButtons() {
        const buttonIds = [
            'play-pause', 'reset', 'clear', 'zoom-in', 'zoom-out',
            'center-view', 'fit-view', 'save-config', 'load-config',
            'export-video', 'delete-selected', 'help-btn', 'reference-toggle',
            'performance-toggle', 'energy-toggle'
        ];

        buttonIds.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.onButtonClick(id);
                });
                this.buttons.set(id, button);
            }
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const preset = button.getAttribute('data-preset');
                this.onPresetSelect(preset);
            });
        });
    }

    initializeCheckboxes() {
        const checkboxIds = [
            'collision-enabled', 'show-trails', 'show-grid', 'show-forces', 'long-term-preview',
            'adaptive-timestep', 'web-workers'
        ];

        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.onCheckboxChange(id, e.target.checked);
                });
                this.checkboxes.set(id, checkbox);
            }
        });
    }

    initializeModeButtons() {
        const manualModeBtn = document.getElementById('manual-mode');
        const orbitModeBtn = document.getElementById('orbit-mode');
        
        if (manualModeBtn && orbitModeBtn) {
            manualModeBtn.addEventListener('click', () => {
                this.setMode('manual');
            });
            
            orbitModeBtn.addEventListener('click', () => {
                this.setMode('orbit');
            });
        }
    }

    setMode(mode) {
        this.orbitMode = (mode === 'orbit');
        
        const manualModeBtn = document.getElementById('manual-mode');
        const orbitModeBtn = document.getElementById('orbit-mode');
        
        if (manualModeBtn && orbitModeBtn) {
            manualModeBtn.classList.toggle('active', !this.orbitMode);
            orbitModeBtn.classList.toggle('active', this.orbitMode);
        }
        
        // Disable velocity sliders in orbit mode
        const velocityXSlider = this.sliders.get('velocity-x');
        const velocityYSlider = this.sliders.get('velocity-y');
        
        if (velocityXSlider && velocityYSlider) {
            velocityXSlider.element.disabled = this.orbitMode;
            velocityXSlider.input.disabled = this.orbitMode;
            velocityYSlider.element.disabled = this.orbitMode;
            velocityYSlider.input.disabled = this.orbitMode;
            
            if (this.orbitMode) {
                velocityXSlider.element.value = 0;
                velocityXSlider.input.value = 0;
                velocityYSlider.element.value = 0;
                velocityYSlider.input.value = 0;
            }
        }
        
        // Hide orbit preview when switching to manual mode
        if (!this.orbitMode && this.renderer) {
            this.renderer.setOrbitPreview(false);
            this.renderer.setLongTermPreview(false);
        }
        
        this.showNotification(
            this.orbitMode ? 'Orbit Mode: Click near a body to create an orbiting body' : 'Manual Mode: Set velocity manually',
            'info'
        );
    }

    initializeColorPicker() {
        this.colorPicker = document.querySelector('.color-picker');
        if (this.colorPicker) {
            this.colorPicker.addEventListener('click', (e) => {
                if (e.target.classList.contains('color-option')) {
                    // Remove active class from all options
                    this.colorPicker.querySelectorAll('.color-option').forEach(option => {
                        option.classList.remove('active');
                    });
                    
                    // Add active class to clicked option
                    e.target.classList.add('active');
                    
                    // Get color from data attribute or computed style
                    this.selectedColor = e.target.getAttribute('data-color') || 
                                       window.getComputedStyle(e.target).backgroundColor;
                    
                    this.onColorChange(this.selectedColor);
                }
            });
        }
    }

    initializeModal() {
        const modal = document.getElementById('shortcuts-modal');
        const closeBtn = modal.querySelector('.close-modal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideModal();
            });
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal();
            }
        });
    }

    setupEventListeners() {
        // File input for loading configurations
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.onFileLoad(e.target.files[0]);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.onKeyDown(e);
        });

        // Prevent default behavior for certain keys
        document.addEventListener('keypress', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                if (e.key === ' ') {
                    e.preventDefault();
                }
            }
        });
    }

    initializePerformanceControls() {
        // Integration method dropdown
        const integrationMethod = document.getElementById('integration-method');
        if (integrationMethod) {
            integrationMethod.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('integration-method', e.target.value);
            });
        }
        
        // Force calculation method dropdown
        const forceMethod = document.getElementById('force-method');
        if (forceMethod) {
            forceMethod.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('force-method', e.target.value);
            });
        }
        
        // Barnes-Hut theta slider
        const barnesHutTheta = document.getElementById('barnes-hut-theta');
        const barnesHutThetaValue = document.getElementById('barnes-hut-theta-value');
        if (barnesHutTheta && barnesHutThetaValue) {
            barnesHutTheta.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                barnesHutThetaValue.textContent = value.toFixed(1);
                this.onPerformanceSettingChange('barnes-hut-theta', value);
            });
        }
        
        // GPU acceleration checkbox
        const gpuAcceleration = document.getElementById('gpu-acceleration');
        if (gpuAcceleration) {
            gpuAcceleration.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('gpu-acceleration', e.target.checked);
            });
        }
    }

    // Panel toggle methods
    togglePerformancePanel() {
        const panel = document.getElementById('performance-panel');
        const button = document.getElementById('performance-toggle');
        if (panel && button) {
            panel.classList.toggle('show');
            button.classList.toggle('active');
            this.performanceShown = panel.classList.contains('show');
        }
    }

    toggleEnergyPanel() {
        const panel = document.getElementById('energy-panel');
        const button = document.getElementById('energy-toggle');
        if (panel && button) {
            panel.classList.toggle('show');
            button.classList.toggle('active');
            this.energyShown = panel.classList.contains('show');
        }
    }

    updatePerformanceStats(stats) {
        const fpsDisplay = document.getElementById('performance-fps');
        const physicsTime = document.getElementById('performance-physics-time');
        const forceTime = document.getElementById('performance-force-time');
        const integrationTime = document.getElementById('performance-integration-time');
        const bodyCount = document.getElementById('performance-body-count');
        const currentMethod = document.getElementById('performance-current-method');

        if (fpsDisplay) fpsDisplay.textContent = `${Math.round(stats.fps || 0)} FPS`;
        
        // Display with better precision and show actual values
        if (physicsTime) {
            const value = stats.physicsTime || 0;
            physicsTime.textContent = value < 0.01 ? '<0.01 ms' : `${value.toFixed(2)} ms`;
        }
        
        if (forceTime) {
            const value = stats.forceCalculationTime || 0;
            forceTime.textContent = value < 0.01 ? '<0.01 ms' : `${value.toFixed(2)} ms`;
        }
        
        if (integrationTime) {
            const value = stats.integrationTime || 0;
            integrationTime.textContent = value < 0.01 ? '<0.01 ms' : `${value.toFixed(2)} ms`;
        }
        
        if (bodyCount) bodyCount.textContent = stats.bodyCount || 0;
        if (currentMethod) currentMethod.textContent = `${stats.method || 'N/A'}/${stats.forceMethod || 'N/A'}`;
    }

    updateEnergyDisplay(energy) {
        const kineticDisplay = document.getElementById('energy-kinetic');
        const potentialDisplay = document.getElementById('energy-potential');
        const totalDisplay = document.getElementById('energy-total');
        const conservationDisplay = document.getElementById('energy-conservation');

        if (kineticDisplay) {
            kineticDisplay.textContent = this.formatScientific(energy.kinetic);
        }
        if (potentialDisplay) {
            potentialDisplay.textContent = this.formatScientific(energy.potential);
        }
        if (totalDisplay) {
            totalDisplay.textContent = this.formatScientific(energy.total);
        }
        
        // Enhanced conservation display
        if (conservationDisplay) {
            let conservation = 100;
            let conservationText = '100.0%';
            
            if (energy.conservationError !== undefined && energy.conservationError >= 0) {
                conservation = (1 - energy.conservationError) * 100;
                conservationText = `${conservation.toFixed(3)}%`;
                
                // Add drift information if significant
                if (Math.abs(energy.energyDrift) > 1e-6) {
                    conservationText += ` (drift: ${this.formatScientific(energy.energyDrift)})`;
                }
            } else if (energy.initial !== undefined && energy.initial !== 0) {
                // Fallback to old method
                conservation = Math.abs(energy.total) > 0 ? 
                    (1 - Math.abs(energy.total - energy.initial) / Math.abs(energy.initial)) * 100 : 100;
                conservationText = `${conservation.toFixed(1)}%`;
            }
            
            conservationDisplay.textContent = conservationText;
            conservationDisplay.className = 'energy-value ' + 
                (conservation > 99.9 ? 'conservation-excellent' :
                 conservation > 99 ? 'conservation-good' : 
                 conservation > 95 ? 'conservation-warning' : 'conservation-bad');
        }
        
        // Update additional energy statistics if elements exist
        this.updateEnergyRatios(energy);
        this.updateEnergyRates(energy);
        this.updateSystemProperties(energy);
    }
    
    // Update energy ratios display
    updateEnergyRatios(energy) {
        const kineticRatioDisplay = document.getElementById('energy-kinetic-ratio');
        const potentialRatioDisplay = document.getElementById('energy-potential-ratio');
        
        if (kineticRatioDisplay && energy.kineticRatio !== undefined) {
            kineticRatioDisplay.textContent = `${(energy.kineticRatio * 100).toFixed(1)}%`;
        }
        if (potentialRatioDisplay && energy.potentialRatio !== undefined) {
            potentialRatioDisplay.textContent = `${(energy.potentialRatio * 100).toFixed(1)}%`;
        }
    }
    
    // Update energy rates display
    updateEnergyRates(energy) {
        const kineticRateDisplay = document.getElementById('energy-kinetic-rate');
        const potentialRateDisplay = document.getElementById('energy-potential-rate');
        
        if (kineticRateDisplay && energy.kineticRate !== undefined) {
            kineticRateDisplay.textContent = this.formatScientific(energy.kineticRate) + '/s';
        }
        if (potentialRateDisplay && energy.potentialRate !== undefined) {
            potentialRateDisplay.textContent = this.formatScientific(energy.potentialRate) + '/s';
        }
    }
    
    // Update system properties display
    updateSystemProperties(energy) {
        const temperatureDisplay = document.getElementById('system-temperature');
        const specificEnergyDisplay = document.getElementById('specific-energy');
        
        if (temperatureDisplay && energy.systemTemperature !== undefined) {
            temperatureDisplay.textContent = this.formatScientific(energy.systemTemperature);
        }
        if (specificEnergyDisplay && energy.specificEnergy !== undefined) {
            specificEnergyDisplay.textContent = this.formatScientific(energy.specificEnergy);
        }
    }

    // Initialize energy chart
    initializeEnergyChart() {
        this.energyChart = {
            canvas: document.getElementById('energy-chart'),
            context: null,
            data: [],
            maxPoints: 100
        };
        
        if (this.energyChart.canvas) {
            this.energyChart.context = this.energyChart.canvas.getContext('2d');
            // Set canvas size
            const rect = this.energyChart.canvas.getBoundingClientRect();
            this.energyChart.canvas.width = rect.width * window.devicePixelRatio;
            this.energyChart.canvas.height = rect.height * window.devicePixelRatio;
            this.energyChart.context.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
    }

    // Update energy chart with new data
    updateEnergyChart(energy) {
        if (!this.energyChart.context) return;
        
        // Add new data point
        this.energyChart.data.push({
            kinetic: energy.kinetic,
            potential: energy.potential,
            total: energy.total,
            timestamp: Date.now()
        });
        
        // Keep only recent data
        if (this.energyChart.data.length > this.energyChart.maxPoints) {
            this.energyChart.data.shift();
        }
        
        // Draw chart
        this.drawEnergyChart();
    }

    // Draw the energy chart
    drawEnergyChart() {
        const ctx = this.energyChart.context;
        const canvas = this.energyChart.canvas;
        const data = this.energyChart.data;
        
        if (!ctx || data.length < 2) return;
        
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Find min/max values for scaling
        let minValue = Infinity;
        let maxValue = -Infinity;
        
        data.forEach(point => {
            minValue = Math.min(minValue, point.kinetic, point.potential, point.total);
            maxValue = Math.max(maxValue, point.kinetic, point.potential, point.total);
        });
        
        // Add some padding
        const range = maxValue - minValue;
        minValue -= range * 0.1;
        maxValue += range * 0.1;
        
        const scaleY = height / (maxValue - minValue);
        const scaleX = width / (data.length - 1);
        
        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw energy lines
        const drawLine = (color, getValue) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            data.forEach((point, index) => {
                const x = index * scaleX;
                const y = height - (getValue(point) - minValue) * scaleY;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        };
        
        // Draw lines for each energy type
        drawLine('#ff6347', p => p.kinetic);  // Kinetic (red)
        drawLine('#8a2be2', p => p.potential); // Potential (purple)
        drawLine('#64ffda', p => p.total);     // Total (cyan)
        
        // Draw legend
        ctx.font = '10px Inter';
        ctx.fillStyle = '#ff6347';
        ctx.fillText('Kinetic', 5, 15);
        ctx.fillStyle = '#8a2be2';
        ctx.fillText('Potential', 5, 30);
        ctx.fillStyle = '#64ffda';
        ctx.fillText('Total', 5, 45);
    }

    // Format numbers in scientific notation for display
    formatScientific(value) {
        if (Math.abs(value) < 0.01 || Math.abs(value) > 9999) {
            return value.toExponential(2);
        }
        return value.toFixed(2);
    }

    // Event handler for performance settings
    onPerformanceSettingChange(setting, value) {
        // Performance setting changed - override in main app
    }

    // Event handlers (to be overridden by the main application)
    onSliderChange(sliderId, value) {
        // Slider changed - override in main app
    }

    onButtonClick(buttonId) {
        // Button clicked - override in main app
    }

    onCheckboxChange(checkboxId, checked) {
        // Checkbox changed - override in main app
    }

    onColorChange(color) {
        // Color changed - override in main app
    }

    onPresetSelect(preset) {
        // Preset selected - override in main app
    }

    onFileLoad(file) {
        // File loaded - override in main app
    }

    onKeyDown(event) {
        // Key pressed - override in main app
    }

    // UI update methods
    updateSlider(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.element.value = value;
            slider.input.value = value;
        }
    }

    updateCheckbox(checkboxId, checked) {
        const checkbox = this.checkboxes.get(checkboxId);
        if (checkbox) {
            checkbox.checked = checked;
        }
    }

    updatePlayPauseButton(isPlaying, isPaused) {
        const button = this.buttons.get('play-pause');
        if (button) {
            const icon = button.querySelector('i');
            const text = button.childNodes[button.childNodes.length - 1];
            
            if (isPlaying && !isPaused) {
                icon.className = 'fas fa-pause';
                text.textContent = ' Pause';
                button.classList.remove('primary-btn');
                button.classList.add('secondary-btn');
            } else {
                icon.className = 'fas fa-play';
                text.textContent = ' Start';
                button.classList.remove('secondary-btn');
                button.classList.add('primary-btn');
            }
        }
    }

    updateStatus(status) {
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (statusText) {
            statusText.textContent = status;
        }
        
        if (statusDot) {
            statusDot.className = 'status-dot';
            switch (status.toLowerCase()) {
                case 'running':
                    statusDot.classList.add('running');
                    break;
                case 'paused':
                    statusDot.classList.add('paused');
                    break;
                default:
                    statusDot.classList.add('stopped');
            }
        }
    }

    updateFPS(fps) {
        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            fpsDisplay.textContent = `${Math.round(fps)} FPS`;
        }
    }

    updateInfoPanel(info) {
        // Update body count
        const bodyCount = document.getElementById('body-count');
        if (bodyCount) {
            bodyCount.textContent = info.bodyCount.toString();
        }

        // Update total mass
        const totalMass = document.getElementById('total-mass');
        if (totalMass) {
            totalMass.textContent = info.totalMass.toFixed(1);
        }

        // Update energies
        const kineticEnergy = document.getElementById('kinetic-energy');
        if (kineticEnergy) {
            kineticEnergy.textContent = info.kineticEnergy.toFixed(1);
        }

        const potentialEnergy = document.getElementById('potential-energy');
        if (potentialEnergy) {
            potentialEnergy.textContent = info.potentialEnergy.toFixed(1);
        }
    }

    updateMousePosition(x, y) {
        const mousePosition = document.getElementById('mouse-position');
        if (mousePosition) {
            mousePosition.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
        }
    }

    updateSelectedBodyPanel(body) {
        const panel = document.getElementById('selected-body-panel');
        if (!panel) return;

        if (body) {
            panel.style.display = 'block';
            
            const info = body.getDisplayInfo();
            
            const elements = {
                'selected-mass': info.mass,
                'selected-position': info.position,
                'selected-velocity': info.velocity,
                'selected-speed': info.speed
            };

            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                }
            });
        } else {
            panel.style.display = 'none';
        }
    }

    // Modal management
    showModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('fade-in');
        }
    }

    hideModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('fade-in');
        }
    }

    // Loading screen management
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    // Update dynamic reference panel
    updateDynamicReference(bodies, selectedBody) {
        if (!this.referenceShown) return;
        
        // Update selected body information if there is one
        const selectedBodyInfo = document.getElementById('selected-body-info');
        if (selectedBody && selectedBodyInfo) {
            selectedBodyInfo.style.display = 'block';
            
            // Update body information
            const massValue = document.getElementById('body-mass-value');
            const massReal = document.getElementById('body-mass-real');
            const positionValue = document.getElementById('body-position-value');
            const positionReal = document.getElementById('body-position-real');
            const velocityValue = document.getElementById('body-velocity-value');
            const velocityReal = document.getElementById('body-velocity-real');
            const kineticValue = document.getElementById('body-kinetic-value');
            const kineticReal = document.getElementById('body-kinetic-real');
            
            if (massValue) massValue.textContent = selectedBody.mass.toFixed(1);
            if (massReal) massReal.textContent = `(${(selectedBody.mass * 5.97e24).toExponential(2)} kg)`;
            
            if (positionValue) {
                positionValue.textContent = `(${selectedBody.position.x.toFixed(1)}, ${selectedBody.position.y.toFixed(1)})`;
            }
            if (positionReal) {
                const realX = selectedBody.position.x * 1.496e11;
                const realY = selectedBody.position.y * 1.496e11;
                positionReal.textContent = `(${realX.toExponential(2)}, ${realY.toExponential(2)} m)`;
            }
            
            if (velocityValue) {
                const speed = selectedBody.velocity.magnitude();
                velocityValue.textContent = speed.toFixed(1);
            }
            if (velocityReal) {
                const realSpeed = selectedBody.velocity.magnitude() * 29780;
                velocityReal.textContent = `(${realSpeed.toFixed(0)} m/s)`;
            }
            
            if (kineticValue && selectedBody.kineticEnergy !== undefined) {
                kineticValue.textContent = selectedBody.kineticEnergy.toFixed(1);
            }
            if (kineticReal && selectedBody.kineticEnergy !== undefined) {
                const realKE = selectedBody.kineticEnergy * 5.97e24 * Math.pow(29780, 2);
                kineticReal.textContent = `(${realKE.toExponential(2)} J)`;
            }
        } else if (selectedBodyInfo) {
            selectedBodyInfo.style.display = 'none';
        }
        
        // Update comparison bodies based on current masses
        this.updateMassComparisons(bodies);
    }
    
    // Update mass comparison display
    updateMassComparisons(bodies) {
        if (bodies.length === 0) return;
        
        const maxMass = Math.max(...bodies.map(b => b.mass));
        const minMass = Math.min(...bodies.map(b => b.mass));
        
        // Show/hide comparison elements based on mass range
        const sunComparison = document.getElementById('comparison-sun');
        const moonComparison = document.getElementById('comparison-moon');
        const jupiterComparison = document.getElementById('comparison-jupiter');
        const marsComparison = document.getElementById('comparison-mars');
        
        if (sunComparison) {
            sunComparison.style.display = maxMass > 100 ? 'flex' : 'none';
        }
        if (moonComparison) {
            moonComparison.style.display = minMass < 1 ? 'flex' : 'none';
        }
        if (jupiterComparison) {
            jupiterComparison.style.display = maxMass > 50 ? 'flex' : 'none';
        }
        if (marsComparison) {
            marsComparison.style.display = minMass < 10 ? 'flex' : 'none';
        }
    }

    // Utility methods
    getSliderValue(sliderId) {
        const slider = this.sliders.get(sliderId);
        return slider ? parseFloat(slider.element.value) : 0;
    }

    getCheckboxValue(checkboxId) {
        const checkbox = this.checkboxes.get(checkboxId);
        return checkbox ? checkbox.checked : false;
    }

    getSelectedColor() {
        return this.selectedColor;
    }

    // Calculate orbital velocity for a body around a target
    calculateOrbitalVelocity(targetBody, position, gravitationalConstant) {
        const direction = targetBody.position.subtract(position);
        const distance = direction.magnitude();
        
        if (distance === 0) return new Vector2D(0, 0);
        
        // Calculate orbital speed: v = sqrt(GM/r)
        const orbitalSpeed = Math.sqrt(gravitationalConstant * targetBody.mass / distance);
        
        // Get perpendicular direction for circular orbit
        const perpendicular = new Vector2D(-direction.y, direction.x).normalize();
        
        return perpendicular.multiply(orbitalSpeed);
    }

    isOrbitMode() {
        return this.orbitMode;
    }

    // File operations
    triggerFileLoad() {
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    downloadFile(filename, content, type = 'application/json') {
        const blob = new Blob([content], { type: type });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    // Notifications (simple toast-like notifications)
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#51cf66';
                break;
            case 'error':
                notification.style.backgroundColor = '#ff6b6b';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ffd43b';
                notification.style.color = '#000';
                break;
            default:
                notification.style.backgroundColor = '#64ffda';
                notification.style.color = '#000';
        }
        
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Remove after duration
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Animation utilities
    animateValue(element, start, end, duration, formatter = (v) => v) {
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (end - start) * eased;
            
            element.textContent = formatter(current);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Theme management (for future dark/light mode support)
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
    }

    getTheme() {
        return document.body.getAttribute('data-theme') || 'dark';
    }

    // Set slider value programmatically
    setSliderValue(sliderId, value) {
        const slider = document.getElementById(sliderId);
        const input = document.getElementById(sliderId + '-input');
        
        if (slider) {
            slider.value = value;
            // Trigger the input event to update the display
            slider.dispatchEvent(new Event('input'));
        }
        
        if (input) {
            input.value = value;
            // Trigger the input event to sync with slider
            input.dispatchEvent(new Event('input'));
        }
    }

    // Initialize tooltip system
    initializeTooltips() {
        // Create tooltip element
        this.createTooltipElement();
        
        // Get all elements with tooltips
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            // Remove existing listeners to avoid duplicates
            element.removeEventListener('mouseenter', this.boundShowTooltip);
            element.removeEventListener('mouseleave', this.boundHideTooltip);
            element.removeEventListener('mousemove', this.boundUpdatePosition);
            element.removeEventListener('focus', this.boundShowTooltip);
            element.removeEventListener('blur', this.boundHideTooltip);
            
            // Setup new listeners
            this.setupTooltipForElement(element);
        });
    }
    
    createTooltipElement() {
        // Remove existing tooltip if present
        const existingTooltip = document.getElementById('floating-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // Create new tooltip element
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'floating-tooltip';
        this.tooltipElement.className = 'floating-tooltip';
        this.tooltipElement.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: 'Inter', sans-serif;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            max-width: 300px;
            word-wrap: break-word;
            white-space: pre-wrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        document.body.appendChild(this.tooltipElement);
    }
    
    showTooltip(element, event) {
        const tooltipText = element.getAttribute('data-tooltip');
        if (!tooltipText || !this.tooltipElement) return;
        
        this.tooltipElement.textContent = tooltipText;
        this.tooltipElement.style.opacity = '1';
        this.tooltipElement.style.transform = 'translateY(0)';
        
        // Initial positioning
        if (event) {
            this.updateTooltipPosition(event);
        }
    }
    
    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.style.opacity = '0';
            this.tooltipElement.style.transform = 'translateY(-8px)';
        }
    }
    
    updateTooltipPosition(event) {
        if (!this.tooltipElement || this.tooltipElement.style.opacity === '0') return;
        
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let x = mouseX + 15; // Offset from cursor
        let y = mouseY - tooltipRect.height - 10; // Above cursor
        
        // Adjust if tooltip would go off screen horizontally
        if (x + tooltipRect.width > viewportWidth - 10) {
            x = mouseX - tooltipRect.width - 15; // Show to the left of cursor
        }
        
        // Adjust if tooltip would go off screen vertically
        if (y < 10) {
            y = mouseY + 15; // Show below cursor
        }
        
        // Ensure tooltip doesn't go off screen
        x = Math.max(10, Math.min(x, viewportWidth - tooltipRect.width - 10));
        y = Math.max(10, Math.min(y, viewportHeight - tooltipRect.height - 10));
        
        this.tooltipElement.style.left = x + 'px';
        this.tooltipElement.style.top = y + 'px';
    }
    
    // Legacy methods for compatibility
    adjustTooltipPosition() {
        // This method is now handled by updateTooltipPosition
    }
    
    setupDynamicTooltipPositioning() {
        // No longer needed with floating tooltip
    }
    
    // Add tooltip to element programmatically
    addTooltip(element, text) {
        element.setAttribute('data-tooltip', text);
        // Add event listeners for this specific element
        this.setupTooltipForElement(element);
    }
    
    // Setup tooltip for a single element
    setupTooltipForElement(element) {
        element.addEventListener('mouseenter', this.boundShowTooltip);
        element.addEventListener('mouseleave', this.boundHideTooltip);
        element.addEventListener('mousemove', this.boundUpdatePosition);
        element.addEventListener('focus', this.boundShowTooltip);
        element.addEventListener('blur', this.boundHideTooltip);
    }
    
    // Remove tooltip from element
    removeTooltip(element) {
        element.removeAttribute('data-tooltip');
    }
    
    // Update tooltip text
    updateTooltip(element, newText) {
        element.setAttribute('data-tooltip', newText);
    }
    
    // Reinitialize tooltips (useful after dynamic content changes)
    reinitializeTooltips() {
        this.initializeTooltips();
    }
}
