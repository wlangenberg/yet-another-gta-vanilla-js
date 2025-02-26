import { BaseEntity } from "../core/BaseEntity.js";
import CollisionCore from "../../systems/CollisionCore.js";
import socket from "../../systems/sockets.js";
import { STATE } from "../../configuration/constants.js";

class Fragment extends BaseEntity {
	constructor(canvas, gl, { x, y, width, height, color }) {
		super(x, y, width, height, color, canvas);
		this.lifetime = 5.0; // Lifetime in seconds before the fragment is considered destroyed.
        this.enableLife = false;
		this.destroyed = false;
		this.isFragment = true;
		this.originalEntityId = 0; // ID of the entity this fragment came from
		this.gl = gl;
		this.type = 'fragment';
		this.renderLayer = 1; // Ensure fragments are visible
	}

	update(deltaTime, allEntities, spatialGrid) {
        super.update(deltaTime, allEntities, spatialGrid);
        
        // Decrease lifetime and mark as destroyed when expired.
		if (this.enableLife) {
			this.lifetime -= deltaTime;
			if (this.lifetime <= 0) {
				this.destroyed = true;
				
				// If this is a fragment created by the local player, notify the server about destruction
				if (STATE.myPlayer && this.id) {
					// Send fragment destruction message
					socket.sendFragmentDestroy(this.id);
				}
			}
		}
        
        // If the fragment goes too far off-screen, mark it as destroyed
        const camera = window.camera;
        if (camera) {
            const offscreenMargin = 1000; // How far off-screen before destroying
            if (this.x < camera.x - offscreenMargin || 
                this.x > camera.x + camera.viewportWidth + offscreenMargin ||
                this.y < camera.y - offscreenMargin || 
                this.y > camera.y + camera.viewportHeight + offscreenMargin) {
                this.destroyed = true;
                
                // If this is a fragment created by the local player, notify the server about destruction
                if (STATE.myPlayer && this.id) {
                    // Send fragment destruction message
                    socket.sendFragmentDestroy(this.id);
                }
            }
        }
	}
}

export default Fragment;
