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
        
        // Cache frequently accessed DOM elements
        this.cachedElements = new Map();
        
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
        this.initializeTabs();
        this.initializePerformanceControls();
        this.initializeEnergyChart();
        this.initializeCollisionControls();
        this.initializeScaleReference();
        this.setupEventListeners();
        this.initializeTooltips();
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
                
                // Sync input to slider with comprehensive validation
                input.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    
                    // Comprehensive validation for all sliders
                    if (isNaN(value)) {
                        value = config.default;
                        input.value = value;
                    }
                    
                    // Special validation for mass to prevent zero or negative values
                    if (config.id === 'body-mass') {
                        if (value <= 0) {
                            value = Math.max(config.min, 1); // Ensure positive mass
                            input.value = value;
                        }
                        // Cap maximum mass to prevent numerical instability
                        if (value > config.extendedMax) {
                            value = config.extendedMax;
                            input.value = value;
                        }
                    }
                    
                    // Velocity validation to prevent extreme values
                    if (config.id.includes('velocity')) {
                        const maxVel = config.extendedMax || 1000;
                        if (Math.abs(value) > maxVel) {
                            value = Math.sign(value) * maxVel;
                            input.value = value;
                        }
                    }
                    
                    // Only update slider if value is within basic range
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
            'export-video', 'delete-selected', 'help-btn', 'show-shortcuts',
            'debug-mode', 'performance-mode'
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

        // Add shortcuts button handler
        const showShortcutsBtn = document.getElementById('show-shortcuts');
        if (showShortcutsBtn) {
            showShortcutsBtn.addEventListener('click', () => this.showModal());
        }

        // Add placeholder handlers for debug and performance buttons
        const debugBtn = document.getElementById('debug-mode');
        const performanceBtn = document.getElementById('performance-mode');
        
        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                // Toggle debug mode - placeholder for future implementation
                debugBtn.classList.toggle('active');
                console.log('Debug mode toggled');
            });
        }
        
        if (performanceBtn) {
            performanceBtn.addEventListener('click', () => {
                // Toggle performance mode - placeholder for future implementation
                performanceBtn.classList.toggle('active');
                console.log('Performance mode toggled');
            });
        }
    }

    initializeCollisionControls() {
        const collisionEnabled = document.getElementById('collision-enabled');
        const collisionType = document.getElementById('collision-type');
        const restitutionGroup = document.getElementById('restitution-group');
        const restitutionSlider = document.getElementById('restitution-coefficient');
        const restitutionValue = document.getElementById('restitution-coefficient-value');

        const updateRestitutionVisibility = () => {
            const isEnabled = collisionEnabled ? collisionEnabled.checked : false;
            const type = collisionType ? collisionType.value : 'inelastic';
            if (restitutionGroup) {
                restitutionGroup.style.display = (isEnabled && type === 'elastic') ? 'block' : 'none';
            }
        };

        if (collisionType) {
            collisionType.addEventListener('change', (e) => {
                this.onCollisionTypeChange(e.target.value);
                updateRestitutionVisibility();
            });
        }

        if (restitutionSlider && restitutionValue) {
            restitutionSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                restitutionValue.textContent = value.toFixed(2);
                this.onRestitutionChange(value);
            });
        }

        if (collisionEnabled) {
            collisionEnabled.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                if (collisionType) collisionType.disabled = !isEnabled;
                if (restitutionSlider) restitutionSlider.disabled = !isEnabled;
                this.onCheckboxChange('collision-enabled', isEnabled);
                updateRestitutionVisibility();
            });
        }

        // Initial state
        updateRestitutionVisibility();
    }

    initializeCheckboxes() {
        const checkboxIds = [
            'collision-enabled', 'show-trails', 'show-grid', 'show-forces', 'long-term-preview',
            'show-collision-bounds', 'adaptive-timestep', 'web-workers'
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
        
        // Update velocity controls styling
        this.updateModeControls();
        
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

    updateModeControls() {
        const velocityControls = document.getElementById('velocity-controls');
        if (velocityControls) {
            if (this.orbitMode) {
                velocityControls.classList.add('disabled');
                velocityControls.style.opacity = '0.5';
            } else {
                velocityControls.classList.remove('disabled');
                velocityControls.style.opacity = '1.0';
            }
        }
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
        
        // Ensure modal is hidden on load
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        
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

    initializeTabs() {
        const tabContainer = document.querySelector('.blender-tab-container');
        if (!tabContainer) return;

        const tabButtons = tabContainer.querySelectorAll('.vertical-tab-btn');
        const tabPanels = tabContainer.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Deactivate all buttons and panels
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanels.forEach(panel => panel.classList.remove('active'));

                // Activate clicked button and corresponding panel
                button.classList.add('active');
                const tabName = button.dataset.tab;
                const targetPanel = document.getElementById(`${tabName}-tab`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });

        // Ensure the first tab is active by default
        if (tabButtons.length > 0 && !tabContainer.querySelector('.vertical-tab-btn.active')) {
            tabButtons[0].click();
        }
    }

    initializePerformanceControls() {
        // Integration method dropdown
        const integrationMethod = document.getElementById('integration-method');
        if (integrationMethod) {
            integrationMethod.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('integration-method', e.target.value);
            });
        }
        
        // Physics method dropdown  
        const physicsMethod = document.getElementById('physics-method');
        if (physicsMethod) {
            physicsMethod.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('physics-method', e.target.value);
            });
        }
        
        // Force calculation method dropdown
        const forceMethod = document.getElementById('force-method');
        if (forceMethod) {
            forceMethod.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('force-method', e.target.value);
            });
        }
        
        // GPU/CPU toggle
        const gpuToggle = document.getElementById('gpu-toggle');
        if (gpuToggle) {
            gpuToggle.addEventListener('change', (e) => {
                const useGPU = e.target.checked;
                this.onPerformanceSettingChange('gpu-acceleration', useGPU);
                this.updateComputeModeDisplay(useGPU ? 'GPU' : 'CPU');
            });
        }
        
        // Adaptive timestep checkbox
        const adaptiveTimestep = document.getElementById('adaptive-timestep');
        if (adaptiveTimestep) {
            adaptiveTimestep.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('adaptive-timestep', e.target.checked);
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
        
        // GPU acceleration checkbox (legacy support)
        const gpuAcceleration = document.getElementById('gpu-acceleration');
        if (gpuAcceleration) {
            gpuAcceleration.addEventListener('change', (e) => {
                this.onPerformanceSettingChange('gpu-acceleration', e.target.checked);
            });
        }
    }

    // Panel toggle methods
    toggleReferencePanel() {
        const panel = document.getElementById('reference-panel');
        const button = document.getElementById('reference-toggle');
        const sidebarButton = document.getElementById('reference-toggle-panel');
        
        if (panel && button) {
            panel.classList.toggle('show');
            button.classList.toggle('active');
            this.referenceShown = panel.classList.contains('show');
            
            // Update sidebar button state
            if (sidebarButton) {
                sidebarButton.classList.toggle('active', this.referenceShown);
            }
        }
    }

    togglePerformancePanel() {
        const panel = document.getElementById('performance-panel');
        const button = document.getElementById('performance-toggle');
        const sidebarButton = document.getElementById('performance-toggle-panel');
        
        if (panel && button) {
            panel.classList.toggle('show');
            button.classList.toggle('active');
            this.performanceShown = panel.classList.contains('show');
            
            // Update sidebar button state
            if (sidebarButton) {
                sidebarButton.classList.toggle('active', this.performanceShown);
            }
        }
    }

    toggleEnergyPanel() {
        const panel = document.getElementById('energy-panel');
        const button = document.getElementById('energy-toggle');
        const sidebarButton = document.getElementById('energy-toggle-panel');
        
        if (panel && button) {
            panel.classList.toggle('show');
            button.classList.toggle('active');
            this.energyShown = panel.classList.contains('show');
            
            // Update sidebar button state
            if (sidebarButton) {
                sidebarButton.classList.toggle('active', this.energyShown);
            }
        }
    }

    // Centralized element caching to avoid duplicate DOM lookups
    getElement(id) {
        if (!this.cachedElements.has(id)) {
            this.cachedElements.set(id, document.getElementById(id));
        }
        return this.cachedElements.get(id);
    }
    
    // Clear element cache when DOM changes
    clearElementCache() {
        this.cachedElements.clear();
    }

    updatePerformanceStats(stats) {
        // Validate input to prevent errors
        if (!stats || typeof stats !== 'object') {
            console.warn('Invalid performance stats provided');
            return;
        }
        
        // Use cached elements to avoid repeated DOM lookups
        const elements = {
            fpsDisplay: this.getElement('performance-fps'),
            physicsTime: this.getElement('performance-physics-time'),
            forceTime: this.getElement('performance-force-time'),
            integrationTime: this.getElement('performance-integration-time'),
            bodyCount: this.getElement('performance-body-count'),
            currentMethod: this.getElement('performance-current-method'),
            physicsTimeElement: this.getElement('physics-time'),
            forceTimeElement: this.getElement('force-time'),
            integrationTimeElement: this.getElement('integration-time')
        };

        // Update FPS display
        if (elements.fpsDisplay) {
            const fps = typeof stats.fps === 'number' ? Math.round(stats.fps) : 0;
            elements.fpsDisplay.textContent = `${fps} FPS`;
        }
        
        // Helper function to format time values consistently
        const formatTime = (value) => {
            if (typeof value !== 'number' || !isFinite(value)) return '0.00 ms';
            return value < 0.01 ? '<0.01 ms' : `${value.toFixed(2)} ms`;
        };
        
        // Update timing displays with validation
        if (elements.physicsTime) {
            elements.physicsTime.textContent = formatTime(stats.physicsTime);
        }
        if (elements.forceTime) {
            elements.forceTime.textContent = formatTime(stats.forceCalculationTime);
        }
        if (elements.integrationTime) {
            elements.integrationTime.textContent = formatTime(stats.integrationTime);
        }
        
        // Update other stats
        if (elements.bodyCount) {
            const bodyCount = typeof stats.bodyCount === 'number' ? stats.bodyCount : 0;
            elements.bodyCount.textContent = bodyCount;
        }
        if (elements.currentMethod) {
            const method = stats.method || 'N/A';
            const forceMethod = stats.forceMethod || 'N/A';
            elements.currentMethod.textContent = `${method}/${forceMethod}`;
        }
        
        // Update performance tab elements (avoiding code duplication)
        if (elements.physicsTimeElement) {
            elements.physicsTimeElement.textContent = formatTime(stats.physicsTime);
        }
        if (elements.forceTimeElement) {
            elements.forceTimeElement.textContent = formatTime(stats.forceCalculationTime);
        }
        if (elements.integrationTimeElement) {
            elements.integrationTimeElement.textContent = formatTime(stats.integrationTime);
        }
        
        // Update GPU status if available
        if (stats.gpu && typeof stats.gpu === 'object' && stats.gpu.isSupported) {
            const gpuModeElement = this.getElement('gpu-mode');
            const gpuTimeElement = this.getElement('gpu-time');
            
            if (gpuModeElement) {
                gpuModeElement.textContent = stats.gpu.mode || 'gpu';
            }
            if (gpuTimeElement) {
                const gpuTime = typeof stats.gpu.lastGpuTime === 'number' ? stats.gpu.lastGpuTime : 0;
                gpuTimeElement.textContent = formatTime(gpuTime);
            }
        }
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
            } else if (energy.initial !== undefined && Math.abs(energy.initial) > 1e-10) {
                // Fallback to old method - only if initial energy is significant
                conservation = Math.abs(energy.total) > 0 ? 
                    (1 - Math.abs(energy.total - energy.initial) / Math.abs(energy.initial)) * 100 : 100;
                conservationText = `${conservation.toFixed(1)}%`;
            } else if (energy.initial !== undefined && Math.abs(energy.initial) <= 1e-10) {
                // Handle case where initial energy is essentially zero
                if (Math.abs(energy.total) <= 1e-10) {
                    conservation = 100;
                    conservationText = '100.0% (zero energy system)';
                } else {
                    conservation = 0;
                    conservationText = 'N/A (zero initial energy)';
                }
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

    onCollisionTypeChange(type) {
        // To be overridden by the main application
    }

    onRestitutionChange(value) {
        // To be overridden by the main application
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
            const span = button.querySelector('span');
            
            if (isPlaying && !isPaused) {
                icon.className = 'fas fa-pause';
                span.textContent = 'Pause';
                button.classList.remove('primary');
                button.classList.add('secondary');
            } else {
                icon.className = 'fas fa-play';
                span.textContent = 'Start';
                button.classList.remove('secondary');
                button.classList.add('primary');
            }
        }
    }

    updateMousePosition(x, y) {
        const mousePositionElement = document.getElementById('mouse-position');
        if (mousePositionElement) {
            mousePositionElement.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
        }
    }
    
    updateSelectedBodyPanel(selectedBody) {
        // This would update a selected body info panel if it exists
        // For now, we'll just log it in debug mode
        if (window.DEBUG && selectedBody) {
            console.log('Selected body:', selectedBody);
        }
    }
    
    updatePlayPauseButton(isRunning, isPaused) {
        const playPauseBtn = document.getElementById('play-pause');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            const span = playPauseBtn.querySelector('span');
            
            if (isRunning && !isPaused) {
                if (icon) icon.className = 'fas fa-pause';
                if (span) span.textContent = 'Pause';
            } else {
                if (icon) icon.className = 'fas fa-play';
                if (span) span.textContent = 'Play';
            }
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
            
            // Update body information with improved formatting
            const massValue = document.getElementById('body-mass-value');
            const massReal = document.getElementById('body-mass-real');
            const positionValue = document.getElementById('body-position-value');
            const positionReal = document.getElementById('body-position-real');
            const velocityValue = document.getElementById('body-velocity-value');
            const velocityReal = document.getElementById('body-velocity-real');
            const kineticValue = document.getElementById('body-kinetic-value');
            const kineticReal = document.getElementById('body-kinetic-real');
            
            if (massValue) massValue.textContent = selectedBody.mass.toFixed(2);
            if (massReal) {
                const earthMasses = selectedBody.mass;
                const kg = selectedBody.mass * 5.97e24;
                massReal.textContent = earthMasses >= 1 ? 
                    `${earthMasses.toFixed(1)} Earth masses` : 
                    `${(earthMasses * 1000).toFixed(1)}‰ Earth mass`;
            }
            
            if (positionValue) {
                positionValue.textContent = `(${selectedBody.position.x.toFixed(2)}, ${selectedBody.position.y.toFixed(2)})`;
            }
            if (positionReal) {
                const auX = selectedBody.position.x;
                const auY = selectedBody.position.y;
                const distance = Math.sqrt(auX * auX + auY * auY);
                positionReal.textContent = distance >= 1 ? 
                    `${distance.toFixed(2)} AU from center` : 
                    `${(distance * 149.6).toFixed(1)} million km from center`;
            }
            
            if (velocityValue) {
                const speed = selectedBody.velocity.magnitude();
                velocityValue.textContent = speed.toFixed(2);
            }
            if (velocityReal) {
                const speed = selectedBody.velocity.magnitude();
                const kmPerSec = speed * 29.78;
                velocityReal.textContent = `${kmPerSec.toFixed(1)} km/s`;
            }
            
            if (kineticValue && selectedBody.kineticEnergy !== undefined) {
                kineticValue.textContent = selectedBody.kineticEnergy.toFixed(2);
            }
            if (kineticReal && selectedBody.kineticEnergy !== undefined) {
                const realKE = selectedBody.kineticEnergy * 5.97e24 * Math.pow(29780, 2);
                kineticReal.textContent = `${realKE.toExponential(2)} J`;
            }
            
            // Update the tip text for selected body
            const tipText = document.getElementById('reference-note-text');
            if (tipText) {
                tipText.textContent = `This body has ${selectedBody.mass.toFixed(1)} times the mass of Earth and is moving at ${(selectedBody.velocity.magnitude() * 29.78).toFixed(1)} km/s.`;
            }
        } else if (selectedBodyInfo) {
            selectedBodyInfo.style.display = 'none';
            
            // Reset tip text when no body is selected
            const tipText = document.getElementById('reference-note-text');
            if (tipText) {
                tipText.textContent = 'Click on any body in the simulation to see how it compares to real astronomical objects!';
            }
        }
        
        // Update comparison bodies based on current masses
        this.updateMassComparisons(bodies);
    }
    
    // Update mass comparison display
    updateMassComparisons(bodies) {
        if (bodies.length === 0) {
            // Hide all comparisons when no bodies exist
            const comparisons = ['comparison-sun', 'comparison-moon', 'comparison-jupiter', 'comparison-mars'];
            comparisons.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.style.display = 'none';
            });
            return;
        }
        
        const maxMass = Math.max(...bodies.map(b => b.mass));
        const minMass = Math.min(...bodies.map(b => b.mass));
        const avgMass = bodies.reduce((sum, b) => sum + b.mass, 0) / bodies.length;
        
        // Show/hide comparison elements based on mass range with smarter logic
        const sunComparison = document.getElementById('comparison-sun');
        const moonComparison = document.getElementById('comparison-moon');
        const jupiterComparison = document.getElementById('comparison-jupiter');
        const marsComparison = document.getElementById('comparison-mars');
        
        // Show sun comparison if we have massive bodies or many bodies
        if (sunComparison) {
            sunComparison.style.display = (maxMass > 50 || bodies.length > 5) ? 'flex' : 'none';
        }
        
        // Show moon comparison if we have small bodies
        if (moonComparison) {
            moonComparison.style.display = (minMass < 0.5 || avgMass < 1) ? 'flex' : 'none';
        }
        
        // Show Jupiter comparison if we have large planetary bodies
        if (jupiterComparison) {
            jupiterComparison.style.display = (maxMass > 10 && maxMass < 1000) ? 'flex' : 'none';
        }
        
        // Show Mars comparison if we have smaller terrestrial planet bodies
        if (marsComparison) {
            marsComparison.style.display = (minMass < 5 && maxMass > 0.05) ? 'flex' : 'none';
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
        // Remove existing listeners first to prevent duplicates
        element.removeEventListener('mouseenter', this.boundShowTooltip);
        element.removeEventListener('mouseleave', this.boundHideTooltip);
        element.removeEventListener('mousemove', this.boundUpdatePosition);
        element.removeEventListener('focus', this.boundShowTooltip);
        element.removeEventListener('blur', this.boundHideTooltip);
        
        // Add new listeners
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
    
    // UI Update Methods
    updateFPS(fps) {
        const fpsDisplay = this.getElement('fps-display');
        if (fpsDisplay) {
            fpsDisplay.textContent = `${Math.round(fps)} FPS`;
        }
    }
    
    updateStatus(status) {
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (statusText) {
            statusText.textContent = status;
        }
        
        if (statusDot) {
            statusDot.className = `status-dot ${status.toLowerCase()}`;
        }
    }
    
    updateInfoPanel(info) {
        // Update View tab system info
        const bodyCountElement = document.getElementById('body-count');
        if (bodyCountElement) {
            bodyCountElement.textContent = info.bodyCount || 0;
        }
        
        // Update body count in Bodies tab
        const bodyCountDisplay = this.getElement('body-count-display');
        if (bodyCountDisplay) {
            bodyCountDisplay.textContent = info.bodyCount || 0;
        }
        
        const totalMassElement = document.getElementById('total-mass');
        if (totalMassElement) {
            totalMassElement.textContent = (info.totalMass || 0).toFixed(1);
        }
        
        const kineticEnergyElement = document.getElementById('kinetic-energy');
        if (kineticEnergyElement) {
            kineticEnergyElement.textContent = (info.kineticEnergy || 0).toFixed(1);
        }
        
        const potentialEnergyElement = document.getElementById('potential-energy');
        if (potentialEnergyElement) {
            potentialEnergyElement.textContent = (info.potentialEnergy || 0).toFixed(1);
        }
    }
    
    updateEnergyDisplay(energyStats) {
        // Update Energy tab
        const kineticElement = document.getElementById('energy-kinetic');
        if (kineticElement) {
            kineticElement.textContent = (energyStats.kinetic || 0).toFixed(2);
        }
        
        const potentialElement = document.getElementById('energy-potential');
        if (potentialElement) {
            potentialElement.textContent = (energyStats.potential || 0).toFixed(2);
        }
        
        const totalElement = document.getElementById('energy-total');
        if (totalElement) {
            totalElement.textContent = (energyStats.total || 0).toFixed(2);
        }
    }
    
    updateEnergyChart(energyStats) {
        // This would be for the energy chart visualization
        // Implementation depends on the charting library being used
        // For now, just log the data
        if (window.DEBUG) {
            console.log('Energy Chart Update:', energyStats);
        }
    }
    
    updateMousePosition(x, y) {
        const mousePositionElement = document.getElementById('mouse-position');
        if (mousePositionElement) {
            mousePositionElement.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
        }
    }
    
    updateSelectedBodyPanel(selectedBody) {
        // This would update a selected body info panel if it exists
        // For now, we'll just log it in debug mode
        if (window.DEBUG && selectedBody) {
            console.log('Selected body:', selectedBody);
        }
    }
    
    updatePlayPauseButton(isRunning, isPaused) {
        const playPauseBtn = document.getElementById('play-pause');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            const span = playPauseBtn.querySelector('span');
            
            if (isRunning && !isPaused) {
                if (icon) icon.className = 'fas fa-pause';
                if (span) span.textContent = 'Pause';
            } else {
                if (icon) icon.className = 'fas fa-play';
                if (span) span.textContent = 'Play';
            }
        }
    }

    updateComputeModeDisplay(mode) {
        const computeModeElement = document.getElementById('performance-compute-mode');
        if (computeModeElement) {
            computeModeElement.textContent = mode;
            computeModeElement.classList.toggle('gpu-mode', mode === 'GPU');
            computeModeElement.classList.toggle('cpu-mode', mode === 'CPU');
        }
    }

    // Clear cached elements (useful when DOM structure changes)
    clearElementCache() {
        this.cachedElements.clear();
    }

    // Utility method to get cached DOM elements
    getElement(id) {
        if (!this.cachedElements.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.cachedElements.set(id, element);
            }
        }
        return this.cachedElements.get(id) || null;
    }

    updateScaleReference(simulationData) {
        // Validate input
        if (!simulationData || typeof simulationData !== 'object') {
            return;
        }
        
        // Update dashboard stats
        this.updateScaleDashboard(simulationData);
        
        // Update unit values if needed
        this.updateScaleUnits(simulationData);
        
        // Update planetary animations
        this.updatePlanetaryAnimations();
    }
    
    updateScaleDashboard(simulationData) {
        const { bodies = [], timeElapsed = 0, systemExtent = null } = simulationData;
        
        // Update body count
        const bodyCountEl = document.getElementById('current-bodies-count');
        if (bodyCountEl) {
            bodyCountEl.textContent = bodies.length.toString();
        }
        
        // Update system size
        const systemExtentEl = document.getElementById('simulation-extent');
        if (systemExtentEl && systemExtent) {
            if (systemExtent < 1) {
                systemExtentEl.textContent = `${(systemExtent * 1000).toFixed(1)} km`;
            } else if (systemExtent < 100) {
                systemExtentEl.textContent = `${systemExtent.toFixed(2)} AU`;
            } else {
                systemExtentEl.textContent = `${(systemExtent / 63241).toFixed(2)} ly`;
            }
        }
        
        // Update time elapsed
        const timeElapsedEl = document.getElementById('time-elapsed');
        if (timeElapsedEl) {
            if (timeElapsed < 0.1) {
                timeElapsedEl.textContent = `${(timeElapsed * 365.25).toFixed(1)} days`;
            } else if (timeElapsed < 1000) {
                timeElapsedEl.textContent = `${timeElapsed.toFixed(2)} yr`;
            } else if (timeElapsed < 1000000) {
                timeElapsedEl.textContent = `${(timeElapsed / 1000).toFixed(2)} kyr`;
            } else {
                timeElapsedEl.textContent = `${(timeElapsed / 1000000).toFixed(2)} Myr`;
            }
        }
    }
    
    updateScaleUnits(simulationData) {
        // Update velocity scale based on typical velocities in the system
        const velocityScaleEl = document.getElementById('velocity-scale');
        if (velocityScaleEl && simulationData.bodies && simulationData.bodies.length > 0) {
            // Calculate average velocity
            let totalVelocity = 0;
            let count = 0;
            
            simulationData.bodies.forEach(body => {
                if (body.vx !== undefined && body.vy !== undefined) {
                    const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
                    totalVelocity += speed;
                    count++;
                }
            });
            
            if (count > 0) {
                const avgVelocity = totalVelocity / count;
                // Convert to km/s (assuming 1 unit = 29.8 km/s, Earth's orbital speed)
                const kmPerS = avgVelocity * 29.8;
                
                if (kmPerS < 1) {
                    velocityScaleEl.textContent = `${(kmPerS * 1000).toFixed(0)} m/s`;
                } else if (kmPerS < 300000) {
                    velocityScaleEl.textContent = `${kmPerS.toFixed(1)} km/s`;
                } else {
                    velocityScaleEl.textContent = `${(kmPerS / 299792458).toFixed(3)}c`;
                }
            }
        }
    }
    
    updatePlanetaryAnimations() {
        // Add sparkle effects to unit bars
        const unitBars = document.querySelectorAll('.unit-bar .bar-spark');
        unitBars.forEach((spark, index) => {
            // Stagger the animation start times
            spark.style.animationDelay = `${index * 0.5}s`;
        });
        
        // Update power scale highlighting based on current system scale
        const powerScales = document.querySelectorAll('.power-scale');
        powerScales.forEach(scale => {
            scale.classList.remove('active');
        });
        
        // Highlight the most relevant power scale (can be enhanced based on actual system size)
        const defaultPowerScale = document.querySelector('.power-scale[data-power="0"]');
        if (defaultPowerScale) {
            defaultPowerScale.classList.add('active');
        }
    }
    
    // Initialize Scale Reference interactive features
    initializeScaleReference() {
        // Add hover effects for planets
        const planets = document.querySelectorAll('.planet');
        planets.forEach(planet => {
            planet.addEventListener('click', (e) => {
                this.showPlanetDetails(e.target.closest('.planet'));
            });
        });
        
        // Add click handlers for power scales
        const powerScales = document.querySelectorAll('.power-scale');
        powerScales.forEach(scale => {
            scale.addEventListener('click', () => {
                powerScales.forEach(s => s.classList.remove('active'));
                scale.classList.add('active');
                this.onPowerScaleSelect(scale.dataset.power);
            });
        });
        
        // Add journey step interactions
        const journeySteps = document.querySelectorAll('.journey-step');
        journeySteps.forEach(step => {
            step.addEventListener('click', () => {
                this.showScaleJourneyDetails(step);
            });
        });
    }
    
    showPlanetDetails(planetElement) {
        if (!planetElement) return;
        
        const distance = planetElement.dataset.distance;
        const planetName = planetElement.querySelector('.planet-tooltip')?.textContent.split('\n')[0];
        
        if (planetName && distance) {
            console.log(`Planet ${planetName} selected - Distance: ${distance} AU`);
            // Could show detailed information in a modal or tooltip
        }
    }
    
    onPowerScaleSelect(power) {
        console.log(`Power scale selected: 10^${power}`);
        // Could update the simulation view or provide scale context
    }
    
    showScaleJourneyDetails(stepElement) {
        const stepType = stepElement.classList.contains('local') ? 'local' :
                        stepElement.classList.contains('stellar') ? 'stellar' :
                        stepElement.classList.contains('galactic') ? 'galactic' : 'universal';
        
        console.log(`Scale journey step selected: ${stepType}`);
        // Could show detailed information about this scale range
    }
}
