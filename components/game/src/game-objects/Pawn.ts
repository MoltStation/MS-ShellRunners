import { CAM_CENTER } from '../cfg/constants/design-constants';
import { CUSTOM_EVENTS, DEPTH } from '../cfg/constants/game-constants';
import { TWEEN_EASING } from '../cfg/constants/static-constants';
import { EInputDirection } from '../cfg/enums/EInputDirection';
import type { AbstractScene } from '../scenes/AbstractScene';
import { ShellRunner } from '../ui-objects/ShellRunner';


const RIPPLE_ALPHA_DEC = 0.01;
const RIPPLE_SCALE_INC = 0.01;

export class Pawn {
  scene: AbstractScene;
  // events: Phaser.Events.EventEmitter;

  shellRunner!: ShellRunner;
  ripples: Array<Phaser.GameObjects.Arc> = [];

  // Horizontal movement speed multiplier (pixels/ms). Tuned for keyboard + touch.
  // NFT metadata also contributes via `changePawn()`.
  speed = 0.42;

  previousInputDirection: EInputDirection = EInputDirection.NONE;

  constructor(scene: AbstractScene) {
    this.scene = scene;
    this.addRipples();
    this.addPawn();
  }

  private addRipples() {
    for (let i = 0; i < 10; ++i) {
      this.ripples[i] = this.scene.add.arc(0, 0, 75, 0, 360, false, 0xFFFFFF, 0);
      this.ripples[i].setAlpha(0.1 + i * 0.1);
      this.ripples[i].setScale(0.1 + i * 0.1);
      this.ripples[i].setStrokeStyle(5, 0xFFFFFF, 0.4);
      this.ripples[i].setVisible(false);
    }
  }

  private addPawn(): void {
    this.shellRunner = new ShellRunner(this.scene, CAM_CENTER.x, CAM_CENTER.y + this.scene.grs.designDim.height * 0.4);
    this.shellRunner.setDepth(DEPTH.player);
    this.shellRunner.setScale(0);
    this.shellRunner.on(CUSTOM_EVENTS.PAWN_REVIVED, () => {
      this.resetRipples();
    });
    this.shellRunner.on(CUSTOM_EVENTS.PAWN_SPAWNED, () => {
      this.resetRipples();
    });
    this.shellRunner.setupGameShellRunner();
  }

  private playDirectionChangeTween() {
    let angle = 0;
    if (this.scene.inputManager.getInputDirection() === EInputDirection.LEFT) {
      this.scene.audioManager.play('splash');
      angle = -30;
    } else if (this.scene.inputManager.getInputDirection() === EInputDirection.RIGHT) {
      this.scene.audioManager.play('splash');
      angle = 30;
    }
    this.shellRunner.playPawnDirectionChangeTween(angle);
  }

  resetPawn() {
    this.shellRunner.setScale(0);
    for (let i = 0; i < 10; ++i) {
      this.ripples[i].setVisible(false);
    }
  }

  changePawn(speed: number, index: number) {
    this.shellRunner.changeGameShellRunner(index);
    // `speed` comes from NFT metadata and can be small (starter runner) or large (minted runners).
    // Keep controls responsive for low-speed runners while capping extremes.
    const s = Number(speed);
    const safe = Number.isFinite(s) && s > 0 ? s : 0;
    // Log scaling prevents huge score-derived values from instantly maxing movement speed.
    const tuned = 0.42 + Math.log10(1 + safe) * 0.12;
    this.speed = Math.min(1.4, Math.max(0.42, tuned));
  }

  playPawnCollidedTween() {
    this.fadeOutRipplesAfterDeath();
    this.shellRunner.stopLimbTweens();
    this.shellRunner.stopResetLimbTweens();
    this.previousInputDirection = EInputDirection.NONE;
    this.shellRunner.pawnCollidedTween();
  }

  playConsumeTween() {
    this.shellRunner.playConsumeTween();
  }

  playInvincibilityTween() {
    this.shellRunner.playPawnInvincibilityTween();
  }

  increasePawnMovementSpeed() {
    const origSpeed = this.speed;
    this.speed *= 1.3;
    this.scene.time.delayedCall(5000, () => {
      this.scene.tweens.add({
        targets: this,
        speed: origSpeed,
        ease: TWEEN_EASING.QUAD_EASE_IN,
        duration: 500,
        onComplete: () => {
          this.speed = origSpeed;
        }
      })
    })
  }

  playPawnReviveTween() {
    this.shellRunner.x = CAM_CENTER.x;
    this.shellRunner.playPawnReviveTween();
    this.resetRipples();
  }

  showPawnInitially() {
    this.shellRunner.x = CAM_CENTER.x;
    this.shellRunner.showPawnInitially();
  }

  private fadeOutRipplesAfterDeath() {
    // console.warn('fadeout', (1 - this.ripples[i].alpha) * RIPPLE_ALPHA_DEC * 1000);
    this.scene.tweens.add({
      targets: this.ripples,
      alpha: 0,
      duration: 500,
    })
  }

  private resetRipples() {
    for (let i = 0; i < this.ripples.length; ++i) {
      this.ripples[i].setPosition(this.shellRunner.x, this.shellRunner.y);
      this.ripples[i].setAlpha(0.1 + i * 0.1);
      this.ripples[i].setScale(0.1 + i * 0.1);
      this.ripples[i].setVisible(false);
    }
  }

  update(delta: number) {
    if (this.scene.inputManager.getIsInputEnabled()) {
      const direction = this.scene.inputManager.getInputDirection();
      if (direction !== EInputDirection.NONE) {
        this.shellRunner.x += delta * (direction === EInputDirection.LEFT ? -this.speed : this.speed);
        const halfWidth = this.scene.grs.designDim.width * 0.5 - 200;
        if (this.shellRunner.x <= CAM_CENTER.x - halfWidth) {
          this.shellRunner.x = CAM_CENTER.x - halfWidth;
        } else if (this.shellRunner.x >= CAM_CENTER.x + halfWidth) {
          this.shellRunner.x = CAM_CENTER.x + halfWidth;
        }
      }
      if (this.previousInputDirection !== direction) {
        this.playDirectionChangeTween();
        this.previousInputDirection = direction;
      }
      this.previousInputDirection = direction;
    }

    for (let i = this.ripples.length - 1; i >= 0; --i) {
      this.ripples[i].scale += RIPPLE_SCALE_INC;
      this.ripples[i].alpha -= RIPPLE_ALPHA_DEC;
      this.ripples[i].y += 0.15 * delta;
      if (this.ripples[i].alpha <= 0) {
        this.ripples[i].scale = 0.75;
        this.ripples[i].alpha = 0.4;
        this.ripples[i].x = this.shellRunner.x;
        this.ripples[i].y = this.shellRunner.y;
        this.ripples[i].setVisible(true);
      }
    }
  }

  resizeAndRepositionElements() {

  }
}
