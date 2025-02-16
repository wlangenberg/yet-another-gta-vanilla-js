
class Camera {
    constructor(player, canvas, options = {}) {
        this.player = player
        this.canvas = canvas
        this.smoothness = options.smoothness || 0.1
        this.minZoom = options.minZoom || 1
        this.maxZoom = options.maxZoom || 2
        this.zoom = options.zoom || 1
        
        this.viewportWidth = canvas.width / this.zoom;
        this.viewportHeight = canvas.height / this.zoom;
        // World dimensions are in pixels


        // Start with camera at (0,0) if not provided
        this.x = options.x - this.viewportWidth / 2;
        this.y = options.y - this.viewportHeight / 2;
        this.targetX = this.x
        this.targetY = this.y

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

    // Build and return the combined view-projection matrix
    getViewMatrix() {
        // Create an orthographic projection matrix in pixel space
        const projectionMatrix = mat4.create()
        // left, right, bottom, top, near, far
        mat4.ortho(
            projectionMatrix,
            0,
            this.canvas.width,
            this.canvas.height,
            0,
            -1,
            1
        )

        // Build view matrix: translate by negative camera position and apply zoom
        const viewMatrix = mat4.create()
        // First, scale (zoom)
        mat4.scale(viewMatrix, viewMatrix, vec3.fromValues(this.zoom, this.zoom, 1))
        // Then, translate (note the minus sign because we move the world opposite to the camera)
        mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(-this.x, -this.y, 0))
        
        // Combine projection and view matrices
        const viewProjectionMatrix = mat4.create()
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix)
        return viewProjectionMatrix
    }
}

export default Camera