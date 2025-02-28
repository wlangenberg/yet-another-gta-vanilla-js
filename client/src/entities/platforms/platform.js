
import {BaseEntity} from "../core/BaseEntity.js"

class Platform extends BaseEntity {
	constructor({x, y, width, height, color, type, layer, id}) {
		// Platform width: 100, height: 50, color: green
		super({id, x, y, width, height, color: color ?? [0.0, 1.0, 0.0, 1.0], type, layer})
		this.isGround = true
		this.hasGravity = false
		this.hasCollision = layer === 0 ? false : true
	}

    update(deltaTime, allEntites, spatialGrid) {
		super.update(deltaTime, allEntites, spatialGrid)
    }
}

export default Platform
