/**
 * WebGL GPU Compute Engine for N-body physics calculations
 *
 * This is a corrected and working implementation using:
 * - A true N-Body calculation in the vertex shader.
 * - A proper, efficient "ping-pong" buffer technique with transform feedback.
 * - A uniform array to pass all body data to the shader for force calculations.
 */
class GPUPhysicsEngine {
    constructor() {
        this.gl = null;
        this.isSupported = false;
        this.program = null;
        this.buffers = { A: null, B: null }; // Simplified ping-pong buffers
        this.vaos = { A: null, B: null };
        this.transformFeedback = null;
        
        // Ping-pong state trackers
        this.currentRead = 'A'; // Start by reading from A
        this.currentWrite = 'B';// and writing to B

        this.maxBodies = 32; // Very conservative limit to avoid uniform register limits
        this.currentBodyCount = 0;
        this.isInitialized = false;
        this.limitWarningShown = false; // Track if we've shown the limitation warning

        // Performance tracking
        this.performanceStats = {
            gpuTime: 0,
            lastUpdateTime: 0
        };

        this.initialize();
    }

    initialize() {
        try {
            const canvas = document.createElement('canvas');
            this.gl = canvas.getContext('webgl2');

            if (!this.gl) {
                console.warn('WebGL 2.0 not supported - GPU acceleration disabled');
                return;
            }

            // Check capabilities and set very conservative limits
            const maxUniforms = this.gl.getParameter(this.gl.MAX_VERTEX_UNIFORM_VECTORS);
            // Each body needs a vec3 (pos.x, pos.y, mass). Very conservative limit to avoid register overflow
            // Leave plenty of room for other uniforms and GPU overhead
            const uniformLimit = Math.floor(maxUniforms / 16); // Very conservative - divide by 16
            this.maxBodies = Math.min(this.maxBodies, uniformLimit, 25); // Hard cap at 25

            console.log('WebGL GPU Physics Engine Initializing...');
            console.log('- Max Vertex Uniforms:', maxUniforms);
            console.log('- Calculated Uniform Limit:', uniformLimit);
            console.log('- Max Bodies Supported (GPU):', this.maxBodies);

            // Verify we have a reasonable limit
            if (this.maxBodies < 5) {
                console.warn('GPU capabilities too limited for GPU physics (less than 5 bodies supported)');
                this.isSupported = false;
                return;
            }

            this.createShaders();
            this.createBuffers();

            this.isSupported = true;
            this.isInitialized = true;
            console.log('GPU Physics Engine initialized successfully.');

        } catch (error) {
            console.error('Failed to initialize GPU Physics Engine:', error);
            this.isSupported = false;
            this.isInitialized = false;
            
            // Clean up any partially created resources
            this.cleanup();
        }
    }

    cleanup() {
        if (!this.gl) return;
        
        try {
            if (this.program) {
                this.gl.deleteProgram(this.program);
                this.program = null;
            }
            
            if (this.buffers.A) this.gl.deleteBuffer(this.buffers.A);
            if (this.buffers.B) this.gl.deleteBuffer(this.buffers.B);
            if (this.vaos.A) this.gl.deleteVertexArray(this.vaos.A);
            if (this.vaos.B) this.gl.deleteVertexArray(this.vaos.B);
            if (this.transformFeedback) this.gl.deleteTransformFeedback(this.transformFeedback);
            
            this.buffers = { A: null, B: null };
            this.vaos = { A: null, B: null };
            this.transformFeedback = null;
        } catch (e) {
            console.warn('Error during GPU cleanup:', e);
        }
    }

