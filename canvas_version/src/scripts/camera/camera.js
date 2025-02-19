class Camera {
  constructor(player, canvas, options = {}) {
      this.player = player;
      this.canvas = canvas;

      // Camera settings
      this.smoothness = options.smoothness || 0.1;
      this.minZoom = options.minZoom || 1;
      this.maxZoom = options.maxZoom || 2;
      this.zoom = options.zoom || 1;
 
      // Viewport dimensions
      this.viewportWidth = canvas.width / this.zoom;
      this.viewportHeight = canvas.height / this.zoom;
      // Camera position
      this.x = options.x - this.viewportWidth / 2;
      this.y = options.y - this.viewportHeight / 2;
      this.targetX = 0;
      this.targetY = this.y;
      
      // Thresholds
      this.lowerThresholdY = this.viewportHeight * (5 / 6);  // Bottom 5/6 of the screen
      this.upperThresholdY = this.viewportHeight * (1 / 6);  // Top 1/6 of the screen
  }

  update() {
      // Center camera horizontally on player
      this.targetX = this.player.x - this.viewportWidth / 2;

      // Follow the player downward if they go below the lower threshold
      if (this.player.y > this.y + this.lowerThresholdY) {
          this.targetY = this.player.y - this.lowerThresholdY;
      }
      // Follow the player upward if they move near the top of the camera
      else if (this.player.y < this.y + this.upperThresholdY) {
          this.targetY = this.player.y - this.upperThresholdY;
      }

      // Smooth camera movement using easing
      const easeFactor = 1 - Math.pow(1 - this.smoothness, 2);
      this.x += (this.targetX - this.x) * easeFactor;
      this.y += (this.targetY - this.y) * easeFactor;
  }

  setZoom(zoom) {
      this.zoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
      this.viewportWidth = this.canvas.width / this.zoom;
      this.viewportHeight = this.canvas.height / this.zoom;
      this.lowerThresholdY = this.viewportHeight * (5 / 6);
      this.upperThresholdY = this.viewportHeight * (1 / 6);
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
