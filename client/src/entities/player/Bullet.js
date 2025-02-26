import { BaseEntity } from "../core/BaseEntity.js";
import Fragment from "../fragments/Fragment.js";
import Platform from "../platforms/platform.js";
import socket from "../../systems/sockets.js";
import { STATE } from "../../configuration/constants.js";

class Bullet extends BaseEntity {
  constructor(canvas, gl, { x, y, rotation, speed = 800, damage = 10, lifetime = 2 } = {}) {
    // Set a small hitbox for the bullet (e.g., 10x5) and a red color.
    super(x, y, 10, 5, [1.0, 0.0, 0.0, 1.0], canvas);
    this.gl = gl;
    this.rotation = rotation;
    this.damage = damage;
    this.speed = speed;
    this.lifetime = lifetime; // Lifetime in seconds
    this.hasGravity = false;
    this.hasCollision = true;
    this.sleeping = false;
    this.type = 'bullet';
    this.friction = 1;
    this.airFriction = 0.99;
    this.ownerId = null; // ID of the player who fired this bullet
    
    // Calculate velocity based on rotation.
    this.velocity.x = Math.cos(rotation) * speed;
    this.velocity.y = Math.sin(rotation) * speed;
  }

  update(deltaTime, allEntities, spatialGrid) {
    // Update bullet position using its velocity.
    this.x += this.velocity.x * deltaTime;
    this.y += this.velocity.y * deltaTime;
    
    // Decrease lifetime and remove bullet when expired.
    this.lifetime -= deltaTime;
    if (this.lifetime <= 0) {
      this.deleteSelf(allEntities)
      return; // Stop further updates.
    }
    
    // Call parent update to handle collisions, etc.
    super.update(deltaTime, allEntities, spatialGrid);
  }

  onCollision(hitEntity, allEntities) {
    // Skip collision with the owner of the bullet
    if (hitEntity.id === this.ownerId) {
      return;
    }
    
    // Apply damage to the hit entity if it has health
    if (hitEntity.health !== undefined && !hitEntity.isDead && !hitEntity.invulnerable) {
      // Apply damage locally
      hitEntity.takeDamage(this.damage, this);
      
      // If this is a bullet from the local player, report the hit to the server
      if (STATE.myPlayer && this.ownerId === STATE.myPlayer.id) {
        socket.sendHitReport(hitEntity.id, this.damage);
      }
    }
    
  // If the hit entity is a platform, split it into fragments
  if (hitEntity instanceof Platform) {
    // If this is a bullet from the local player, notify the server about platform destruction
    if (STATE.myPlayer && this.ownerId === STATE.myPlayer.id) {
      socket.sendPlatformDestroy(hitEntity.id);
      
      // Remove the platform from entities immediately for the local player
      const platformIndex = allEntities.indexOf(hitEntity);
      if (platformIndex > -1) {
        allEntities.splice(platformIndex, 1);
      }
      
      // Split the platform into fragments
      const fragments = this.splitEntity(hitEntity, allEntities);
      
      // If fragments were created, notify the server about fragment creation
      if (fragments.length > 0) {
        for (const fragment of fragments) {
          // Set the original entity ID to track which platform this fragment came from
          fragment.originalEntityId = hitEntity.id;
          
          // Generate a unique ID for the fragment if it doesn't have one
          if (!fragment.id) {
            fragment.id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
          }
          
          // Send fragment creation message
          socket.sendFragmentCreate(fragment);
        }
      }
    }
    // For non-local players, the platform will be removed and fragments created when
    // the server broadcasts the platform destruction and fragment creation messages
  }
    
    // Delete the bullet after collision
    this.deleteSelf(allEntities);
  }

  deleteSelf(allEntities) {
    const index = allEntities.indexOf(this);
    if (index > -1) {
      allEntities.splice(index, 1);
    }
  }

  splitEntity(entity, allEntities) {
    const fragments = [];
    const fragmentSize = Math.max(12, entity.width / 2); // Each fragment should be 12x12

    // Determine how many fragments fit in the entity
    const cols = Math.floor(entity.width / fragmentSize);
    const rows = Math.floor(entity.height / fragmentSize);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const fragmentX = entity.x + col * fragmentSize;
            const fragmentY = entity.y + row * fragmentSize;
            
            const fragment = new Fragment(entity.canvas, entity.gl, {
                x: fragmentX,
                y: fragmentY,
                width: fragmentSize,
                height: fragmentSize,
                color: Array.from(entity.color)
            });

            // Apply random velocity to scatter the fragments.
            fragment.hasCollision = true;
            fragment.hasGravity = true;
            fragment.sleeping = false;
            fragment.velocity.x = (Math.random() - 0.5) * 3200;
            fragment.velocity.y = (Math.random() - 0.5) * 3100;

            allEntities.push(fragment);
            fragments.push(fragment);
        }
    }

    return fragments;
}


}

export default Bullet;
