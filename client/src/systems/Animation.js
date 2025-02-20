export class Animation {
    constructor(gl, frames, frameTime = 0.1) {
        this.gl = gl;
        this.frames = [];
        this.currentFrame = 0;
        this.frameTime = frameTime;
        this.accumulator = 0;
        this.textureLoaded = 0;
        this.totalFrames = frames.length;
        this.flipped = false; // Track flip state
    }
    loadFrames(frames) {
        return Promise.all(frames.map((framePath, index) => {
            return new Promise((resolve, reject) => {
                const texture = this.gl.createTexture();
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    
                // Set temporary single pixel data while image loads
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, 
                    new Uint8Array([0, 0, 0, 255]));
    
                const image = new Image();
                image.onload = () => {
                    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
                    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    
                    this.frames[index] = {
                        texture,
                        width: image.width,
                        height: image.height
                    };
                    this.textureLoaded++;
                    resolve(this.frames[index]);
                };
    
                image.onerror = () => {
                    console.error(`Failed to load texture: ${framePath}`);
                    reject(new Error(`Failed to load texture: ${framePath}`));
                };
    
                image.src = framePath;
                this.frames[index] = { texture, width: 0, height: 0 };
            });
        }));
    }
        
    update(deltaTime) {
        if (!this.isLoaded()) {
            return;
        }
        this.accumulator += deltaTime;
        if (this.accumulator >= this.frameTime) {
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
            this.accumulator -= this.frameTime;
        }
    }

    getCurrentTexture() {
        if (!this.isLoaded()) {
            return null;
        }
        return this.frames[this.currentFrame].texture;
    }

    getCurrentFrame() {
        if (!this.isLoaded()) {
            return null;
        }
        return this.frames[this.currentFrame];
    }

    setFlipped(flipped) {
        this.flipped = flipped;
    }

    isLoaded() {
        return this.textureLoaded === this.totalFrames;
    }
}

// AnimationController.js
export class AnimationController {
    constructor() {
        this.animations = new Map();
        this.currentAnimation = null;
        this.flipped = false;
    }

    addAnimation(name, animation) {
        this.animations.set(name, animation);
        if (!this.currentAnimation) {
            this.currentAnimation = name;
        }
    }

    play(name) {
        if (this.currentAnimation !== name && this.animations.has(name)) {
            this.currentAnimation = name;
        }
    }

    setFlipped(flipped) {
        this.flipped = flipped;
        // Update all animations' flip state
        for (const animation of this.animations.values()) {
            animation.setFlipped(flipped);
        }
    }

    update(deltaTime) {
        if (this.currentAnimation) {
            const animation = this.animations.get(this.currentAnimation);
            if (animation) {
                animation.update(deltaTime);
            }
        }
    }

    getCurrentTexture() {
        if (this.currentAnimation) {
            const animation = this.animations.get(this.currentAnimation);
            if (animation) {
                return animation.getCurrentTexture();
            }
        }
        return null;
    }

    getCurrentFrame() {
        if (this.currentAnimation) {
            const animation = this.animations.get(this.currentAnimation);
            if (animation) {
                return animation.getCurrentFrame();
            }
        }
        return null;
    }
}