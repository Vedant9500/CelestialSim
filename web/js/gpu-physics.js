/**
 * WebGL GPU Compute Engine for N-body physics calculations
 * Simplified version for better compatibility
 */

class GPUPhysicsEngine {
    constructor() {
        this.gl = null;
        this.isSupported = false;
        this.program = null;
        this.maxBodies = 1024; // Conservative limit for compatibility
        
        this.initialize();
    }
    
    initialize() {
        try {
            // Create a hidden canvas for WebGL context
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
            
            // Try WebGL 2.0 first
            this.gl = canvas.getContext('webgl2', {
                preserveDrawingBuffer: true,
                antialias: false
            });
            
            if (!this.gl) {
                // Fallback to WebGL 1.0
                this.gl = canvas.getContext('webgl', {
                    preserveDrawingBuffer: true,
                    antialias: false
                }) || canvas.getContext('experimental-webgl', {
                    preserveDrawingBuffer: true,
                    antialias: false
                });
            }
            
            if (!this.gl) {
                console.warn('WebGL not supported - GPU acceleration disabled');
                return;
            }
            
            // Check for required extensions
            const isWebGL2 = this.gl instanceof WebGL2RenderingContext;
            console.log('WebGL version:', isWebGL2 ? '2.0' : '1.0');
            
            // For WebGL 1.0, check for optional extensions
            let hasFloatTextures = isWebGL2; // WebGL 2.0 supports float textures by default
            if (!isWebGL2) {
                const floatExt = this.gl.getExtension('OES_texture_float');
                hasFloatTextures = !!floatExt;
                if (hasFloatTextures) {
                    console.log('OES_texture_float extension available');
                } else {
                    console.log('OES_texture_float not available - GPU acceleration will work with reduced precision');
                }
            }
            
            // Continue initialization even without float textures
            // We can still do basic GPU calculations with integer textures
            
            // Get WebGL capabilities
            const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
            const maxVertexUniforms = this.gl.getParameter(this.gl.MAX_VERTEX_UNIFORM_VECTORS);
            
            console.log('WebGL GPU Physics Engine capabilities:');
            console.log('- Max texture size:', maxTextureSize);
            console.log('- Max vertex uniforms:', maxVertexUniforms);
            console.log('- WebGL version:', this.gl.getParameter(this.gl.VERSION));
            console.log('- Vendor:', this.gl.getParameter(this.gl.VENDOR));
            console.log('- Renderer:', this.gl.getParameter(this.gl.RENDERER));
            
            // Adjust max bodies based on capabilities
            this.maxBodies = Math.min(this.maxBodies, Math.floor(maxTextureSize / 4));
            
            this.isSupported = true;
            console.log('GPU Physics Engine initialized successfully');
            console.log('- Max bodies supported:', this.maxBodies);
            
        } catch (error) {
            console.error('Failed to initialize GPU Physics Engine:', error);
            this.isSupported = false;
        }
    }
    
    // Main update method - simplified version that falls back to CPU
    update(bodies, deltaTime) {
        if (!this.isSupported || bodies.length === 0) {
            return false;
        }
        
        // For now, this is a placeholder that indicates GPU processing
        // In a full implementation, this would use compute shaders or vertex shaders
        // with transform feedback to calculate forces and update positions
        
        console.log(`GPU physics update called for ${bodies.length} bodies (placeholder)`);
        
        // Currently falls back to CPU processing
        // TODO: Implement actual GPU compute shaders
        return false; // Indicates fallback to CPU is needed
    }
    
    // Check if GPU acceleration is supported
    isGPUSupported() {
        return this.isSupported;
    }
    
    // Get performance information
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
            vendor: this.gl.getParameter(this.gl.VENDOR),
            renderer: this.gl.getParameter(this.gl.RENDERER),
            webglVersion: this.gl.getParameter(this.gl.VERSION)
        };
    }
    
    // Clean up resources
    dispose() {
        if (this.gl && this.gl.canvas) {
            const canvas = this.gl.canvas;
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }
        this.gl = null;
        this.isSupported = false;
    }
}

// Export for use in main application
window.GPUPhysicsEngine = GPUPhysicsEngine;
