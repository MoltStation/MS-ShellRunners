import { CAM_CENTER } from "../cfg/constants/design-constants";
import { CUSTOM_EVENTS } from "../cfg/constants/game-constants";
import { TWEEN_EASING } from "../cfg/constants/static-constants";
import { Overlay } from "../game-objects/Overlay";
import { AbstractScene } from "../scenes/AbstractScene";
import { SelectionArrow } from "./SelectionArrow";
import { ShellRunner } from "./ShellRunner";
import { StartButton } from "./StartButton";
import { ShellRunnerDetails } from "./ShellRunnerDetails";

const TWEEN_DURATION = 150;

export class ShellRunnerSelectionMenu extends Phaser.GameObjects.Container {
  scene: AbstractScene;

  private overlay!: Phaser.GameObjects.Image;
  private dragBox!: Phaser.GameObjects.Image;
  private shellRunnerDetails!: ShellRunnerDetails;
  private leftArrow!: SelectionArrow;
  private rightArrow!: SelectionArrow;
  private startButton!: StartButton;

  private showShellRunners: Array<ShellRunner> = [];
  private showShellRunnersPositionX: Array<number> = [];
  private currentShellRunnerIndex = 0;
  private shellRunnersData: Array<IUserNftWithMetadata> = [];

  private initDragX = 0;
  private isDragEnabled = true;

  constructor(scene: AbstractScene) {
    super(scene, CAM_CENTER.x, CAM_CENTER.y);
    this.scene = scene;
    this.addOverlay();
    this.setupShellRunners();
    this.addShellRunnerDetails();
    this.addDragBox();
    this.addLeftArrow();
    this.addRightArrow();
    this.addStartButton();
    this.setAlpha(0);
    this.setVisible(false);
    this.addEventListeners();
    this.scene.add.existing(this);
  }

  private addOverlay() {
    this.overlay = this.scene.add.image(0, 0, 'black_overlay');
    this.overlay.setOrigin(0.5);
    this.overlay.setAlpha(0.25);
    this.overlay.setDisplaySize(
      this.scene.grs.resizeDim.width,
      this.scene.grs.resizeDim.height
    );
    this.add(this.overlay);
  }

  private addDragBox() {
    this.dragBox = this.scene.add.image(0, 0, 'black_overlay');
    this.dragBox.setOrigin(0.5);
    this.dragBox.setAlpha(0.01);
    this.dragBox.setPosition(this.showShellRunnersPositionX[2], 0);
    this.dragBox.setDisplaySize(
      this.scene.grs.designDim.width * 0.6,
      this.scene.grs.designDim.height * 0.4
    );
    this.add(this.dragBox);
  }

  private addStartButton() {
    this.startButton = new StartButton(this.scene, this.scene.grs.designDim.width * 0.28, this.scene.grs.designDim.height * 0.35);
    this.add(this.startButton);
  }

  private addLeftArrow() {
    this.leftArrow = new SelectionArrow(this.scene, -this.scene.grs.designDim.width * 0.4, 0);
    this.add(this.leftArrow);
  }

  private addRightArrow() {
    this.rightArrow = new SelectionArrow(this.scene, this.scene.grs.designDim.width * 0.1, 0);
    this.rightArrow.setFlipX(true);
    this.add(this.rightArrow);
  }

  private setupShellRunners() {
    const startX = -this.scene.grs.designDim.width * 0.45;
    for (let i = 0; i < 5; ++i) {
      this.showShellRunners[i] = new ShellRunner(this.scene, startX + this.scene.grs.designDim.width * 0.15 * i, 0);
      if (i === 0 || i === 4) {
        this.showShellRunners[i].setScale(0);
        if (i === 0) {
          this.showShellRunners[i].x += this.scene.grs.designDim.width * 0.05;
        } else {
          this.showShellRunners[i].x -= this.scene.grs.designDim.width * 0.05;
        }
      } else if (i === 1 || i === 3) {
        this.showShellRunners[i].setScale(0.25);
      } else {
        this.showShellRunners[i].setScale(0.5);
      }
      this.showShellRunnersPositionX[i] = this.showShellRunners[i].x;
      this.add(this.showShellRunners[i]);
    }
  }

  resetLineUp() {
    const startX = -this.scene.grs.designDim.width * 0.45;
    for (let i = 0; i < 5; ++i) {
      this.showShellRunners[i].setPosition(startX + this.scene.grs.designDim.width * 0.15 * i, 0);
      this.showShellRunners[i].setScale(1);
      this.showShellRunners[i].setVisible(true);
      if (i === 0 || i === 4) {
        this.showShellRunners[i].setScale(0);
        if (i === 0) {
          this.showShellRunners[i].x += this.scene.grs.designDim.width * 0.05;
        } else {
          this.showShellRunners[i].x -= this.scene.grs.designDim.width * 0.05;
        }
      } else if (i === 1 || i === 3) {
        this.showShellRunners[i].setScale(0.25);
      } else {
        this.showShellRunners[i].setScale(0.5);
      }
      this.showShellRunnersPositionX[i] = this.showShellRunners[i].x;
    }
  }

