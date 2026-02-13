import { CUSTOM_EVENTS } from "../cfg/constants/game-constants";
import { EInputDirection } from "../cfg/enums/EInputDirection";
import { AbstractScene } from "../scenes/AbstractScene";

export class InputManager {

  private isInputEnabled = false;
  private inputDirection: EInputDirection = EInputDirection.NONE;
  private isDesktop = false;
  private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;
  events: Phaser.Events.EventEmitter;

  constructor(private scene: AbstractScene) {
    this.events = new Phaser.Events.EventEmitter();
    const keyboard = this.scene.input.keyboard;
    this.cursorKeys = keyboard
      ? keyboard.createCursorKeys()
      : ({} as Phaser.Types.Input.Keyboard.CursorKeys);
    this.isDesktop = this.scene.game.device.os.desktop;
    this.keyA = keyboard
      ? keyboard.addKey('A')
      : ({} as Phaser.Input.Keyboard.Key);
    this.keyD = keyboard
      ? keyboard.addKey('D')
      : ({} as Phaser.Input.Keyboard.Key);

    if (!this.isDesktop) {
      this.addTouchListener();
    } else {
      this.addEscapeListener();
    }
  }

  getInputDirection() {
    return this.inputDirection;
  }

  getIsInputEnabled() {
    return this.isInputEnabled;
  }

  setInputEnabled(value: boolean) {
    this.isInputEnabled = value;
  }

  setInputDirection(value: EInputDirection) {
    this.inputDirection = value;
  }

  private handleInput(direction: EInputDirection) {
    if (!this.isInputEnabled) {
      return;
    }
    this.inputDirection = direction;
  }

  private addEscapeListener(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keyup-' + 'ESC', () => {
      this.events.emit(CUSTOM_EVENTS.ESCAPE);
    });
  }

  private addTouchListener(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const deltaX = pointer.x - pointer.camera.width * 0.5;
      if (deltaX <= 0) {
        this.handleInput(EInputDirection.LEFT);
      } else {
        this.handleInput(EInputDirection.RIGHT);
      }
    });
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handleInput(EInputDirection.NONE);
    });
  }

  update(delta: number) {
    if (this.isInputEnabled) {
      if (this.isDesktop) {
        this.inputDirection = EInputDirection.NONE;
        if (this.cursorKeys.left?.isDown || this.keyA?.isDown) {
          this.inputDirection = EInputDirection.LEFT;
        } else if (this.cursorKeys.right?.isDown || this.keyD?.isDown) {
          this.inputDirection = EInputDirection.RIGHT;
        }
      }
    }
  }
}
