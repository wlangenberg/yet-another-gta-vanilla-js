
import {BaseEntity} from "../core/BaseEntity.js"

class Platform extends BaseEntity {
	constructor(x, y, width, height, color, canvas, type) {
		// Platform width: 100, height: 50, color: green
		super(x, y, width, height, color ?? [0.0, 1.0, 0.0, 1.0], canvas, type)
		this.isGround = true
	}

    update(deltaTime, allEntites, spatialGrid) {
		super.update(deltaTime, allEntites, spatialGrid)
    }
}

export default Platform
