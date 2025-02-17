import Snow from "./SnowParticle.js";
class SnowSystem {
    constructor(canvas, gl, worldWidth) {
        this.canvas = canvas;
        this.gl = gl;
        this.worldWidth = worldWidth;
        this.particles = [];
        this.maxParticles = 500;
        this.spawnRate = 50; // Particles per second
        this.lastSpawnTime = 0;
        this.active = true;
    }

    spawnParticle() {
        if (this.particles.length >= this.maxParticles) return;

        const size = 2 + Math.random() * 4; // Random size between 2 and 6
        const x = Math.random() * this.worldWidth;
        const snow = new Snow(x, -210, size, this.canvas); // Spawn above screen
        snow.init(this.gl);
        this.particles.push(snow);
        return snow;
    }

    update(interval, allEntities, spatialGrid) {
        if (!this.active) return;

        // Remove inactive particles
        this.particles = this.particles.filter(particle => particle.active);

        // Spawn new particles based on rate
        const currentTime = performance.now();
        const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
        const particlesToSpawn = Math.floor((timeSinceLastSpawn / 1000) * this.spawnRate);

        if (particlesToSpawn > 0) {
            for (let i = 0; i < particlesToSpawn; i++) {
                const snow = this.spawnParticle();
                if (snow) {
                    allEntities.push(snow);
                }
            }
            this.lastSpawnTime = currentTime;
        }

        // Update remaining particles
        this.particles.forEach(particle => {
            particle.update(interval, allEntities, spatialGrid);
        });
    }

    setIntensity(rate) {
        this.spawnRate = Math.max(0, Math.min(200, rate));
    }

    toggle() {
        this.active = !this.active;
    }
}

export default SnowSystem;