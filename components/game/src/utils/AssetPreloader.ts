import { GAME_SOUNDS, PREFABS } from '../cfg/constants/game-constants';
import type { AbstractScene } from '../scenes/AbstractScene';

const ASSETS_PREFIX_URL = 'assets/img/';
const DEFAULT_BREED = 1;
const DEFAULT_PART = 1;

export class AssetsPreloader {
  scene: AbstractScene;

  constructor(scene: AbstractScene) {
    this.scene = scene;
  }

  private loadDefaultShellRunnerParts(): void {
    // The ShellRunner container uses these base keys before an NFT-based skin is applied.
    // Always load them from local assets so the game is playable even with 0 owned NFTs.
    this.scene.load.path = `${ASSETS_PREFIX_URL}shellrunner_components/`;

    const breedPath = `breed_${DEFAULT_BREED}`;
    this.scene.load.image(
      'left_hand_1',
      `${breedPath}/leftFrontFoot/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'left_foot_1',
      `${breedPath}/leftHindFoot/${DEFAULT_PART}.png`
    );
    this.scene.load.image('tail_1', `${breedPath}/tails/${DEFAULT_PART}.png`);
    this.scene.load.image('head_1', `${breedPath}/heads/${DEFAULT_PART}.png`);
    this.scene.load.image('eyes_1', `${breedPath}/eyes/${DEFAULT_PART}.png`);
    this.scene.load.image(
      'in_shell_1',
      `${breedPath}/innerShells/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'out_shell_1',
      `${breedPath}/outerShells/${DEFAULT_PART}.png`
    );

    // Default "index 0" skin used when the player owns no ShellRunner NFTs.
    this.scene.load.image('shellRunner_display_0', '../shellrunner.png');
    this.scene.load.image(
      'shellRunner_left_hand_0',
      `${breedPath}/leftFrontFoot/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'shellRunner_left_foot_0',
      `${breedPath}/leftHindFoot/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'shellRunner_tail_0',
      `${breedPath}/tails/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'shellRunner_head_0',
      `${breedPath}/heads/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'shellRunner_eyes_0',
      `${breedPath}/eyes/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'shellRunner_inner_shell_0',
      `${breedPath}/innerShells/${DEFAULT_PART}.png`
    );
    this.scene.load.image(
      'shellRunner_outer_shell_0',
      `${breedPath}/outerShells/${DEFAULT_PART}.png`
    );
  }

  // Requires use of this.scene.load.start in the case of calling anywhere outside a scene preload function.
  loadBootSceneAssets(): void {
    this.scene.load.maxParallelDownloads = 10;
    // Timeout is in ms. 10ms is too aggressive even for local dev.
    this.scene.load.xhr.timeout = 10000;
    this.scene.load.path = ASSETS_PREFIX_URL;

    this.scene.load.image('landscape-mode-white', 'landscape_mode_white.png');
    this.scene.load.image('logo', 'logo.png');
  }

  // Requires use of this.scene.load.start in the case of calling anywhere outside a scene preload function.
  loadGameSceneAssets(userNftMetaData: Array<IUserNftWithMetadata>): void {
    this.loadDefaultShellRunnerParts();

    this.scene.load.path = `${ASSETS_PREFIX_URL}shellrunner_components/`;
    userNftMetaData.forEach(
      (nftMetaData: IUserNftWithMetadata, index: number) => {
        const breedRaw = nftMetaData?.metadata?.attributes?.find(
          (attr) => attr.trait_type == 'breed'
        )?.value;
        const breed =
          Number(breedRaw) && Number.isFinite(Number(breedRaw))
            ? Number(breedRaw)
            : DEFAULT_BREED;

        const hands = nftMetaData?.metadata?.componentIndices?.hands ?? `${DEFAULT_PART}`;
        const legs = nftMetaData?.metadata?.componentIndices?.legs ?? `${DEFAULT_PART}`;
        const tail = nftMetaData?.metadata?.componentIndices?.tail ?? `${DEFAULT_PART}`;
        const head = nftMetaData?.metadata?.componentIndices?.head ?? `${DEFAULT_PART}`;
        const eyes = nftMetaData?.metadata?.componentIndices?.eyes ?? `${DEFAULT_PART}`;
        const shell = nftMetaData?.metadata?.componentIndices?.shell ?? `${DEFAULT_PART}`;
        const shellOuter = nftMetaData?.metadata?.componentIndices?.shellOuter ?? `${DEFAULT_PART}`;

        this.scene.load.image(
          `shellRunner_display_${index}`,
          // Always use local assets for the selection menu display image in dev.
          // The composed on-chain metadata image can be an IPFS gateway URL that
          // may be slow or missing during local testing.
          '../shellrunner.png'
        );
        this.scene.load.image(
          `shellRunner_left_hand_${index}`,
          `breed_${breed}/leftFrontFoot/${hands}.png`
        );
        this.scene.load.image(
          `shellRunner_left_foot_${index}`,
          `breed_${breed}/leftHindFoot/${legs}.png`
        );
        this.scene.load.image(
          `shellRunner_tail_${index}`,
          `breed_${breed}/tails/${tail}.png`
        );
        this.scene.load.image(
          `shellRunner_head_${index}`,
          `breed_${breed}/heads/${head}.png`
        );
        this.scene.load.image(
          `shellRunner_eyes_${index}`,
          `breed_${breed}/eyes/${eyes}.png`
        );
        this.scene.load.image(
          `shellRunner_inner_shell_${index}`,
          `breed_${breed}/innerShells/${shell}.png`
        );
        this.scene.load.image(
          `shellRunner_outer_shell_${index}`,
          `breed_${breed}/outerShells/${shellOuter}.png`
        );
      }
    );

    this.scene.load.path = `assets/audio/`;

    for (let i = 0, len = GAME_SOUNDS.length; i < len; ++i) {
      this.scene.load.audio(GAME_SOUNDS[i].key, [
        `${GAME_SOUNDS[i].path}.wav`,
      ]);
    }

    this.scene.load.path = ASSETS_PREFIX_URL;
    // Shell Runner
    // this.scene.load.image('shellRunner', shellRunnerUrl);
    this.scene.load.image('logo', 'logo.png');
    this.scene.load.image('shellRunner', 'shellrunner.png');
    this.scene.load.image('black_overlay', 'black_overlay.png');

    // BackDrop
    this.scene.load.path = `${ASSETS_PREFIX_URL}back/`;

    this.scene.load.image('water_1', 'water_1.png');

    this.scene.load.image('left_bank_1', 'left_bank_1.png');
    this.scene.load.image('grass_1', 'grass_1.png');

    this.scene.load.image('right_bank_1', 'right_bank_1.png');
    this.scene.load.image('grass_1', 'grass_1.png');

    this.scene.load.image('fill_grass', 'fill_grass.png');

    // Decor
    this.scene.load.path = `${ASSETS_PREFIX_URL}decorations/`;
    for (let i = 1; i <= 3; ++i) {
      this.scene.load.image(`leaf_${i}`, `leaf_${i}.png`);
    }

    this.scene.load.path = `${ASSETS_PREFIX_URL}obstacles/`;
    // River Obstacles
    for (let i = 1; i <= 6; ++i) {
      this.scene.load.image(`rock_${i}`, `rock_${i}.png`);
    }
    for (let i = 1; i <= 3; ++i) {
      this.scene.load.image(`log_${i}`, `log_${i}.png`);
    }

    this.scene.load.path = ASSETS_PREFIX_URL;

    this.scene.load.image('orange_star_fish', 'orange_star_fish.png');
    this.scene.load.image('yellow_star_fish', 'yellow_star_fish.png');
    this.scene.load.image('red_star_fish', 'red_star_fish.png');

    this.scene.load.image('movement_power', 'movement_power.png');
    this.scene.load.image('slow_scroll_power', 'slow_scroll_power.png');
    this.scene.load.image('invincibility_power', 'invincibility_power.png');

    // Particles
    this.scene.load.image('bubble', 'bubble.png');

    this.scene.load.path = `assets/prefabs/`;

    for (let i = 0; i < PREFABS.length; ++i) {
      this.scene.load.json(PREFABS[i], `${PREFABS[i]}.json`);
    }

    this.scene.load.path = `${ASSETS_PREFIX_URL}ui/`;

    // Main Menu
    this.scene.load.image('end_menu_button', 'end_menu_button.png');
    this.scene.load.image('main_menu_popup', 'main_menu_popup.png');
    this.scene.load.image('no_button', 'no_button.png');
    this.scene.load.image('yes_button', 'yes_button.png');

    // Power Up
    this.scene.load.image('power_up_base_outer', 'power_up_base_outer.png');
    this.scene.load.image('power_up_base_inner', 'power_up_base_inner.png');

    // Side Bar
    this.scene.load.image('pause_button', 'pause.png');
    this.scene.load.image('resume_button', 'resume.png');
    this.scene.load.image('side_bar', 'side_bar.png');
    this.scene.load.image('menu_button', 'menu_button.png');
    this.scene.load.image('sound_off', 'sound_off.png');
    this.scene.load.image('sound_on', 'sound_on.png');

    // Core UI
    this.scene.load.image('lives', 'lives.png');
    this.scene.load.image('core_ui', 'core_ui.png');
    this.scene.load.image('hunger_bar_base', 'hunger_bar_base.png');
    this.scene.load.image('hunger_bar_white', 'hunger_bar_white.png');
    this.scene.load.image('hunger_bar_green', 'hunger_bar_green.png');
    this.scene.load.image('hunger_bar_yellow', 'hunger_bar_yellow.png');
    this.scene.load.image('hunger_bar_orange', 'hunger_bar_orange.png');
    this.scene.load.image('hunger_bar_red', 'hunger_bar_red.png');

    // Result UI
    this.scene.load.image('mint_shellrunner', 'mint_shellrunner.png');
    this.scene.load.image('play_again', 'play_again.png');

    // Shell Runner Selection
    this.scene.load.image('left_arrow', 'left_arrow.png');
    this.scene.load.image('start_button', 'start_button.png');

    // this.scene.load.atlas('flares', 'flares.png', 'flares.json');

    // this.scene.load.spritesheet('win-particle', 'win/coin.png', {
    //   frameWidth: 200,
    //   frameHeight: 200,
    //   startFrame: 0,
    //   endFrame: 30,
    // });

    // this.scene.load.bitmapFont(
    //   'win-counter-font',
    //   'bitmapFonts/win-counter.png',
    //   'bitmapFonts/win-counter.xml'
    // );
    this.scene.load.start();
  }

  createAnimations(): void { }
}
