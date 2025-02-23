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

const keys = {}

const gravity = 2480;
const DAY_LENGTH = 240
const SUN_NIGHT_THRESHOLD = 2000

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const STATE = {
    myPlayer: null,
}

const LAYERS = {
    BACKGROUND: 0,
    WORLD: 1,
    PLAYER: 2,
    FOREGROUND: 3
};

export { keys, gravity, canvas, ctx, allEntities, DAY_LENGTH, SUN_NIGHT_THRESHOLD, STATE, LAYERS };
