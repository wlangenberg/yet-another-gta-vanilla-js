import Player from './player.js'
import Platform from './platform.js'
import {keys, ctx as gl, allEntities, canvas } from './constants.js'
import Camera from './camera.js';

window.addEventListener('keydown', e => {
    keys[e.code] = true
})
window.addEventListener('keyup', e => {
    keys[e.code] = false
})

const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;

// Create the player and platforms
const myplayer = new Player(canvas, gl)
const platforms = [
    // new Platform(300, 500),
    new Platform(600, 400, 1700, 20),
    new Platform(700, 350, 110, 110),
    // new Platform(900, 500)
]

platforms.forEach(platform => platform.init(gl))
allEntities.push(myplayer)
allEntities.push(...platforms)

const camera = new Camera(myplayer, canvas, {
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    smoothness: 0.02,
    minZoom: 1,
    maxZoom: 2,
    zoom: 1
})

const resizeCanvas = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    gl.viewport(0, 0, canvas.width, canvas.height)
}
    
window.addEventListener('resize', resizeCanvas)
resizeCanvas()

let lastTime = performance.now()
function gameLoop() {
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastTime) / 1000
    lastTime = currentTime

    requestAnimationFrame(gameLoop)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update the camera (it uses the player's position)
    camera.update()
    // Get the combined view-projection matrix from the camera
    const viewProjectionMatrix = camera.getViewMatrix()

    // Update all entities
    allEntities.forEach(entity => {
        if (entity.update) {
            entity.update(deltaTime, allEntities)
        }
    })

    // Render all entities using the view-projection matrix
    allEntities.forEach(entity => {
        if (entity.render) {
            entity.render(viewProjectionMatrix)
        }
    })
}

gameLoop()