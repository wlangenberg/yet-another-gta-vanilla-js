class EntityBatchRenderer {
    constructor(gl) {
        this.gl = gl;
        this.useWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext);
        if (!this.useWebGL2) {
            this.instancingExt = gl.getExtension('ANGLE_instanced_arrays');
            if (!this.instancingExt) {
                throw new Error("Instancing not supported in this browser");
            }
        }
        this.instances = [];
        // Create a vertex buffer for a unit quad.
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -0.5, -0.5,
                 0.5, -0.5,
                 0.5,  0.5,
                -0.5,  0.5
            ]),
            gl.STATIC_DRAW
        );
        // Create an instance buffer for per-instance data.
        this.instanceBuffer = gl.createBuffer();
        // Initialize shader program.
        this.program = this.initShaderProgram(gl);
    }

    initShaderProgram(gl) {
        let vsSource, fsSource;
        if (this.useWebGL2) {
            vsSource = `#version 300 es
            in vec2 aPosition;
            in mat4 aInstanceMatrix;
            in vec4 aInstanceColor;
            uniform mat4 uViewProjectionMatrix;
            out vec4 vColor;
            out vec2 vTexCoord;
            void main() {
                vec4 worldPos = aInstanceMatrix * vec4(aPosition, 0.0, 1.0);
                gl_Position = uViewProjectionMatrix * worldPos;
                vColor = aInstanceColor;
                // Convert vertex positions (range -0.5 to 0.5) to texture coordinates (0.0 to 1.0)
                vTexCoord = aPosition + vec2(0.5, 0.5);
            }`;
            fsSource = `#version 300 es
            precision mediump float;
            in vec4 vColor;
            in vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform bool uUseTexture;
            out vec4 fragColor;
            void main() {
                if(uUseTexture) {
                    vec4 texColor = texture(uSampler, vTexCoord);
                    if(texColor.a < 0.1) discard;
                    fragColor = texColor * vColor;
                } else {
                    fragColor = vColor;
                }
            }`;
        } else {
            // For WebGL1 with ANGLE_instanced_arrays.
            vsSource = `
            attribute vec2 aPosition;
            attribute vec4 aInstanceMatrix0;
            attribute vec4 aInstanceMatrix1;
            attribute vec4 aInstanceMatrix2;
            attribute vec4 aInstanceMatrix3;
            attribute vec4 aInstanceColor;
            uniform mat4 uViewProjectionMatrix;
            varying vec4 vColor;
            varying vec2 vTexCoord;
            void main() {
                mat4 aInstanceMatrix = mat4(aInstanceMatrix0, aInstanceMatrix1, aInstanceMatrix2, aInstanceMatrix3);
                vec4 worldPos = aInstanceMatrix * vec4(aPosition, 0.0, 1.0);
                gl_Position = uViewProjectionMatrix * worldPos;
                vColor = aInstanceColor;
                vTexCoord = aPosition + vec2(0.5, 0.5);
            }`;
            fsSource = `
            precision mediump float;
            varying vec4 vColor;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform bool uUseTexture;
            void main() {
                if(uUseTexture) {
                    vec4 texColor = texture2D(uSampler, vTexCoord);
                    if(texColor.a < 0.1) discard;
                    gl_FragColor = texColor * vColor;
                } else {
                    gl_FragColor = vColor;
                }
            }`;
        }
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error('Shader program initialization failed:', gl.getProgramInfoLog(shaderProgram));
            return null;
        }
        return shaderProgram;
    }

    loadShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Begin a new batch.
    begin() {
        this.instances = [];
    }

    // Submit an entity. This now checks for an animation texture.
    submit(entity) {
        const transform = mat4.create();
    
        // Determine vertical offset (if the entity has a 'name', we add an offset like in BaseEntity.render)
        const offsetY = entity.name ? 10 : 0;
    
        // Calculate translation: position at the center of the hitbox (with offset if applicable)
        const tx = entity.x + entity.halfWidth;
        const ty = entity.y + entity.halfHeight + offsetY;
        mat4.translate(transform, transform, [tx, ty, 0]);
    
        // Start with visual dimensions (which incorporate scale, set via setScale)
        let scaleX = entity.visualWidth;
        let scaleY = entity.visualHeight;
    
        // Adjust scaling based on the current animation (if any)
        if (entity.animationController) {
            const currentAnimation = entity.animationController.animations.get(entity.animationController.currentAnimation);
            const currentFrame = entity.animationController.getCurrentFrame();
            if (currentFrame && currentAnimation && currentFrame.width && currentFrame.height) {
                const textureAspectRatio = currentFrame.width / currentFrame.height;
                const entityAspectRatio = entity.visualWidth / entity.visualHeight;
    
                // Adjust scaling to maintain the texture's aspect ratio
                if (textureAspectRatio > entityAspectRatio) {
                    // Texture is wider than the entity, scale height to match.
                    scaleY = entity.visualWidth / textureAspectRatio;
                } else {
                    // Texture is taller than the entity, scale width to match.
                    scaleX = entity.visualHeight * textureAspectRatio;
                }
                // Apply flipping if needed.
                if (currentAnimation.flipped) {
                    scaleX = -scaleX;
                }
            }
        }
    
        // Apply the calculated scaling to the transform matrix.
        mat4.scale(transform, transform, [scaleX, scaleY, 1]);
    
        // Get the current texture if using animations.
        let texture = null;
        if (entity.animationController) {
            texture = entity.animationController.getCurrentTexture();
        }
    
        // Store the computed transform matrix along with the entity's color and texture.
        this.instances.push({
            matrix: transform,
            color: entity.color, // Expected to be a Float32Array with 4 elements.
            texture: texture
        });
    }
    

    // Flush all submitted instances by grouping those that use textures from those that do not.
    flush(viewProjectionMatrix) {
        // Group instances into textured and non-textured.
        const texturedInstances = this.instances.filter(inst => inst.texture);
        const nonTexturedInstances = this.instances.filter(inst => !inst.texture);
        
        if (texturedInstances.length > 0) {
            // Here we assume for simplicity that all textured instances use the same texture.
            // For multiple textures, you would group further by texture.
            this.drawInstances(viewProjectionMatrix, texturedInstances, true, texturedInstances[0].texture);
        }
        if (nonTexturedInstances.length > 0) {
            this.drawInstances(viewProjectionMatrix, nonTexturedInstances, false, null);
        }
    }

    // Helper function to draw a set of instances.
    drawInstances(viewProjectionMatrix, instances, useTexture, texture) {
        const gl = this.gl;
        gl.useProgram(this.program);

        // Bind the quad vertex buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        const posLoc = gl.getAttribLocation(this.program, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const numInstances = instances.length;
        // Each instance uses 20 floats: 16 for the matrix and 4 for the color.
        const instanceData = new Float32Array(numInstances * 20);
        for (let i = 0; i < numInstances; i++) {
            instanceData.set(instances[i].matrix, i * 20);
            instanceData.set(instances[i].color, i * 20 + 16);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

        const stride = 20 * 4; // 20 floats per instance * 4 bytes per float.

        if (this.useWebGL2) {
            const matrixLoc = gl.getAttribLocation(this.program, 'aInstanceMatrix');
            for (let i = 0; i < 4; i++) {
                const loc = matrixLoc + i;
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, i * 16);
                gl.vertexAttribDivisor(loc, 1);
            }
            const colorLoc = gl.getAttribLocation(this.program, 'aInstanceColor');
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 16 * 4);
            gl.vertexAttribDivisor(colorLoc, 1);
            // Set uniforms.
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uViewProjectionMatrix'), false, viewProjectionMatrix);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uUseTexture'), useTexture ? 1 : 0);
            if (useTexture && texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(gl.getUniformLocation(this.program, 'uSampler'), 0);
            }
            gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, numInstances);
            // Reset divisors.
            for (let i = 0; i < 4; i++) {
                gl.vertexAttribDivisor(matrixLoc + i, 0);
            }
            gl.vertexAttribDivisor(colorLoc, 0);
        } else {
            // WebGL1 with ANGLE_instanced_arrays.
            const ext = this.instancingExt;
            const matrixLoc0 = gl.getAttribLocation(this.program, 'aInstanceMatrix0');
            const matrixLoc1 = gl.getAttribLocation(this.program, 'aInstanceMatrix1');
            const matrixLoc2 = gl.getAttribLocation(this.program, 'aInstanceMatrix2');
            const matrixLoc3 = gl.getAttribLocation(this.program, 'aInstanceMatrix3');
            ext.vertexAttribDivisorANGLE(matrixLoc0, 1);
            ext.vertexAttribDivisorANGLE(matrixLoc1, 1);
            ext.vertexAttribDivisorANGLE(matrixLoc2, 1);
            ext.vertexAttribDivisorANGLE(matrixLoc3, 1);
            const colorLoc = gl.getAttribLocation(this.program, 'aInstanceColor');
            ext.vertexAttribDivisorANGLE(colorLoc, 1);
            // Set up the attributes.
            gl.vertexAttribPointer(matrixLoc0, 4, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(matrixLoc0);
            gl.vertexAttribPointer(matrixLoc1, 4, gl.FLOAT, false, stride, 16);
            gl.enableVertexAttribArray(matrixLoc1);
            gl.vertexAttribPointer(matrixLoc2, 4, gl.FLOAT, false, stride, 32);
            gl.enableVertexAttribArray(matrixLoc2);
            gl.vertexAttribPointer(matrixLoc3, 4, gl.FLOAT, false, stride, 48);
            gl.enableVertexAttribArray(matrixLoc3);
            gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 64);
            gl.enableVertexAttribArray(colorLoc);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uViewProjectionMatrix'), false, viewProjectionMatrix);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uUseTexture'), useTexture ? 1 : 0);
            if (useTexture && texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(gl.getUniformLocation(this.program, 'uSampler'), 0);
            }
            ext.drawArraysInstancedANGLE(gl.TRIANGLE_FAN, 0, 4, numInstances);
            // Reset divisors.
            ext.vertexAttribDivisorANGLE(matrixLoc0, 0);
            ext.vertexAttribDivisorANGLE(matrixLoc1, 0);
            ext.vertexAttribDivisorANGLE(matrixLoc2, 0);
            ext.vertexAttribDivisorANGLE(matrixLoc3, 0);
            ext.vertexAttribDivisorANGLE(colorLoc, 0);
        }
    }
}

export default EntityBatchRenderer;
