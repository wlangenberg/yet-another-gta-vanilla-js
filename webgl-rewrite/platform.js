
import {BaseEntity} from "./BaseEntity.js"

class Platform extends BaseEntity {
	constructor(x, y, width, height) {
		// Platform width: 100, height: 50, color: green
		super(x, y, width, height, [0.0, 1.0, 0.0, 1.0])
	}

    update(deltaTime, allEntites) {
		// super.update(deltaTime, allEntites)
        // super.render()
    }
}

export default Platform
