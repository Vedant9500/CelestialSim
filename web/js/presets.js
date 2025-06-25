// Preset configurations for different N-body scenarios
class Presets {
    static solarSystem() {
        const bodies = [];
        
        // Sun (central massive body)
        bodies.push(new Body(
            new Vector2D(0, 0),
            new Vector2D(0, 0),
            1000,
            '#ffa502',
            20
        ));
        
        // Mercury
        bodies.push(new Body(
            new Vector2D(80, 0),
            new Vector2D(0, 35),
            5,
            '#8e44ad',
            30
        ));
        
        // Venus
        bodies.push(new Body(
            new Vector2D(120, 0),
            new Vector2D(0, 30),
            8,
            '#ff6b9d',
            35
        ));
        
        // Earth
        bodies.push(new Body(
            new Vector2D(160, 0),
            new Vector2D(0, 26),
            10,
            '#2ed573',
            40
        ));
        
        // Mars
        bodies.push(new Body(
            new Vector2D(200, 0),
            new Vector2D(0, 22),
            6,
            '#ff4757',
            45
        ));
        
        // Jupiter
        bodies.push(new Body(
            new Vector2D(280, 0),
            new Vector2D(0, 16),
            100,
            '#ffa502',
            50
        ));
        
        return bodies;
    }

    static binaryStars() {
        const bodies = [];
        const separation = 100;
        const totalMass = 400;
        const mass1 = 200;
        const mass2 = 200;
        
        // Calculate orbital velocity for circular orbit
        const reducedMass = (mass1 * mass2) / (mass1 + mass2);
        const velocity = Math.sqrt(100 * totalMass / separation);
        
        // Star 1
        bodies.push(new Body(
            new Vector2D(-separation/2, 0),
            new Vector2D(0, -velocity/2),
            mass1,
            '#1e90ff',
            60
        ));
        
        // Star 2
        bodies.push(new Body(
            new Vector2D(separation/2, 0),
            new Vector2D(0, velocity/2),
            mass2,
            '#ff4757',
            60
        ));
        
        // Add some planets
        bodies.push(new Body(
            new Vector2D(0, 200),
            new Vector2D(15, 0),
            10,
            '#2ed573',
            40
        ));
        
        bodies.push(new Body(
            new Vector2D(0, -250),
            new Vector2D(-12, 0),
            8,
            '#ff6b9d',
            35
        ));
        
        return bodies;
    }

