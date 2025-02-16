const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('webgl', {
    stencil: true,
    depth: true,
    alpha: true  // Ensure alpha is enabled
});
const allEntities = []
if (!ctx) {
    console.error('WebGL not supported, falling back on experimental-webgl')
    ctx = canvas.getContext('experimental-webgl', { depth: true })
}

if (!ctx) {
    alert('Your browser does not support WebGL')
}
canvas.width = 2000
canvas.height = 1900
// ctx.clearColor(0.86, 0.86, 0.86, 1.0)
ctx.viewport(0, 0, canvas.width, canvas.height)

// Set up keyboard input
const keys = {}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gravity = 2480;
// const keys = [];
const DAY_LENGTH = 240000
const SUN_NIGHT_THRESHOLD = 300
const DAY_START_HOUR = 5
const SUN_HEIGHT = 1600


export { keys, gravity, canvas, ctx, allEntities, DAY_LENGTH, SUN_NIGHT_THRESHOLD, DAY_START_HOUR, SUN_HEIGHT };
