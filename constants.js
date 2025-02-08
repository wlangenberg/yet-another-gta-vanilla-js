const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gravity = 0.15;
const keys = [];

export { keys, gravity, canvas, ctx };
