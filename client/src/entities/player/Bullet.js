import { BaseEntity } from "../core/BaseEntity.js";
import Fragment from "../fragments/Fragment.js";
import Platform from "../platforms/platform.js";

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
    this.type = 'bullet'
    this.friction = 1;
    this.airFriction = 0.99;
    
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
    // Apply damage to the hit entity if it has health
    if (hitEntity.health !== undefined && !hitEntity.isDead && !hitEntity.invulnerable) {
      hitEntity.takeDamage(this.damage, this);
    }
    
    // If the hit entity is a platform, split it into fragments
    if (hitEntity instanceof Platform) {
      this.splitEntity(hitEntity, allEntities);
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
