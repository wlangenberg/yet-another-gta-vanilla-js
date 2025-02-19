import { DAY_LENGTH } from './constants.js'

class DayNightCycle {
    constructor(sun, skyGradient, speed = 1, currentTime = 11, circleCenterY = 360) {
        this.sun = sun
        this.skyGradient = skyGradient
        this.speed = speed
        this.currentTime = currentTime // Time of day (0-24)
        this.circleCenterY = circleCenterY // Center Y position of the sun’s circular motion

        this.distanceRadius = 2500 // X-axis movement range
        this.heightRadius = 2000 // Y-axis movement range
        this.startX = 0 // Center X position of the circular path

        this.lastUpdateTime = null // Store the last timestamp for smooth updates
    }

    update(deltaTime) {
        if (this.lastUpdateTime === null) {
            this.lastUpdateTime = deltaTime
            return
        }

        // Calculate elapsed time since last frame
        const elapsed = (deltaTime - this.lastUpdateTime) / 1000 // Convert to seconds
        this.lastUpdateTime = deltaTime

        // Increment time based on speed, ensuring it wraps around 24 hours
        this.currentTime = (this.currentTime + (elapsed * this.speed * 24) / DAY_LENGTH) % 24

        const dayFraction = this.calculateDayFraction()
        const x = this.calculateSunX(dayFraction)
        const y = this.calculateSunY(dayFraction)
        this.sun.setPosition(x, y)
    }

    calculateSunX(dayFraction) {
        return this.startX + Math.sin(2 * Math.PI * dayFraction) * this.distanceRadius
    }

    calculateSunY(dayFraction) {
        return this.circleCenterY + Math.cos(2 * Math.PI * dayFraction) * this.heightRadius
    }

    calculateDayFraction() {
        return this.currentTime / 24
    }
}

export default DayNightCycle
