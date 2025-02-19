import { BaseEntity } from "./BaseEntity.js";
import CollisionCore from "./CollisionCore.js";

class Fragment extends BaseEntity {
	constructor(canvas, gl, { x, y, width, height, color }) {
		super(x, y, width, height, color, canvas);
		this.lifetime = 5.0; // Lifetime in seconds before the fragment is considered destroyed.
        this.enableLife = false
		this.destroyed = false;
	}

	update(deltaTime, allEntities, spatialGrid) {
        super.update(deltaTime, allEntities, spatialGrid)
        		// Decrease lifetime and mark as destroyed when expired.
		if (this.enableLife) this.lifetime -= deltaTime;
		if (this.lifetime <= 0 && this.enableLife) {
			this.destroyed = true;
		}
        return
	}
}

export default Fragment;
