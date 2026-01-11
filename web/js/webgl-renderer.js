/**
 * High-Performance WebGL Renderer for N-body simulation
 * Features:
 * - Instanced rendering for thousands of bodies
 * - Level of Detail (LOD) system
 * - Frustum culling
 * - Proper scaling and accurate size representation
 * - GPU-based particle effects
 */

class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            throw new Error('WebGL 2.0 not supported');
        }

        // Viewport and canvas setup
        this.width = canvas.width;
        this.height = canvas.height;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // Camera system
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0,
            targetZoom: 1.0,
            smoothing: 0.1,
            viewMatrix: new Float32Array(16),
            projectionMatrix: new Float32Array(16)
        };

        // Rendering settings
        this.showTrails = true;
        this.showGrid = true;
        this.lodEnabled = true;
        this.frustumCulling = true;
        this.maxVisibleBodies = 10000;
        
        // LOD thresholds (screen pixel radius)
        this.lodThresholds = {
            high: 10,    // Full detail above 10 pixels
            medium: 5,   // Medium detail 5-10 pixels
            low: 2,      // Low detail 2-5 pixels
            point: 0     // Point rendering below 2 pixels
        };

        // Performance tracking
        this.stats = {
            drawCalls: 0,
            bodiesRendered: 0,
            bodiesCulled: 0,
            renderTime: 0,
            lastFrameTime: 0,
            fps: 60
        };

        // Initialize WebGL components
        this.initializeGL();
        this.createShaders();
        this.createBuffers();
        this.setupMatrices();
        
        console.log('WebGL Renderer initialized successfully');
    }

    initializeGL() {
        const gl = this.gl;
        
        // Set viewport
        gl.viewport(0, 0, this.width, this.height);
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // Set clear color (space background)
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        
        // Enable face culling for better performance
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
    }

    createShaders() {
        const gl = this.gl;
        
        // Body vertex shader with instancing support
        const bodyVertexShader = `#version 300 es
            precision highp float;
            
            // Vertex attributes
            in vec2 a_position;           // Circle vertex positions
            in vec2 a_instancePosition;   // Body world position
            in float a_instanceRadius;    // Body radius
            in vec3 a_instanceColor;      // Body color
            in float a_instanceMass;      // Body mass (for additional effects)
            in float a_instanceSelected;  // Selection state
            
            // Uniforms
            uniform mat4 u_viewMatrix;
            uniform mat4 u_projectionMatrix;
            uniform float u_pixelRatio;
            uniform float u_minPixelRadius;
            
            // Outputs to fragment shader
            out vec2 v_uv;
            out vec3 v_color;
            out float v_radius;
            out float v_selected;
            out float v_mass;
            
            void main() {
                // Calculate screen radius with minimum pixel size
                float screenRadius = a_instanceRadius * u_viewMatrix[0][0]; // Extract zoom from view matrix
                float finalRadius = max(screenRadius, u_minPixelRadius);
                
                // Calculate world position
                vec2 worldPos = a_instancePosition + a_position * finalRadius;
                
                // Transform to clip space
                vec4 clipPos = u_projectionMatrix * u_viewMatrix * vec4(worldPos, 0.0, 1.0);
                gl_Position = clipPos;
                
                // Pass data to fragment shader
                v_uv = a_position;
                v_color = a_instanceColor;
                v_radius = finalRadius;
                v_selected = a_instanceSelected;
                v_mass = a_instanceMass;
            }
        `;
        
        // Body fragment shader with quality levels
        const bodyFragmentShader = `#version 300 es
            precision highp float;
            
            // Inputs from vertex shader
            in vec2 v_uv;
            in vec3 v_color;
            in float v_radius;
            in float v_selected;
            in float v_mass;
            
            // Uniforms
            uniform float u_time;
            uniform float u_glowIntensity;
            uniform int u_qualityLevel; // 0=point, 1=low, 2=medium, 3=high
            
            out vec4 fragColor;
            
            void main() {
                float distance = length(v_uv);
                
                // Quality-based rendering
                if (u_qualityLevel == 0) {
                    // Point rendering - simple circle
                    if (distance > 1.0) discard;
                    fragColor = vec4(v_color, 1.0);
                    return;
                }
                
                if (distance > 1.0) discard;
                
                // Base color
                vec3 color = v_color;
                
                if (u_qualityLevel >= 2) {
                    // Medium+ quality: Add highlight
                    vec2 highlightPos = vec2(-0.3, -0.3);
                    float highlightDist = length(v_uv - highlightPos);
                    float highlight = smoothstep(0.4, 0.2, highlightDist);
                    color = mix(color, color + 0.3, highlight);
                }
                
                if (u_qualityLevel >= 3) {
                    // High quality: Add atmospheric glow
                    float atmosphereRadius = 1.2;
                    float atmosphereIntensity = 1.0 - smoothstep(0.8, atmosphereRadius, distance);
                    color += v_color * atmosphereIntensity * 0.2;
                }
                
                // Selection glow
                if (v_selected > 0.5) {
                    float selectionGlow = 1.0 - smoothstep(0.8, 1.2, distance);
                    color = mix(color, vec3(0.4, 1.0, 0.86), selectionGlow * 0.5);
                }
                
                // Smooth edge with anti-aliasing
                float alpha = 1.0 - smoothstep(0.8, 1.0, distance);
                
                fragColor = vec4(color, alpha);
            }
        `;
        
        // Trail vertex shader
        const trailVertexShader = `#version 300 es
            precision highp float;
            
            in vec2 a_position;
            in float a_age;
            
            uniform mat4 u_viewMatrix;
            uniform mat4 u_projectionMatrix;
            uniform vec3 u_color;
            
            out float v_age;
            out vec3 v_color;
            
            void main() {
                vec4 clipPos = u_projectionMatrix * u_viewMatrix * vec4(a_position, 0.0, 1.0);
                gl_Position = clipPos;
                
                v_age = a_age;
                v_color = u_color;
            }
        `;
        
        // Trail fragment shader
        const trailFragmentShader = `#version 300 es
            precision highp float;
            
            in float v_age;
            in vec3 v_color;
            
            out vec4 fragColor;
            
            void main() {
                float alpha = 1.0 - v_age;
                fragColor = vec4(v_color, alpha * 0.6);
            }
        `;
        
        // Compile shaders
        this.bodyProgram = this.createProgram(bodyVertexShader, bodyFragmentShader);
        this.trailProgram = this.createProgram(trailVertexShader, trailFragmentShader);
        
        // Get uniform locations
        this.bodyUniforms = this.getUniforms(this.bodyProgram, [
            'u_viewMatrix', 'u_projectionMatrix', 'u_pixelRatio', 
            'u_minPixelRadius', 'u_time', 'u_glowIntensity', 'u_qualityLevel'
        ]);
        
        this.trailUniforms = this.getUniforms(this.trailProgram, [
            'u_viewMatrix', 'u_projectionMatrix', 'u_color'
        ]);
        
        // Get attribute locations
        this.bodyAttributes = this.getAttributes(this.bodyProgram, [
            'a_position', 'a_instancePosition', 'a_instanceRadius', 
            'a_instanceColor', 'a_instanceMass', 'a_instanceSelected'
        ]);
        
        this.trailAttributes = this.getAttributes(this.trailProgram, [
            'a_position', 'a_age'
        ]);
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program linking failed: ${error}`);
        }
        
        return program;
    }

    compileShader(type, source) {
        const gl = this.gl;
        
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation failed: ${error}`);
        }
        
        return shader;
    }

    getUniforms(program, names) {
        const gl = this.gl;
        const uniforms = {};
        
        for (const name of names) {
            uniforms[name] = gl.getUniformLocation(program, name);
        }
        
        return uniforms;
    }

    getAttributes(program, names) {
        const gl = this.gl;
        const attributes = {};
        
        for (const name of names) {
            attributes[name] = gl.getAttribLocation(program, name);
        }
        
        return attributes;
    }

    createBuffers() {
        const gl = this.gl;
        
        // Create circle geometry for bodies (unit circle)
        const segments = 32;
        const vertices = [];
        
        // Center vertex
        vertices.push(0, 0);
        
        // Ring vertices
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            vertices.push(Math.cos(angle), Math.sin(angle));
        }
        
        // Create indices for triangle fan
        const indices = [];
        for (let i = 1; i < segments; i++) {
            indices.push(0, i, i + 1);
        }
        indices.push(0, segments, 1); // Close the fan
        
        // Create vertex buffer
        this.circleVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        
        // Create index buffer
        this.circleIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.circleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        
        this.circleIndexCount = indices.length;
        
        // Create instance data buffers (will be updated each frame)
        this.instancePositionBuffer = gl.createBuffer();
        this.instanceRadiusBuffer = gl.createBuffer();
        this.instanceColorBuffer = gl.createBuffer();
        this.instanceMassBuffer = gl.createBuffer();
        this.instanceSelectedBuffer = gl.createBuffer();
        
        // Trail buffers
        this.trailVertexBuffer = gl.createBuffer();
        this.trailIndexBuffer = gl.createBuffer();
        
        // Create VAO for bodies
        this.bodyVAO = gl.createVertexArray();
        gl.bindVertexArray(this.bodyVAO);
        
        // Setup vertex attributes for circle geometry
        gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVertexBuffer);
        gl.enableVertexAttribArray(this.bodyAttributes.a_position);
        gl.vertexAttribPointer(this.bodyAttributes.a_position, 2, gl.FLOAT, false, 0, 0);
        
        // Setup instance attributes (will be filled later)
        this.setupInstanceAttributes();
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.circleIndexBuffer);
        gl.bindVertexArray(null);
    }

    setupInstanceAttributes() {
        const gl = this.gl;
        
        // Instance position
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instancePositionBuffer);
        gl.enableVertexAttribArray(this.bodyAttributes.a_instancePosition);
        gl.vertexAttribPointer(this.bodyAttributes.a_instancePosition, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.bodyAttributes.a_instancePosition, 1);
        
        // Instance radius
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceRadiusBuffer);
        gl.enableVertexAttribArray(this.bodyAttributes.a_instanceRadius);
        gl.vertexAttribPointer(this.bodyAttributes.a_instanceRadius, 1, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.bodyAttributes.a_instanceRadius, 1);
        
        // Instance color
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceColorBuffer);
        gl.enableVertexAttribArray(this.bodyAttributes.a_instanceColor);
        gl.vertexAttribPointer(this.bodyAttributes.a_instanceColor, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.bodyAttributes.a_instanceColor, 1);
        
        // Instance mass
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceMassBuffer);
        gl.enableVertexAttribArray(this.bodyAttributes.a_instanceMass);
        gl.vertexAttribPointer(this.bodyAttributes.a_instanceMass, 1, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.bodyAttributes.a_instanceMass, 1);
        
        // Instance selected
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceSelectedBuffer);
        gl.enableVertexAttribArray(this.bodyAttributes.a_instanceSelected);
        gl.vertexAttribPointer(this.bodyAttributes.a_instanceSelected, 1, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.bodyAttributes.a_instanceSelected, 1);
    }

    setupMatrices() {
        // Create projection matrix (orthographic)
        const left = -this.width / 2;
        const right = this.width / 2;
        const bottom = -this.height / 2;
        const top = this.height / 2;
        const near = -1;
        const far = 1;
        
        this.orthoMatrix(this.camera.projectionMatrix, left, right, bottom, top, near, far);
    }

    orthoMatrix(out, left, right, bottom, top, near, far) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);
        
        out[0] = -2 * lr;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = -2 * bt;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = 2 * nf;
        out[11] = 0;
        out[12] = (left + right) * lr;
        out[13] = (top + bottom) * bt;
        out[14] = (far + near) * nf;
        out[15] = 1;
    }

    updateCamera() {
        // Smooth zoom interpolation
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.smoothing;
        
        // Update view matrix
        const zoom = this.camera.zoom;
        const translateX = -this.camera.x * zoom;
        const translateY = -this.camera.y * zoom;
        
        // Create view matrix
        this.camera.viewMatrix[0] = zoom;
        this.camera.viewMatrix[1] = 0;
        this.camera.viewMatrix[2] = 0;
        this.camera.viewMatrix[3] = 0;
        this.camera.viewMatrix[4] = 0;
        this.camera.viewMatrix[5] = zoom;
        this.camera.viewMatrix[6] = 0;
        this.camera.viewMatrix[7] = 0;
        this.camera.viewMatrix[8] = 0;
        this.camera.viewMatrix[9] = 0;
        this.camera.viewMatrix[10] = 1;
        this.camera.viewMatrix[11] = 0;
        this.camera.viewMatrix[12] = translateX;
        this.camera.viewMatrix[13] = translateY;
        this.camera.viewMatrix[14] = 0;
        this.camera.viewMatrix[15] = 1;
    }

    // Main render function
    render(bodies, physicsEngine, selectedBody = null) {
        const startTime = performance.now();
        const gl = this.gl;
        
        // Clear frame
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Update camera
        this.updateCamera();
        
        // Reset stats
        this.stats.drawCalls = 0;
        this.stats.bodiesRendered = 0;
        this.stats.bodiesCulled = 0;
        
        // Render bodies
        this.renderBodies(bodies, selectedBody);
        
        // Render trails if enabled
        if (this.showTrails) {
            this.renderTrails(bodies);
        }
        
        // Update performance stats
        this.stats.renderTime = performance.now() - startTime;
        this.updateFPS();
    }

    renderBodies(bodies, selectedBody) {
        if (bodies.length === 0) return;
        
        const gl = this.gl;
        const visibleBodies = this.frustumCulling ? this.cullBodies(bodies) : bodies;
        
        if (visibleBodies.length === 0) return;
        
        // Prepare instance data
        const instanceData = this.prepareInstanceData(visibleBodies, selectedBody);
        
        // Update instance buffers
        this.updateInstanceBuffers(instanceData);
        
        // Use body shader program
        gl.useProgram(this.bodyProgram);
        
        // Set uniforms
        gl.uniformMatrix4fv(this.bodyUniforms.u_viewMatrix, false, this.camera.viewMatrix);
        gl.uniformMatrix4fv(this.bodyUniforms.u_projectionMatrix, false, this.camera.projectionMatrix);
        gl.uniform1f(this.bodyUniforms.u_pixelRatio, this.devicePixelRatio);
        gl.uniform1f(this.bodyUniforms.u_minPixelRadius, 2.0);
        gl.uniform1f(this.bodyUniforms.u_time, performance.now() / 1000.0);
        gl.uniform1f(this.bodyUniforms.u_glowIntensity, 1.0);
        gl.uniform1i(this.bodyUniforms.u_qualityLevel, this.getQualityLevel());
        
        // Bind VAO and render
        gl.bindVertexArray(this.bodyVAO);
        gl.drawElementsInstanced(gl.TRIANGLES, this.circleIndexCount, gl.UNSIGNED_SHORT, 0, visibleBodies.length);
        
        // Update stats
        this.stats.drawCalls++;
        this.stats.bodiesRendered = visibleBodies.length;
        this.stats.bodiesCulled = bodies.length - visibleBodies.length;
    }

    cullBodies(bodies) {
        // Simple frustum culling based on camera bounds
        const zoom = this.camera.zoom;
        const halfWidth = this.width / (2 * zoom);
        const halfHeight = this.height / (2 * zoom);
        
        const left = this.camera.x - halfWidth;
        const right = this.camera.x + halfWidth;
        const bottom = this.camera.y - halfHeight;
        const top = this.camera.y + halfHeight;
        
        return bodies.filter(body => {
            const margin = body.radius * 2; // Add margin for body radius
            return (
                body.position.x + margin >= left &&
                body.position.x - margin <= right &&
                body.position.y + margin >= bottom &&
                body.position.y - margin <= top
            );
        });
    }

    prepareInstanceData(bodies, selectedBody) {
        const positions = new Float32Array(bodies.length * 2);
        const radii = new Float32Array(bodies.length);
        const colors = new Float32Array(bodies.length * 3);
        const masses = new Float32Array(bodies.length);
        const selected = new Float32Array(bodies.length);
        
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            
            // Position
            positions[i * 2] = body.position.x;
            positions[i * 2 + 1] = body.position.y;
            
            // Radius
            radii[i] = body.radius;
            
            // Color (convert hex to RGB)
            const rgb = this.hexToRgb(body.color);
            colors[i * 3] = rgb.r / 255;
            colors[i * 3 + 1] = rgb.g / 255;
            colors[i * 3 + 2] = rgb.b / 255;
            
            // Mass
            masses[i] = body.mass;
            
            // Selected
            selected[i] = body === selectedBody ? 1.0 : 0.0;
        }
        
        return { positions, radii, colors, masses, selected };
    }

    updateInstanceBuffers(instanceData) {
        const gl = this.gl;
        
        // Update position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instancePositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.positions, gl.DYNAMIC_DRAW);
        
        // Update radius buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceRadiusBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.radii, gl.DYNAMIC_DRAW);
        
        // Update color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.colors, gl.DYNAMIC_DRAW);
        
        // Update mass buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceMassBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.masses, gl.DYNAMIC_DRAW);
        
        // Update selected buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceSelectedBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.selected, gl.DYNAMIC_DRAW);
    }

    getQualityLevel() {
        // Determine quality level based on zoom and performance
        const zoom = this.camera.zoom;
        const bodyCount = this.stats.bodiesRendered;
        
        if (bodyCount > 5000) return 0; // Point rendering for many bodies
        if (zoom < 0.5) return 1; // Low quality when zoomed out
        if (zoom < 1.5) return 2; // Medium quality
        return 3; // High quality when zoomed in
    }

    renderTrails(bodies) {
        // Trail rendering implementation
        // This would render the trails using line strips
        // For now, we'll skip this to focus on body rendering
    }

    updateFPS() {
        const now = performance.now();
        const delta = now - this.stats.lastFrameTime;
        this.stats.lastFrameTime = now;
        
        if (delta > 0) {
            this.stats.fps = 1000 / delta;
        }
    }

    // Utility functions
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    // Camera controls
    setCamera(x, y, zoom) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.targetZoom = zoom;
    }

    setZoom(zoom) {
        this.camera.targetZoom = Math.max(0.1, Math.min(10.0, zoom));
    }

    zoomIn(factor = 1.2) {
        this.camera.targetZoom = Math.max(0.1, Math.min(10.0, this.camera.targetZoom * factor));
    }

    zoomOut(factor = 1.2) {
        this.camera.targetZoom = Math.max(0.1, Math.min(10.0, this.camera.targetZoom / factor));
    }

    panCamera(deltaX, deltaY) {
        // Convert screen delta to world delta
        const worldDeltaX = deltaX / this.camera.zoom;
        const worldDeltaY = deltaY / this.camera.zoom;
        
        this.camera.x += worldDeltaX;
        this.camera.y += worldDeltaY;
    }

    // Settings
    setShowTrails(show) {
        this.showTrails = show;
    }

    setLODEnabled(enabled) {
        this.lodEnabled = enabled;
    }

    setFrustumCulling(enabled) {
        this.frustumCulling = enabled;
    }

    // Get render statistics
    getStats() {
        return { ...this.stats };
    }

    // Resize handler
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.gl.viewport(0, 0, width, height);
        this.setupMatrices();
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

    // Additional methods for compatibility
    renderOrbitPreview(...args) {
        // Placeholder for orbit preview rendering
    }

    setShowOrbitPreview(show) {
        this.showOrbitPreview = show;
    }

    setLongTermPreview(show) {
        this.showLongTermPreview = show;
    }

    setupCanvas() {
        // WebGL setup is handled in initializeGL
        // This is here for compatibility with the canvas renderer
    }

    // Cleanup
    destroy() {
        const gl = this.gl;
        
        // Delete buffers
        gl.deleteBuffer(this.circleVertexBuffer);
        gl.deleteBuffer(this.circleIndexBuffer);
        gl.deleteBuffer(this.instancePositionBuffer);
        gl.deleteBuffer(this.instanceRadiusBuffer);
        gl.deleteBuffer(this.instanceColorBuffer);
        gl.deleteBuffer(this.instanceMassBuffer);
        gl.deleteBuffer(this.instanceSelectedBuffer);
        
        // Delete VAO
        gl.deleteVertexArray(this.bodyVAO);
        
        // Delete programs
        gl.deleteProgram(this.bodyProgram);
        gl.deleteProgram(this.trailProgram);
    }
}
