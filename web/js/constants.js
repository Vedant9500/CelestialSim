/**
 * Physics and rendering constants for CelestialSim
 */

// Physics Constants
const PHYSICS_CONSTANTS = {
    // Default gravitational constant
    GRAVITATIONAL_CONSTANT: 100.0,
    
    // Softening parameter to prevent singularities
    SOFTENING_PARAMETER: 20.0,
    
    // Collision detection threshold
    COLLISION_THRESHOLD: 15.0,
    
    // Collision types
    COLLISION_TYPE: {
        INELASTIC: 'inelastic',  // Bodies merge (current behavior)
        ELASTIC: 'elastic'       // Bodies bounce off each other
    },
    
    // Collision physics
    RESTITUTION_COEFFICIENT: 0.7,  // For elastic collisions (0 = inelastic, 1 = perfectly elastic)
    MIN_RESTITUTION: 0.1,
    MAX_RESTITUTION: 0.95,  // Cap at 0.95 to prevent infinite energy gain
    COLLISION_FRICTION: 0.1,  // Tangential friction coefficient
    COLLISION_SAFETY_MARGIN: 0.1,  // Small margin to prevent interpenetration
    COLLISION_COOLDOWN_TIME: 0.25,  // Base cooldown time in seconds
    MAX_VELOCITY_LIMIT: 500,  // Maximum velocity to prevent numerical instability
    
    // Time stepping
    FIXED_TIME_STEP: 1.0 / 60.0, // 60 FPS physics
    MAX_TIME_STEP: 1.0 / 30.0,
    MIN_TIME_STEP: 1.0 / 240.0,
    
    // Barnes-Hut algorithm
    BARNES_HUT_THETA: 0.5,
    BARNES_HUT_MAX_BODIES_THRESHOLD: 5,
    
    // Energy calculation precision
    ENERGY_PRECISION_THRESHOLD: 0.01
};

// Rendering Constants
const RENDERING_CONSTANTS = {
    // Body visualization
    MIN_BODY_RADIUS: 3,
    BODY_RADIUS_SCALE: 5,
    BODY_HITBOX_SCALE: 1.2,
    
    // Trail rendering
    DEFAULT_TRAIL_LENGTH: 50,
    MAX_TRAIL_LENGTH: 1000,
    
    // Camera and zoom
    DEFAULT_ZOOM: 1.0,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 10.0,
    
    // Performance
    MAX_BODIES_FOR_GPU: 1024,
    
    // Long-term prediction
    DEFAULT_PREDICTION_STEPS: 1000,
    MAX_PREDICTION_STEPS: 20000,
    PREDICTION_TIME_STEP: 0.005,
    MAX_PREDICTION_POINTS: 2000
};

// UI Constants
const UI_CONSTANTS = {
    // Notification durations (ms)
    SUCCESS_NOTIFICATION_DURATION: 2000,
    WARNING_NOTIFICATION_DURATION: 3000,
    ERROR_NOTIFICATION_DURATION: 5000,
    
    // Animation speeds
    GLOW_TRANSITION_SPEED: 5.0,
    UI_FADE_DURATION: 300,
    
    // Input validation
    MIN_MASS: 1,
    MAX_MASS: 10000,
    MIN_VELOCITY: -1000,
    MAX_VELOCITY: 1000
};

// Real-world scale constants
const SCALE_CONSTANTS = {
    // 1 simulation unit = 1 Earth mass
    EARTH_MASS: 5.97e24, // kg
    
    // 1 simulation unit = 1 AU
    ASTRONOMICAL_UNIT: 1.496e11, // meters
    
    // 1 simulation unit = 1 Earth year
    EARTH_YEAR: 365.25 * 24 * 3600, // seconds
    
    // Earth's orbital velocity
    EARTH_ORBITAL_VELOCITY: 29780, // m/s
    
    // Celestial body masses (in Earth masses)
    SUN_MASS: 333000,
    JUPITER_MASS: 318,
    MARS_MASS: 0.107,
    MOON_MASS: 0.012
};

// Export constants for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PHYSICS_CONSTANTS,
        RENDERING_CONSTANTS,
        UI_CONSTANTS,
        SCALE_CONSTANTS
    };
}