  private addShellRunnerDetails() {
    this.shellRunnerDetails = new ShellRunnerDetails(this.scene, this.scene.grs.designDim.width * 0.275, 0);
    this.add(this.shellRunnerDetails);
  }

  populateShellRunners(shellRunnersData: Array<IUserNftWithMetadata>, mainShellRunnerIndex: number) {
    this.resetLineUp();
    this.currentShellRunnerIndex = mainShellRunnerIndex;
    this.shellRunnersData = shellRunnersData;

    if (!shellRunnersData || shellRunnersData.length === 0) {
      this.showShellRunners[2].setVisible(false);
      this.showShellRunners[1].setVisible(false);
      this.showShellRunners[3].setVisible(false);
      this.leftArrow.setEnabled(false);
      this.rightArrow.setEnabled(false);
      this.startButton.isEnabled = false;
      this.shellRunnerDetails.updateShellRunnerDetails(undefined as any);
      return;
    }

    if (mainShellRunnerIndex === 0) {
      this.showShellRunners[1].setVisible(false);
    }
    if (mainShellRunnerIndex === shellRunnersData.length - 1) {
      this.showShellRunners[3].setVisible(false);
    }
    // Middle shell runner
    this.showShellRunners[2].setupDisplayShellRunner(mainShellRunnerIndex);
    this.shellRunnerDetails.updateShellRunnerDetails(this.shellRunnersData[this.currentShellRunnerIndex]);
    // Left shell runner
    if (mainShellRunnerIndex - 1 >= 0) {
      this.showShellRunners[1].setupDisplayShellRunner(mainShellRunnerIndex - 1);
      this.rightArrow.setEnabled(true);
    }
    // Right shell runner
    if (mainShellRunnerIndex + 1 <= shellRunnersData.length - 1) {
      this.showShellRunners[3].setupDisplayShellRunner(mainShellRunnerIndex + 1);
      this.leftArrow.setEnabled(true);
    }
  }

  showMenu() {
    this.showTween();
  }

  private hideMenu() {
    this.hideTween();
  }

