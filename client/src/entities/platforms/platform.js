
import {BaseEntity} from "../core/BaseEntity.js"

class Platform extends BaseEntity {
	constructor(x, y, width, height, color, canvas, type, layer) {
		// Platform width: 100, height: 50, color: green
		super(x, y, width, height, color ?? [0.0, 1.0, 0.0, 1.0], canvas, type, layer)
		this.isGround = true
		this.hasGravity = false
		this.hasCollision = layer === 0 ? false : true
	}

    update(deltaTime, allEntites, spatialGrid) {
		super.update(deltaTime, allEntites, spatialGrid)
    }
}

export default Platform
