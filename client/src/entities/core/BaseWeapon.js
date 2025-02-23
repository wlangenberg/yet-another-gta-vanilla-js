import { BaseEntity } from "./BaseEntity.js";

class BaseWeapon extends BaseEntity {
  constructor(x, y, width, height, color, canvas) {
    super(x, y, width, height, color, canvas);
    this.name = 'Base Weapon';
    this.damage = 0;
    this.range = 0;
    this.pickupable = false;
  }

  shoot() {
    console.log('Shooting with base weapon');
  }
}

export default BaseWeapon;