  private showTween() {
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 400,
      ease: TWEEN_EASING.QUAD_EASE_OUT,
      onStart: () => {
        this.isDragEnabled = true;
        this.startButton.isEnabled = true;
        this.setVisible(true);
      }
    });
  }

  private hideTween() {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 400,
      ease: TWEEN_EASING.QUAD_EASE_IN,
      onComplete: () => {
        this.setVisible(false);
      }
    })
  }

  private addEventListeners() {
    this.dragBox.setInteractive(
      { draggable: true }
    ).on('dragstart', (pointer: any) => {
      this.initDragX = pointer.downX;
    }).on('drag', (pointer: any) => {
      if (!this.isDragEnabled) {
        return;
      }
      if (pointer.position.x - this.initDragX > 50 && this.rightArrow.isEnabled) {
        this.initDragX = pointer.position.x;
        this.triggerRightMove();
      } else if (pointer.position.x - this.initDragX < -50 && this.leftArrow.isEnabled) {
        this.initDragX = pointer.position.x;
        this.triggerLeftMove();
      }
    });
    this.leftArrow.on(CUSTOM_EVENTS.BUTTON_CLICKED, () => {
      this.triggerLeftMove();
    });
    this.rightArrow.on(CUSTOM_EVENTS.BUTTON_CLICKED, () => {
      this.triggerRightMove();
    });
    this.startButton.on(CUSTOM_EVENTS.BUTTON_CLICKED, () => {
      this.leftArrow.setEnabled(false);
      this.rightArrow.setEnabled(false);
      this.isDragEnabled = false;
      this.hideMenu();
      const metadata = this.shellRunnersData[this.currentShellRunnerIndex]?.metadata;
      const speedAttrib = metadata?.attributes?.find((attrib) => {
        if (attrib.trait_type === 'speed') {
          return true;
        }
      });
      this.emit(
        CUSTOM_EVENTS.START_GAME,
        speedAttrib ? speedAttrib.value : 0,
        this.currentShellRunnerIndex
      );
    });
  }

  private disableDragFewMoments() {
    this.isDragEnabled = false;
    this.scene.time.delayedCall(TWEEN_DURATION, () => {
      this.isDragEnabled = true;
    });
  }

  private triggerLeftMove() {
    this.disableDragFewMoments();
    const nextIndex = this.currentShellRunnerIndex + 1;
    this.currentShellRunnerIndex = nextIndex;
    if (nextIndex + 1 <= this.shellRunnersData.length - 1) {
      this.showShellRunners[4].setupDisplayShellRunner(nextIndex + 1);
      this.showShellRunners[4].setVisible(true);
      this.leftArrow.setEnabled(true);
    } else {
      this.leftArrow.setEnabled(false);
      this.showShellRunners[4].setVisible(false);
    }
    this.shellRunnerDetails.updateShellRunnerDetails(this.shellRunnersData[this.currentShellRunnerIndex]);
    this.rightArrow.setEnabled(true);
    this.leftMoveTween();
  }

  private triggerRightMove() {
    this.disableDragFewMoments();
    const nextIndex = this.currentShellRunnerIndex - 1;
    this.currentShellRunnerIndex = nextIndex;
    if (nextIndex - 1 >= 0) {
      this.showShellRunners[0].setupDisplayShellRunner(nextIndex + 1);
      this.showShellRunners[0].setVisible(true);
      this.rightArrow.setEnabled(true);
    } else {
      this.rightArrow.setEnabled(false);
      this.showShellRunners[0].setVisible(false);
    }
    this.shellRunnerDetails.updateShellRunnerDetails(this.shellRunnersData[this.currentShellRunnerIndex]);
    this.leftArrow.setEnabled(true);
    this.rightMoveTween();
  }

  private leftMoveTween() {
    this.scene.audioManager.play('shellRunnerSwap');
    this.showShellRunners[4].x = this.showShellRunnersPositionX[4];
    for (let i = 1; i < 5; ++i) {
      if (this.showShellRunners[i].visible) {
        this.scene.tweens.add({
          targets: this.showShellRunners[i],
          x: this.showShellRunnersPositionX[i - 1],
          duration: TWEEN_DURATION,
          ease: TWEEN_EASING.SINE_EASE_IN,
        });
      }
    }

    if (this.showShellRunners[1].visible) {
      const shellRunner = this.showShellRunners[1];
      this.scene.tweens.add({
        targets: shellRunner,
        duration: TWEEN_DURATION,
        scale: 0,
        ease: TWEEN_EASING.SINE_EASE_IN,
        onComplete: () => {
          // shellRunner.setVisible(false);
        }
      });
    }
    this.scene.tweens.add({
      targets: this.showShellRunners[2],
      duration: TWEEN_DURATION,
      scale: 0.25,
      ease: TWEEN_EASING.SINE_EASE_IN,
    });
    this.scene.tweens.add({
      targets: this.showShellRunners[3],
      duration: TWEEN_DURATION,
      scale: 0.5,
      ease: TWEEN_EASING.SINE_EASE_IN
    });
    if (this.showShellRunners[4].visible) {
      this.scene.tweens.add({
        targets: this.showShellRunners[4],
        duration: TWEEN_DURATION,
        scale: 0.25,
        ease: TWEEN_EASING.SINE_EASE_IN
      });
    }
    this.showShellRunners.push(this.showShellRunners.shift()!);
  }

  private rightMoveTween() {
    this.scene.audioManager.play('shellRunnerSwap');
    this.showShellRunners[0].x = this.showShellRunnersPositionX[0];
    for (let i = 0; i < 4; ++i) {
      if (this.showShellRunners[i].visible) {
        this.scene.tweens.add({
          targets: this.showShellRunners[i],
          x: this.showShellRunnersPositionX[i + 1],
          duration: TWEEN_DURATION,
          ease: TWEEN_EASING.SINE_EASE_IN,
        });
      }
    }
    if (this.showShellRunners[3].visible) {
      const shellRunner = this.showShellRunners[3];
      this.scene.tweens.add({
        targets: shellRunner,
        duration: TWEEN_DURATION,
        scale: 0,
        ease: TWEEN_EASING.SINE_EASE_IN,
        onComplete: () => {
          // shellRunner.setVisible(false);
        }
      });
    }
    this.scene.tweens.add({
      targets: this.showShellRunners[2],
      duration: TWEEN_DURATION,
      scale: 0.25,
      ease: TWEEN_EASING.SINE_EASE_IN
    });
    this.scene.tweens.add({
      targets: this.showShellRunners[1],
      duration: TWEEN_DURATION,
      scale: 0.5,
      ease: TWEEN_EASING.SINE_EASE_IN
    });
    if (this.showShellRunners[0].visible) {
      this.scene.tweens.add({
        targets: this.showShellRunners[0],
        duration: TWEEN_DURATION,
        scale: 0.25,
        ease: TWEEN_EASING.SINE_EASE_IN
      });
    }
    this.showShellRunners.unshift(this.showShellRunners.pop()!);

  }

  resizeAndRepositionElements(): void {
    this.overlay.setDisplaySize(
      this.scene.grs.resizeDim.width,
      this.scene.grs.resizeDim.height
    );
  }


}
