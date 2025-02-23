import BaseWeapon from '../core/BaseWeapon.js';
import { AnimationController, Animation } from '../../systems/Animation.js';
import Bullet from './Bullet.js';
import { allEntities } from "../../configuration/constants.js";
import Fragment from '../fragments/Fragment.js';


class Gun extends BaseWeapon {
  constructor(canvas, gl, { x = 0, y = 0, name = 'Gun', damage = 10, range = 50 } = {}) {
    super(x, y, 50, 50, [0.0, 1.0, 1.0, 1.0], canvas);
    this.name = null;
    this.damage = damage;
    this.range = range;
    this.fireRate = 5;
    this.fireDelay = 1000 / this.fireRate;
    this.lastFired = 0;
    this.pickupable = true;
    this.x = x;
    this.y = y;
    this.canvas = canvas;
    this.gl = gl;
    this.texture = new Image();
    this.texture.src = 'assets/images/gun.png';
    this.defaultLayer = 0;
    this.renderLayer = this.defaultLayer;
    this.rotation = 0;
    this.animationsPromise = this.addVisuals();
    this.hasCollision = true;
    this.type = 'gun'
  }

  onPickup(player) {
    this.hasGravity = false
    this.hasCollision = false
    this.setRenderLayer(2);
  }
  
  onDrop() {
    this.hasGravity = true
    this.hasCollision = true
    this.sleeping = true
    this.attachedTo = null
    this.type = 'gun'
    this.resetRenderLayer();
  }

  async addVisuals() {
    const gunAnimationFrames = ['assets/images/gun.png'];
    this.gunAnimation = new Animation(this.gl, gunAnimationFrames);
    await this.gunAnimation.loadFrames(gunAnimationFrames);
    this.animationController = new AnimationController();
    this.animationController.addAnimation('default2', this.gunAnimation);
    this.setScale(2);
  }

  shoot() {
    const currentTime = performance.now();
    
    if (currentTime - this.lastFired < this.fireDelay) {
      return;
    }

    this.lastFired = currentTime;

    // Calculate the gun's center position.
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // Define a muzzle offset relative to the center.
    const muzzleOffset = { x: this.width / 2, y: 0 };
    
    // Rotate the muzzle offset by the gun's current rotation.
    const rotatedOffset = {
      x: muzzleOffset.x * Math.cos(this.rotation) - muzzleOffset.y * Math.sin(this.rotation),
      y: muzzleOffset.x * Math.sin(this.rotation) + muzzleOffset.y * Math.cos(this.rotation)
    };
    
    // Compute the bullet's spawn position.
    const bulletX = centerX + rotatedOffset.x;
    const bulletY = centerY + rotatedOffset.y;
    
    // Create and spawn the bullet.
    const bullet = new Bullet(this.canvas, this.gl, {
        x: bulletX,
        y: bulletY,
        rotation: this.rotation,
        speed: 3000,
        damage: this.damage,
        lifetime: 2
    });
    allEntities.push(bullet);
    this.splitEntity(bullet, allEntities)
  }
  
  update(deltaTime, allEntities, spatialGrid) {
    if (this.attachedTo) {
      this.x = this.attachedTo.x + this.attachmentOffset.x;
      this.y = this.attachedTo.y + this.attachmentOffset.y;
    }
    
    this.animationController.update(deltaTime);
    super.update(deltaTime, allEntities, spatialGrid);
  }

  splitEntity(entity, allEntities) {
    const fragments = [];
    // Split the entity into 4 pieces (2x2 grid).
    const newWidth = entity.width / 3;
    const newHeight = entity.height / 3;
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
            fragment.velocity.x = (Math.random() - 0.9) * 700;
            fragment.velocity.y = (Math.random() - 0.9) * 700;
            fragment.hasGravity = true;
            fragment.hasCollision = false;
            fragment.lifetime = 1;
            fragment.enableLife = true;
            allEntities.push(fragment);
        }
    }
    return fragments;
}
}

export default Gun;
