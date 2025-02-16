import { SUN_NIGHT_THRESHOLD, DAY_LENGTH, SUN_HEIGHT, DAY_START_HOUR } from './constants.js'

class DayNightCycle {
    constructor(sun, skyGradient, speed = 1) {
        this.sun = sun
        this.skyGradient = skyGradient
        this.speed = speed
    }

    update(time) {
        const y = this.calculateSunY(time)
        this.sun.setPosition(0, y)
    }

    calculateSunY(time) {
        const scaledTime = (time * this.speed) % DAY_LENGTH
        const dayFraction = scaledTime / DAY_LENGTH
        const hours = dayFraction * 24

        // Adjust to start at DAY_START_HOUR instead of a hardcoded 6 AM
        return -SUN_HEIGHT + (1 + Math.sin(2 * Math.PI * ((hours - DAY_START_HOUR) / 24))) * SUN_HEIGHT
    }
}

export default DayNightCycle
