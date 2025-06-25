class UIManager {
    constructor() {
        this.sliders = new Map();
        this.buttons = new Map();
        this.checkboxes = new Map();
        this.colorPicker = null;
        this.selectedColor = '#ff4757';
        this.orbitMode = false;
        this.renderer = null; // Will be set by app
        
        this.initializeSliders();
        this.initializeButtons();
        this.initializeCheckboxes();
        this.initializeColorPicker();
        this.initializeModal();
        this.initializeModeButtons();
        this.setupEventListeners();
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    initializeSliders() {
        // Define all sliders with their configurations
        const sliderConfigs = [
            { id: 'gravity-strength', min: 0.1, max: 3.0, step: 0.1, default: 1.0, extendedMax: 50, format: (v) => v.toFixed(1) },
            { id: 'time-scale', min: 0.1, max: 3.0, step: 0.1, default: 1.0, extendedMax: 10, format: (v) => v.toFixed(1) + 'x' },
            { id: 'body-mass', min: 1, max: 200, step: 1, default: 50, extendedMax: 10000, format: (v) => Math.round(v).toString() },
            { id: 'velocity-x', min: -50, max: 50, step: 1, default: 0, extendedMax: 1000, format: (v) => Math.round(v).toString() },
            { id: 'velocity-y', min: -50, max: 50, step: 1, default: 0, extendedMax: 1000, format: (v) => Math.round(v).toString() },
            { id: 'trail-length', min: 0, max: 100, step: 1, default: 50, extendedMax: 1000, format: (v) => Math.round(v).toString() }
        ];

        sliderConfigs.forEach(config => {
            const slider = document.getElementById(config.id);
            const input = document.getElementById(config.id + '-input');
            
            if (slider && input) {
                // Set initial values
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
                    const value = parseFloat(e.target.value);
                    // Only update slider if value is within range
                    if (value >= config.min && value <= config.max) {
                        slider.value = value;
                    }
                    this.onSliderChange(config.id, value);
                });
                
                this.sliders.set(config.id, { element: slider, input, config });
            }
        });
    }

    initializeButtons() {
        const buttonIds = [
            'play-pause', 'reset', 'clear', 'zoom-in', 'zoom-out',
            'center-view', 'fit-view', 'save-config', 'load-config',
            'export-video', 'delete-selected', 'help-btn'
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
            'collision-enabled', 'show-trails', 'show-grid', 'show-forces'
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

    // Event handlers (to be overridden by the main application)
    onSliderChange(sliderId, value) {
        console.log(`Slider ${sliderId} changed to ${value}`);
    }

    onButtonClick(buttonId) {
        console.log(`Button ${buttonId} clicked`);
    }

    onCheckboxChange(checkboxId, checked) {
        console.log(`Checkbox ${checkboxId} changed to ${checked}`);
    }

    onColorChange(color) {
        console.log(`Color changed to ${color}`);
    }

    onPresetSelect(preset) {
        console.log(`Preset ${preset} selected`);
    }

    onFileLoad(file) {
        console.log(`File loaded: ${file.name}`);
    }

    onKeyDown(event) {
        console.log(`Key pressed: ${event.key}`);
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
}
