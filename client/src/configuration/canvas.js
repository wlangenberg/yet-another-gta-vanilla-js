const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('webgl', {
    stencil: true,
    depth: true,
    alpha: true  // Ensure alpha is enabled
});
if (!ctx) {
    console.error('WebGL not supported, falling back on experimental-webgl')
    ctx = canvas.getContext('experimental-webgl', { depth: true })
}

if (!ctx) {
    alert('Your browser does not support WebGL')
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export { canvas, ctx, };