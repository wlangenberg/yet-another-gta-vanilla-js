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
    this.friction = 1;
    this.airFriction = 1;
    
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
    const index = allEntities.findIndex(entity => entity === hitEntity && !hitEntity.isLocalPlayer);
    
    if (index !== -1) {
      allEntities.splice(index, 1); // Remove the entity from the array
      this.deleteSelf(allEntities)
      if (hitEntity instanceof Platform) this.splitEntity(hitEntity, allEntities)
      
    } else {
    }
  }

  deleteSelf(allEntities) {
    const index = allEntities.indexOf(this);
    if (index > -1) {
      allEntities.splice(index, 1);
    }
  }

  splitEntity(entity, allEntities) {
      const fragments = [];
      // Split the entity into 4 pieces (2x2 grid).
      const newWidth = entity.width / 1;
      const newHeight = entity.height / 1;
      for (let row = 0; row < 1; row++) {
          for (let col = 0; col < 1; col++) {
              const fragmentX = entity.x + col * newWidth;
              const fragmentY = entity.y + row * newHeight;
              const fragment = new Fragment(entity.canvas, entity.gl, {
                  x: fragmentX,
                  y: fragmentY,
                  width: newWidth,
                  height: newHeight,
                  color: Array.from(entity.color)
              });
              // Apply random velocity to scatter the fragments.
              fragment.hasCollision = true;
              fragment.hasGravity = true;
              fragment.velocity.x = (Math.random() - 0.9) * 3200;
              fragment.velocity.y = (Math.random() - 0.9) * 3100;
              allEntities.push(fragment);
          }
      }
      return fragments;
  }

}

export default Bullet;
