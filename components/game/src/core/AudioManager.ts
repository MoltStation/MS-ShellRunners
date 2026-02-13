import { GAME_SOUNDS } from '../cfg/constants/game-constants';
import type { AbstractScene } from '../scenes/AbstractScene';

export class AudioManager {
  scene: AbstractScene;
  private bgSounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private deferredPlayKeys: Set<string> = new Set();

  constructor(scene: AbstractScene) {
    this.scene = scene;
  }

  initBootAudio(): void {
    // If any audio needs to play in boot scene, add it here.
  }

  initGameAudio(): void {
    for (let i = 0, len = GAME_SOUNDS.length; i < len; ++i) {
      this.sounds.set(
        GAME_SOUNDS[i].key,
        this.scene.sound.add(GAME_SOUNDS[i].key, { volume: 1, loop: GAME_SOUNDS[i].loop })
      );
    }
  }

  private canPlayAudio(): boolean {
    const soundManager = this.scene.sound as any;
    if (!soundManager) return false;
    if (soundManager.locked) return false;
    const context = soundManager.context as AudioContext | undefined;
    if (context && context.state !== 'running') return false;
    return true;
  }

  play(key: string, shouldStopPrevious = true): void {
    if (!this.canPlayAudio()) {
      if (!this.deferredPlayKeys.has(key)) {
        this.deferredPlayKeys.add(key);
        const retry = () => {
          this.deferredPlayKeys.delete(key);
          this.play(key, shouldStopPrevious);
        };
        this.scene.input.once('pointerdown', retry);
        this.scene.input.keyboard?.once('keydown', retry);
      }
      return;
    }
    const sound = this.sounds && this.sounds.get(key);
    if (this.sounds && sound) {
      if (shouldStopPrevious) {
        sound.stop();
      }
      sound.play();
    } else {
      console.warn(`Cannot find sound with key: ${key}`);
    }
  }

  playMusic(key: string, shouldStopPrevious = true): void {
    if (!this.canPlayAudio()) return;
    const bgSound = this.bgSounds && this.bgSounds.get(key);
    if (bgSound) {
      if (shouldStopPrevious) {
        bgSound.stop();
      }
      bgSound.play();
    } else {
      console.warn(`Cannot find music with key: ${key}`);
    }
  }

  onceComplete(key: string, callback: () => void): void {
    if (!this.canPlayAudio()) return;
    const sound = this.sounds && this.sounds.get(key);
    if (this.sounds && sound) {
      sound.play();
      sound.once('complete', () => {
        callback();
      });
    } else {
      console.warn(`Cannot find sound with key: ${key}`);
    }
  }

  stopSound(key: string): void {
    const sound = this.sounds && this.sounds.get(key);
    if (this.sounds && sound) {
      sound.stop();
    } else {
      console.warn(`Cannot find sound with key: ${key}`);
    }
  }

  turnOff(): void {
    this.scene.sound.volume = 0;
  }

  turnOn(): void {
    this.scene.sound.volume = 1;
  }
}