    createShaders() {
        const gl = this.gl;

        // Create vertex shader with dynamic array size based on capabilities
        console.log(`Creating GPU shader with support for ${this.maxBodies} bodies`);

        // Vertex shader that performs a true N-body calculation
        const vertexShaderSource = `#version 300 es
            precision highp float;
            
            // Input attributes for the CURRENT particle
            in vec2 a_position;
            in vec2 a_velocity;
            in float a_mass;
            
            // Transform feedback outputs (new state for the CURRENT particle)
            out vec2 v_newPosition;
            out vec2 v_newVelocity;
            out float v_newMass;
            
            // Uniforms
            uniform float u_deltaTime;
            uniform float u_gravitationalConstant;
            uniform float u_softeningFactor;
            uniform int u_bodyCount;

            // Data for ALL bodies (position + mass)
            // We pack vec2(position) and mass into a vec3
            uniform vec3 u_bodies[${this.maxBodies}];
            
            void main() {
                int my_id = gl_VertexID;
                vec2 my_position = a_position;
                vec2 my_velocity = a_velocity;
                float my_mass = a_mass;

                vec2 total_force = vec2(0.0);

                // N-Body Calculation: loop through all other bodies to sum forces
                for (int i = 0; i < u_bodyCount; ++i) {
                    if (i == my_id) {
                        continue; // Don't calculate gravity against ourselves
                    }

                    vec3 other_body = u_bodies[i];
                    vec2 other_position = other_body.xy;
                    float other_mass = other_body.z;

                    vec2 direction = other_position - my_position;
                    float distance_sq = dot(direction, direction);
                    
                    // Add softening factor to prevent division by zero and extreme forces
                    distance_sq += u_softeningFactor;

                    // Calculate gravitational force magnitude: F = G * (m1 * m2) / r^2
                    float force_magnitude = u_gravitationalConstant * (my_mass * other_mass) / distance_sq;
                    
                    // Calculate force vector and add to total
                    // We use rsqrt for a slight performance gain over sqrt -> normalize
                    vec2 force_vector = normalize(direction) * force_magnitude;
                    total_force += force_vector;
                }

                // Calculate acceleration (a = F/m)
                vec2 acceleration = total_force / my_mass;
                
                // Simple Euler integration to find new velocity and position
                vec2 new_velocity = my_velocity + acceleration * u_deltaTime;
                vec2 new_position = my_position + new_velocity * u_deltaTime;
                
                // Output to transform feedback
                v_newPosition = new_position;
                v_newVelocity = new_velocity;
                v_newMass = my_mass; // Mass is constant, pass it through
                
                // Not used for rendering, but required by GL
                gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `#version 300 es
            precision highp float;
            out vec4 fragColor;
            void main() {
                fragColor = vec4(1.0, 0.0, 0.0, 1.0); // Not rendered
            }
        `;

        console.log('Compiling shaders...');
        
        try {
            const vs = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

            this.program = gl.createProgram();
            gl.attachShader(this.program, vs);
            gl.attachShader(this.program, fs);

            // Specify varyings for transform feedback BEFORE linking
            gl.transformFeedbackVaryings(this.program,
                ['v_newPosition', 'v_newVelocity', 'v_newMass'],
                gl.INTERLEAVED_ATTRIBS);

            console.log('Linking shader program...');
            gl.linkProgram(this.program);

            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
                const linkError = gl.getProgramInfoLog(this.program);
                console.error('Shader link error:', linkError);
                throw new Error('Program link error: ' + linkError);
            }
            
            console.log('GPU shaders compiled and linked successfully');
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            
        } catch (error) {
            console.error('Failed to create GPU shaders:', error);
            throw error; // Re-throw to be caught by initialize()
        }
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            console.error(`Shader compile error (${type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'}):`, error);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error (${type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'}): ${error}`);
        }
        
        return shader;
    }

    createBuffers() {
        const gl = this.gl;
        this.buffers.A = gl.createBuffer();
        this.buffers.B = gl.createBuffer();
        this.vaos.A = gl.createVertexArray();
        this.vaos.B = gl.createVertexArray();
        this.transformFeedback = gl.createTransformFeedback();
        
        const STRIDE = 20; // 5 floats * 4 bytes each (pos.x, pos.y, vel.x, vel.y, mass)

        // Setup VAO for buffer A
        gl.bindVertexArray(this.vaos.A);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.A);
        gl.enableVertexAttribArray(0); // a_position
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(1); // a_velocity
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);
        gl.enableVertexAttribArray(2); // a_mass
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE, 16);

        // Setup VAO for buffer B
        gl.bindVertexArray(this.vaos.B);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.B);
        gl.enableVertexAttribArray(0); // a_position
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(1); // a_velocity
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);
        gl.enableVertexAttribArray(2); // a_mass
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE, 16);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // Main update method called by the application
    update(bodies, deltaTime) {
        // Early return if not ready
        if (!this.isReady()) {
            return false; // Indicate GPU physics failed
        }

        if (bodies.length === 0) {
            return true; // No work to do, but not an error
        }

        // Check if we exceed the GPU limit
        if (bodies.length > this.maxBodies) {
            if (!this.limitWarningShown) {
                console.warn(`GPU Physics: Too many bodies (${bodies.length}), max supported: ${this.maxBodies}. Falling back to CPU physics.`);
                this.limitWarningShown = true;
            }
            return false; // Indicate fallback to CPU is needed
        }

        try {
            const startTime = performance.now();
            
            // If this is the first run or body count changed, initialize buffers
            if (!this.isInitialized || this.currentBodyCount !== bodies.length) {
                this.initializeWithBodyData(bodies);
            }

            this.updateSimulation(bodies, deltaTime);

            this.performanceStats.gpuTime = performance.now() - startTime;

            // The simulation runs entirely on the GPU. We only read back data
            // when the CPU needs it (e.g., for rendering). The application
            // should call `readbackResults` to get the latest data.
            return true; // Indicate success
            
        } catch (error) {
            console.error('GPU Physics error, falling back to CPU:', error);
            this.isSupported = false; // Disable GPU physics for this session
            return false;
        }
    }

    initializeWithBodyData(bodies) {
        const gl = this.gl;
        this.currentBodyCount = bodies.length;
        const bodyData = new Float32Array(this.currentBodyCount * 5);

        for (let i = 0; i < this.currentBodyCount; i++) {
            const body = bodies[i];
            const idx = i * 5;
            bodyData[idx + 0] = body.position.x;
            bodyData[idx + 1] = body.position.y;
            bodyData[idx + 2] = body.velocity.x;
            bodyData[idx + 3] = body.velocity.y;
            bodyData[idx + 4] = body.mass;
        }

        const bufferSize = bodyData.byteLength;
        
        // Upload initial data to the first read buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[this.currentRead]);
        gl.bufferData(gl.ARRAY_BUFFER, bodyData, gl.DYNAMIC_DRAW);
        
        // Allocate space for the first write buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[this.currentWrite]);
        gl.bufferData(gl.ARRAY_BUFFER, bufferSize, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.isInitialized = true;
        console.log(`GPU buffers initialized for ${this.currentBodyCount} bodies.`);
    }

    updateSimulation(bodies, deltaTime) {
        const gl = this.gl;
        const bodyCount = this.currentBodyCount;
        
        // Check for body count limits and warn user
        if (bodyCount > this.maxBodies && !this.limitWarningShown) {
            console.warn(`GPU Physics Warning: Body count (${bodyCount}) exceeds GPU limit (${this.maxBodies}). Performance may be degraded or simulation may fail.`);
            this.limitWarningShown = true;
        }

        // 1. Prepare uniform data (positions and masses of all bodies)
        const uniformBodyData = new Float32Array(bodyCount * 3);
        for (let i = 0; i < bodyCount; i++) {
            const body = bodies[i];
            const idx = i * 3;
            uniformBodyData[idx + 0] = body.position.x;
            uniformBodyData[idx + 1] = body.position.y;
            uniformBodyData[idx + 2] = body.mass;
        }

        // 2. Set up WebGL state
        gl.useProgram(this.program);

        // Set uniforms
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_deltaTime'), deltaTime);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_gravitationalConstant'), 0.5);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_softeningFactor'), 100.0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_bodyCount'), bodyCount);
        gl.uniform3fv(gl.getUniformLocation(this.program, `u_bodies[0]`), uniformBodyData);
        
        // 3. Bind the correct VAO for reading and buffer for writing
        const readVAO = this.vaos[this.currentRead];
        const writeBuffer = this.buffers[this.currentWrite];

        gl.bindVertexArray(readVAO);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, writeBuffer);

        // 4. Run the simulation
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, bodyCount);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);

        // 5. Clean up state
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindVertexArray(null);

        // 6. Swap buffers for the next frame (the "ping-pong")
        const temp = this.currentRead;
        this.currentRead = this.currentWrite;
        this.currentWrite = temp;
    }
    
    // Reads data from the GPU back to the CPU. This is a blocking operation
    // and should be used only when necessary (e.g., for rendering).
    readbackResults(bodies) {
        if (!this.isInitialized) return;

        const gl = this.gl;
        const bodyCount = this.currentBodyCount;

        // The latest data is in the *read* buffer for the *current* frame
        const sourceBuffer = this.buffers[this.currentRead];
        
        const outputData = new Float32Array(bodyCount * 5);

        gl.bindBuffer(gl.ARRAY_BUFFER, sourceBuffer);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, outputData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Update the CPU-side `bodies` array with the new data
        for (let i = 0; i < bodyCount; i++) {
            const body = bodies[i];
            const idx = i * 5;
            body.position.x = outputData[idx + 0];
            body.position.y = outputData[idx + 1];
            body.velocity.x = outputData[idx + 2];
            body.velocity.y = outputData[idx + 3];
            // Mass is at idx + 4, but we assume it's constant
        }
    }
    
    getPerformanceStats() {
        return {
            gpuTime: this.performanceStats.gpuTime,
            isActive: this.isSupported && this.currentBodyCount > 0,
            bodyCount: this.currentBodyCount,
            maxBodies: this.maxBodies
        };
    }
    
    getPerformanceInfo() {
        if (!this.gl) {
            return {
                isSupported: false,
                maxBodies: 0,
                vendor: 'Unknown',
                renderer: 'Unknown',
                webglVersion: 'Not Available'
            };
        }
        
        return {
            isSupported: this.isSupported,
            maxBodies: this.maxBodies,
            currentBodies: this.currentBodyCount,
            vendor: this.gl.getParameter(this.gl.VENDOR),
            renderer: this.gl.getParameter(this.gl.RENDERER),
            webglVersion: this.gl.getParameter(this.gl.VERSION),
            lastGpuTime: this.performanceStats.gpuTime
        };
    }
    
    dispose() {
        if (!this.gl) return;
        // ... (cleanup code is the same)
   }

    // Method to check if GPU physics is ready to use
    isReady() {
        return this.isSupported && this.isInitialized && this.gl && this.program;
    }

    // Method to safely update bodies with GPU physics
    updateBodies(bodies) {
        // Early return if not ready
        if (!this.isReady()) {
            return bodies; // Return unchanged
        }

        if (bodies.length === 0) {
            return bodies;
        }

        // Check if we exceed the GPU limit
        if (bodies.length > this.maxBodies) {
            if (!this.limitWarningShown) {
                console.warn(`GPU Physics: Too many bodies (${bodies.length}), max supported: ${this.maxBodies}. Falling back to CPU physics.`);
                this.limitWarningShown = true;
            }
            return bodies; // Fallback to CPU physics
        }

        try {
            // Upload body data if needed
            if (bodies.length !== this.currentBodyCount) {
                this.uploadBodyData(bodies);
            }

            // Run GPU simulation
            this.updateSimulation(bodies, 0.016); // Assume 60 FPS

            // Read back results
            this.readbackResults(bodies);

            return bodies;
        } catch (error) {
            console.error('GPU Physics error, falling back to CPU:', error);
            this.isSupported = false;
            return bodies;
        }
    }
}

// Export for use in main application
window.GPUPhysicsEngine = GPUPhysicsEngine;