    static galaxy() {
        const bodies = [];
        const numArms = 3;
        const numBodiesPerArm = 8;
        const centralMass = 500;
        
        // Central black hole
        bodies.push(new Body(
            new Vector2D(0, 0),
            new Vector2D(0, 0),
            centralMass,
            '#000000',
            10
        ));
        
        // Spiral arms
        for (let arm = 0; arm < numArms; arm++) {
            const armAngle = (arm * 2 * Math.PI) / numArms;
            
            for (let i = 1; i <= numBodiesPerArm; i++) {
                const radius = 50 + i * 25;
                const spiralTightness = 0.3;
                const angle = armAngle + i * spiralTightness;
                
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                
                // Calculate orbital velocity
                const orbitalVelocity = Math.sqrt(100 * centralMass / radius);
                const vx = -orbitalVelocity * Math.sin(angle);
                const vy = orbitalVelocity * Math.cos(angle);
                
                // Add some randomness
                const velocityVariation = 0.8 + Math.random() * 0.4;
                const mass = 5 + Math.random() * 10;
                
                const colors = ['#64ffda', '#bb86fc', '#03dac6', '#cf6679', '#ffb74d'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                bodies.push(new Body(
                    new Vector2D(x, y),
                    new Vector2D(vx * velocityVariation, vy * velocityVariation),
                    mass,
                    color,
                    50
                ));
            }
        }
        
        return bodies;
    }

    static chaos() {
        const bodies = [];
        const numBodies = 15;
        const spawnRadius = 200;
        
        for (let i = 0; i < numBodies; i++) {
            // Random position in circle
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * spawnRadius;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            // Random velocity
            const velAngle = Math.random() * 2 * Math.PI;
            const velMagnitude = Math.random() * 30;
            const vx = velMagnitude * Math.cos(velAngle);
            const vy = velMagnitude * Math.sin(velAngle);
            
            // Random mass
            const mass = 20 + Math.random() * 60;
            
            // Random color
            const colors = [
                '#ff4757', '#2ed573', '#1e90ff', '#ffa502',
                '#ff6b9d', '#a4b0be', '#8e44ad', '#f39c12'
            ];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            bodies.push(new Body(
                new Vector2D(x, y),
                new Vector2D(vx, vy),
                mass,
                color,
                40
            ));
        }
        
        return bodies;
    }

    static earthMoon() {
        const bodies = [];
        
        // Earth
        bodies.push(new Body(
            new Vector2D(0, 0),
            new Vector2D(0, 0),
            100,
            '#2ed573',
            50
        ));
        
        // Moon
        const moonDistance = 100;
        const moonVelocity = Math.sqrt(100 * 100 / moonDistance);
        
        bodies.push(new Body(
            new Vector2D(moonDistance, 0),
            new Vector2D(0, moonVelocity),
            10,
            '#a4b0be',
            40
        ));
        
        return bodies;
    }

    static doublePendulum() {
        const bodies = [];
        
        // Create a double pendulum-like system
        // Fixed point (heavy central mass)
        bodies.push(new Body(
            new Vector2D(0, 0),
            new Vector2D(0, 0),
            1000,
            '#ffa502',
            10
        ));
        
        // First pendulum bob
        bodies.push(new Body(
            new Vector2D(100, 0),
            new Vector2D(0, 25),
            50,
            '#ff4757',
            60
        ));
        
        // Second pendulum bob
        bodies.push(new Body(
            new Vector2D(180, 0),
            new Vector2D(0, 20),
            30,
            '#2ed573',
            60
        ));
        
        return bodies;
    }

    static figure8() {
        const bodies = [];
        
        // Famous figure-8 solution to the three-body problem
        const mass = 50;
        const x = 97;
        const vx = 46.7;
        
        bodies.push(new Body(
            new Vector2D(-x, 0),
            new Vector2D(vx/2, vx * Math.sqrt(3)/2),
            mass,
            '#ff4757',
            80
        ));
        
        bodies.push(new Body(
            new Vector2D(x, 0),
            new Vector2D(vx/2, -vx * Math.sqrt(3)/2),
            mass,
            '#2ed573',
            80
        ));
        
        bodies.push(new Body(
            new Vector2D(0, 0),
            new Vector2D(-vx, 0),
            mass,
            '#1e90ff',
            80
        ));
        
        return bodies;
    }

    static lagrangePoints() {
        const bodies = [];
        
        // Two massive bodies
        const mass1 = 200;
        const mass2 = 100;
        const separation = 200;
        
        // Primary body
        bodies.push(new Body(
            new Vector2D(-separation * mass2 / (mass1 + mass2), 0),
            new Vector2D(0, 0),
            mass1,
            '#ffa502',
            30
        ));
        
        // Secondary body
        const orbitalVelocity = Math.sqrt(100 * (mass1 + mass2) / separation);
        bodies.push(new Body(
            new Vector2D(separation * mass1 / (mass1 + mass2), 0),
            new Vector2D(0, orbitalVelocity),
            mass2,
            '#ff4757',
            30
        ));
        
        // Test particles at Lagrange points
        const L4_x = separation * (0.5 - mass2 / (mass1 + mass2));
        const L4_y = separation * Math.sqrt(3) / 2;
        
        bodies.push(new Body(
            new Vector2D(L4_x, L4_y),
            new Vector2D(-orbitalVelocity * Math.sqrt(3) / 2, orbitalVelocity / 2),
            1,
            '#2ed573',
            40
        ));
        
        bodies.push(new Body(
            new Vector2D(L4_x, -L4_y),
            new Vector2D(orbitalVelocity * Math.sqrt(3) / 2, orbitalVelocity / 2),
            1,
            '#1e90ff',
            40
        ));
        
        return bodies;
    }

    static getPreset(name) {
        switch (name) {
            case 'solar-system':
                return this.solarSystem();
            case 'binary-stars':
                return this.binaryStars();
            case 'galaxy':
                return this.galaxy();
            case 'chaos':
                return this.chaos();
            case 'earth-moon':
                return this.earthMoon();
            case 'double-pendulum':
                return this.doublePendulum();
            case 'figure-8':
                return this.figure8();
            case 'lagrange-points':
                return this.lagrangePoints();
            default:
                return [];
        }
    }

    static getAllPresets() {
        return [
            { id: 'solar-system', name: 'Solar System', description: 'A simplified solar system with planets orbiting the sun' },
            { id: 'binary-stars', name: 'Binary Stars', description: 'Two stars orbiting around their common center of mass' },
            { id: 'galaxy', name: 'Galaxy', description: 'A spiral galaxy with a central black hole' },
            { id: 'chaos', name: 'Chaos', description: 'Random bodies with chaotic interactions' },
            { id: 'earth-moon', name: 'Earth-Moon', description: 'Earth and Moon system' },
            { id: 'double-pendulum', name: 'Double Pendulum', description: 'A chaotic double pendulum system' },
            { id: 'figure-8', name: 'Figure-8', description: 'Famous three-body figure-8 orbit' },
            { id: 'lagrange-points', name: 'Lagrange Points', description: 'Demonstration of L4 and L5 Lagrange points' }
        ];
    }

    // Create a random system with given parameters
    static createRandom(numBodies, maxMass = 100, spawnRadius = 300, maxVelocity = 50) {
        const bodies = [];
        
        for (let i = 0; i < numBodies; i++) {
            // Random position
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * spawnRadius;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            // Random velocity
            const velAngle = Math.random() * 2 * Math.PI;
            const velMagnitude = Math.random() * maxVelocity;
            const vx = velMagnitude * Math.cos(velAngle);
            const vy = velMagnitude * Math.sin(velAngle);
            
            // Random mass
            const mass = 10 + Math.random() * maxMass;
            
            // Random color
            const colors = [
                '#ff4757', '#2ed573', '#1e90ff', '#ffa502',
                '#ff6b9d', '#a4b0be', '#8e44ad', '#f39c12'
            ];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            bodies.push(new Body(
                new Vector2D(x, y),
                new Vector2D(vx, vy),
                mass,
                color,
                30 + Math.random() * 40
            ));
        }
        
        return bodies;
    }

    // Create a stable orbital system
    static createStableOrbital(numBodies, centralMass = 500) {
        const bodies = [];
        
        // Central body
        bodies.push(new Body(
            new Vector2D(0, 0),
            new Vector2D(0, 0),
            centralMass,
            '#ffa502',
            20
        ));
        
        // Orbiting bodies
        for (let i = 1; i < numBodies; i++) {
            const radius = 80 + i * 40;
            const angle = (i / numBodies) * 2 * Math.PI + Math.random() * 0.5;
            
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            // Calculate circular orbital velocity
            const orbitalVelocity = Math.sqrt(100 * centralMass / radius);
            const vx = -orbitalVelocity * Math.sin(angle);
            const vy = orbitalVelocity * Math.cos(angle);
            
            // Add small random variation
            const variation = 0.9 + Math.random() * 0.2;
            const mass = 5 + Math.random() * 15;
            
            const colors = ['#ff4757', '#2ed573', '#1e90ff', '#ff6b9d', '#8e44ad'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            bodies.push(new Body(
                new Vector2D(x, y),
                new Vector2D(vx * variation, vy * variation),
                mass,
                color,
                40
            ));
        }
        
        return bodies;
    }
}
