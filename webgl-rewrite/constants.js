const canvas = document.getElementById('gameCanvas')
let ctx = canvas.getContext('webgl')
const allEntities = []

if (!ctx) {
    console.error('WebGL not supported, falling back on experimental-webgl')
    gl = canvas.getContext('experimental-webgl')
}

if (!ctx) {
    alert('Your browser does not support WebGL')
}

canvas.width = 2000
canvas.height = 1900
ctx.clearColor(0.86, 0.86, 0.86, 1.0)
ctx.viewport(0, 0, canvas.width, canvas.height)

// Set up keyboard input
const keys = {}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gravity = 2480;
// const keys = [];

export { keys, gravity, canvas, ctx, allEntities };
