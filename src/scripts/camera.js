class Camera {
  constructor(player, canvas, options = {}) {
    this.player = player;
    this.canvas = canvas;

    // Camera settings with defaults
    this.smoothness = options.smoothness || 0.1;
    this.minZoom = options.minZoom || 1;
    this.maxZoom = options.maxZoom || 2;
    this.zoom = options.zoom || 1;
    this.latency = options.latency || 0; // New latency property

    // Camera position and target
    this.x = 0;
    this.y = options.worldHeight;
    this.targetX = 0;
    this.targetY = 0;

    // Viewport dimensions
    this.viewportWidth = canvas.width / this.zoom;
    this.viewportHeight = canvas.height / this.zoom;

    // Default Y position
    this.defaultY = this.y;
  }

  update(dt) {
    // Calculate target position centered on player with latency
    this.targetX = this.player.x - this.viewportWidth / 2;
    
    const thresholdY = this.canvas.height * (1/4);
    if (this.player.y < thresholdY || this.player.y > this.defaultY + this.canvas.height - thresholdY) {
      this.targetY = this.player.y - this.viewportHeight / 2;
    } else {
      this.targetY = this.defaultY - this.canvas.height;
    }

    // Smoothly interpolate to target position
    this.x += (this.targetX - this.x) * this.smoothness;
    this.y += (this.targetY - this.y) * this.smoothness;
  }

  setZoom(zoom) {
    this.zoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
    // Update viewport dimensions based on new zoom level
    this.viewportWidth = this.canvas.width / this.zoom;
    this.viewportHeight = this.canvas.height / this.zoom;
  }

  getTransform() {
    return {
      x: -this.x * this.zoom,
      y: -this.y * this.zoom,
      scale: this.zoom
    };
  }
}

export default Camera;
