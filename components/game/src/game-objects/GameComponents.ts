import { CAM_CENTER } from '../cfg/constants/design-constants';
import { TWEEN_EASING } from '../cfg/constants/static-constants';
import type { AbstractScene } from '../scenes/AbstractScene';
import { Water } from './Water';
import { ObstacleManager } from './Obstacles/ObstacleManager';
import { Overlay } from './Overlay';
import { Pawn } from './Pawn';
import { BankManager } from './Banks/BankManager';
import { DEPTH } from '../cfg/constants/game-constants';

const SPEED_INCREASE_THRESHOLD = 12000;
const SPEED_INCREASE = 0.035;
const INIT_SPEED = 0.12;
const MAX_SPEED = 0.75;

export class GameComponents {
  scene: AbstractScene;

  grd: CanvasRenderingContext2D | null;
  scrollSpeedTween: Phaser.Tweens.Tween | null = null;
  water: Water;
  bankManager: BankManager;
  obstacleManager: ObstacleManager;
  pawn: Pawn;
  overlay: Overlay;

  origZoom: number;
  scrollSpeed = INIT_SPEED;
  speedIncreaseThreshold = SPEED_INCREASE_THRESHOLD;  // ms;
  scrollSpeedBeforeDeath = INIT_SPEED;


  constructor(scene: AbstractScene) {
    this.scene = scene;

    // Some Phaser builds can return null for createCanvas() if the key already exists.
    // Also, `getContext()` can be null depending on environment. We do not rely on this
    // context for core gameplay, so prefer a safe fallback.
    this.grd = null;
    try {
      const sysCanvas = this.scene.sys.canvas;
      if (sysCanvas) {
        this.grd = sysCanvas.getContext('2d');
      }
    } catch {
      // ignore
    }
    if (!this.grd) {
      try {
        const canvasTex =
          this.scene.textures.exists('grd')
            ? (this.scene.textures.get('grd') as any)
            : this.scene.textures.createCanvas('grd', 2, 2);
        this.grd = canvasTex?.getContext?.() ?? null;
      } catch {
        this.grd = null;
      }
    }

    this.water = new Water(this.scene);
    this.bankManager = new BankManager(this.scene);
    this.obstacleManager = new ObstacleManager(this.scene);
    this.pawn = new Pawn(this.scene);
    this.overlay = new Overlay(this.scene).setDepth(DEPTH.overlay);
    this.origZoom = this.scene.cameras.main.zoom;
  }

  startGame() {
    this.scrollSpeed = INIT_SPEED;
    this.speedIncreaseThreshold = SPEED_INCREASE_THRESHOLD;
    this.scrollSpeedBeforeDeath = INIT_SPEED;
    this.obstacleManager.generateGroupsInitially();
  }

  endGame() {
    this.obstacleManager.resetObstacleManager();
    this.pawn.resetPawn();
    this.scrollSpeed = INIT_SPEED;
    this.speedIncreaseThreshold = SPEED_INCREASE_THRESHOLD;  // ms;
    this.scrollSpeedBeforeDeath = INIT_SPEED;
  }

  handlePawnCollision() {
    this.overlay.showOverlay();
    this.stopScrollTween();
    this.scrollSpeedBeforeDeath = this.scrollSpeed * 0.75;
    if (this.scrollSpeedBeforeDeath < INIT_SPEED) {
      this.scrollSpeedBeforeDeath = INIT_SPEED;
    }
    this.speedIncreaseThreshold = SPEED_INCREASE_THRESHOLD;
    this.scrollSpeed = INIT_SPEED;
    this.pawn.playPawnCollidedTween();
    this.deathCameraEffects();
  }

  deathCameraEffects() {
    this.scene.cameras.main.zoomTo(this.origZoom + 0.05, 500, TWEEN_EASING.SINE_EASE_IN);
    this.scene.cameras.main.pan(CAM_CENTER.x - (CAM_CENTER.x - this.pawn.shellRunner.x) * 0.2, CAM_CENTER.y, 500, TWEEN_EASING.SINE_EASE_IN);
    this.scene.cameras.main.shake(500, 0.005);
    window.navigator.vibrate(500);
  }

  resetCamera() {
    const currZoom = this.scene.cameras.main.zoom;
    this.scene.cameras.main.zoomTo(this.origZoom, 500, TWEEN_EASING.SINE_EASE_OUT);
    this.scene.cameras.main.pan(CAM_CENTER.x, CAM_CENTER.y, 500, TWEEN_EASING.SINE_EASE_OUT);
  }

  startShellRunnerRevival() {
    this.overlay.hideOverlay();
    this.resetCamera();
    this.scene.cameras.main.once('camerapancomplete', (camera: Phaser.Cameras.Scene2D.Camera) => {
      this.pawn.playPawnReviveTween();
    });
  }

  stopScrollTween() {
    if (this.scrollSpeedTween && this.scrollSpeedTween.isPlaying()) {
      this.scrollSpeedTween.stop();
      this.scrollSpeedTween = null;
    }
  }

  tweenScrollSpeedBackToUsual() {
    this.scene.tweens.add({
      targets: this,
      scrollSpeed: this.scrollSpeedBeforeDeath,
      duration: 4000,
      ease: TWEEN_EASING.SINE_EASE_OUT,
    })
  }

  increaseScrollSpeed() {
    if (this.scrollSpeed >= MAX_SPEED) {
      return;
    }
    this.scrollSpeedTween = this.scene.tweens.add({
      targets: this,
      scrollSpeed: `+=${SPEED_INCREASE}`,
      duration: 4000,
      ease: TWEEN_EASING.SINE_EASE_OUT,
    });
  }

  reduceScrollSpeed() {
    this.speedIncreaseThreshold = SPEED_INCREASE_THRESHOLD;
    this.stopScrollTween();
    let reducedSpeed = this.scrollSpeed * 0.75;
    if (reducedSpeed < INIT_SPEED) {
      reducedSpeed = INIT_SPEED;
    }
    this.scrollSpeedTween = this.scene.tweens.add({
      targets: this,
      scrollSpeed: reducedSpeed,
      duration: 1000,
      ease: TWEEN_EASING.SINE_EASE_OUT,
    });
  }

  resizeAndRepositionElements() {
    this.water.resizeAndRepositionElements();
    this.pawn.resizeAndRepositionElements();
    this.overlay.resizeAndRepositionElements();
  }

  update(delta: number) {
    const scrollSpeed = delta * this.scrollSpeed
    this.pawn.update(delta);
    this.water.scroll(scrollSpeed);
    this.bankManager.scroll(scrollSpeed);
    this.obstacleManager.update(delta, scrollSpeed);
    this.speedIncreaseThreshold -= delta;
    if (this.speedIncreaseThreshold <= 0) {
      this.speedIncreaseThreshold = SPEED_INCREASE_THRESHOLD;
      this.increaseScrollSpeed();
    }
  }
}
