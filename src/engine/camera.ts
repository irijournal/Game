import * as THREE from 'three';

/** Smoothly-damped camera with aspect-aware field of view and shake. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly pos = new THREE.Vector3(0, 4, 8);
  readonly look = new THREE.Vector3(0, 1, -8);
  readonly targetPos = new THREE.Vector3(0, 4, 8);
  readonly targetLook = new THREE.Vector3(0, 1, -8);
  stiffness = 6;
  fovBoost = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  reducedMotion = false;
  aspect = 1;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
  }

  /** Narrow screens get a wider vertical FOV so all three lanes stay visible. */
  baseFov(): number {
    const hfovTarget = 58;
    const v = (2 * Math.atan(Math.tan((hfovTarget * Math.PI) / 360) / this.aspect) * 180) / Math.PI;
    return Math.max(58, Math.min(84, v));
  }

  get portrait(): boolean {
    return this.aspect < 0.85;
  }

  setAspect(a: number): void {
    this.aspect = a;
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  snap(): void {
    this.pos.copy(this.targetPos);
    this.look.copy(this.targetLook);
  }

  shake(amount: number): void {
    if (this.reducedMotion) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * this.stiffness);
    this.pos.lerp(this.targetPos, k);
    this.look.lerp(this.targetLook, Math.min(1, k * 1.3));
    this.camera.position.copy(this.pos);
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 40;
      this.camera.position.x += Math.sin(this.shakeT * 1.3) * this.shakeAmp;
      this.camera.position.y += Math.cos(this.shakeT * 1.7) * this.shakeAmp * 0.6;
      this.shakeAmp *= Math.exp(-dt * 7);
    }
    this.camera.lookAt(this.look);
    const fov = this.baseFov() + this.fovBoost;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }
}
