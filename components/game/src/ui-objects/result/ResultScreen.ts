import { CAM_CENTER } from "../../cfg/constants/design-constants";
import { CUSTOM_EVENTS, GAME_FONT } from "../../cfg/constants/game-constants";
import { TWEEN_EASING } from "../../cfg/constants/static-constants";
import { AbstractScene } from "../../scenes/AbstractScene";
import { PlayAgainButton } from "./PlayAgainButton";

export class ResultScreen extends Phaser.GameObjects.Container {
  scene: AbstractScene;
  events: Phaser.Events.EventEmitter;

  overlay!: Phaser.GameObjects.Image;

  highScoreTitleText!: Phaser.GameObjects.Text;
  highScoreText!: Phaser.GameObjects.Text;

  yourScoreTitleText!: Phaser.GameObjects.Text;
  yourScoreText!: Phaser.GameObjects.Text;

  travelledTitleText!: Phaser.GameObjects.Text;
  travelledText!: Phaser.GameObjects.Text;

  goToHome!: Phaser.GameObjects.Text;
  playAgainButton!: PlayAgainButton;

  mintShellRunnerImage!: Phaser.GameObjects.Image;
  mintShellRunnerText!: Phaser.GameObjects.Text;
  noMintInfoText!: Phaser.GameObjects.Text;

  isMintEnabled = false;
  private lastScore = 0;
  private hasShellRunnerNft = false;

  constructor(scene: AbstractScene) {
    super(scene, CAM_CENTER.x, CAM_CENTER.y);
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();
    this.addOverlay();
    this.addTexts();
    this.addCTA();
    this.addMintShellRunner();
    this.scene.add.existing(this);
  }

  private addOverlay() {
    this.overlay = this.scene.add.image(0, 0, 'black_overlay');
    this.overlay.setOrigin(0.5);
    this.overlay.setAlpha(0.15);
    this.overlay.setDisplaySize(
      this.scene.grs.designDim.width * 0.6,
      this.scene.grs.designDim.height * 0.6
    );
    this.add(this.overlay);
  }

  private addTexts() {
    const titleConfig = {
      fontFamily: GAME_FONT,
      fontSize: '24px',
      resolution: 3,
      color: '#FFFFFF',
    }

    this.highScoreTitleText = this.scene.add.text(this.overlay.getTopLeft().x + 36, this.overlay.getTopLeft().y + 48, 'HIGH SCORE:', titleConfig).setAlign('center').setOrigin(0, 0.5);
    this.highScoreText = this.scene.add.text(this.highScoreTitleText.getTopRight().x + 15, this.overlay.getTopLeft().y + 48, '9000', { ...titleConfig, fontSize: '30px' }).setAlign('center').setOrigin(0, 0.5);

    const yourScoreTextStartX = this.overlay.getTopCenter().x + this.overlay.displayWidth * 0.20;
    const yourScoreTextStartY = this.overlay.getTopCenter().y + this.overlay.displayHeight * 0.3;

    this.yourScoreTitleText = this.scene.add.text(yourScoreTextStartX, yourScoreTextStartY, 'YOUR SCORE', titleConfig).setAlign('center').setOrigin(0.5, 0.5);
    this.yourScoreText = this.scene.add.text(yourScoreTextStartX, yourScoreTextStartY + 80, '9999', { ...titleConfig, fontSize: '96px' }).setAlign('center').setOrigin(0.5, 0.5);

    this.travelledTitleText = this.scene.add.text(yourScoreTextStartX - 120, yourScoreTextStartY + 170, 'TRAVELLED:', titleConfig).setAlign('center').setOrigin(0, 0.5);
    this.travelledText = this.scene.add.text(this.travelledTitleText.getTopRight().x + 15, yourScoreTextStartY + 170, '400m', titleConfig).setAlign('center').setOrigin(0, 0.5);

    this.add([
      this.highScoreTitleText,
      this.highScoreText,
      this.yourScoreTitleText,
      this.yourScoreText,
      this.travelledTitleText,
      this.travelledText,
    ]);
  }

  private addCTA() {
    const titleConfig = {
      fontFamily: GAME_FONT,
      fontSize: '30px',
      resolution: 3,
      color: '#FFFFFF',
    }

    this.goToHome = this.scene.add.text(this.overlay.getBottomCenter().x + 75, this.overlay.getBottomCenter().y - 80, 'Go to Home', titleConfig).setAlign('center').setOrigin(0.5, 0.5);
    this.goToHome.setInteractive();
    this.goToHome.on('pointerdown', () => {
      // Sharing playAgainButton state
      if (!this.playAgainButton.isEnabled) {
        return;
      }
      this.playAgainButton.isEnabled = false;
      this.events.emit(CUSTOM_EVENTS.GO_TO_HOME_CLICKED);
    });
    this.playAgainButton = new PlayAgainButton(this.scene, this.overlay.getBottomCenter().x + 375, this.overlay.getBottomCenter().y - 80);

    this.add([
      this.goToHome,
      this.playAgainButton,
    ]);
  }

  private playShellRunnersTween() {
    this.scene.tweens.add({
      targets: [this.mintShellRunnerImage, this.mintShellRunnerText],
      duration: 125,
      scale: 1.15,
      easing: TWEEN_EASING.BACK_EASE_OUT,
      yoyo: true,
      easeParams: [2.7],
      onYoyo: () => {
        this.mintShellRunnerImage.setAlpha(0.6);
        this.scene.audioManager.play('shellRunnerMint');
        this.mintShellRunnerText.text = this.hasShellRunnerNft
          ? 'Update confirmed.\nYour Shell Runner metadata is updated.'
          : 'Mint confirmed.\nYour Shell Runner NFT is now in your wallet.';
      }
    })
  }

  private addMintShellRunner() {
    const titleConfig = {
      fontFamily: GAME_FONT,
      fontSize: '30px',
      resolution: 3,
      color: '#FFFFFF'
    }
    this.mintShellRunnerImage = this.scene.add.image(this.overlay.getLeftCenter().x + this.overlay.displayWidth * 0.3, 0, 'mint_shellrunner');
    this.mintShellRunnerText = this.scene.add.text(this.mintShellRunnerImage.getBottomCenter().x, 150, 'Mint New Shell Runner', titleConfig).setAlign('center').setOrigin(0.5, 0.5);

    this.noMintInfoText = this.scene.add
      .text(
        this.mintShellRunnerText.x,
        this.mintShellRunnerText.y,
        'No new high score this run.\nNo new Shell Runner can be minted.',
        {
          fontFamily: GAME_FONT,
          fontSize: '22px',
          resolution: 3,
          color: '#D0D0D0',
        }
      )
      .setAlign('center')
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.mintShellRunnerText.setInteractive();
    this.mintShellRunnerText.on('pointerdown', async () => {
      // Sharing playAgainButton state
      if (!this.isMintEnabled) {
        return;
      }

      this.isMintEnabled = false;
      this.mintShellRunnerText.disableInteractive();
      this.mintShellRunnerText.text = this.hasShellRunnerNft
        ? 'Updating...\nConfirm in your wallet.'
        : 'Minting...\nConfirm in your wallet.';

      const ok = await this.scene.initGameData.mintShellRunnersCB(this.lastScore);
      if (ok) {
        // Update the in-game high score so subsequent deaths can't mint again
        // unless a new high score is achieved.
        this.scene.initGameData.highScore = Math.max(
          this.scene.initGameData.highScore,
          this.lastScore
        );
        this.highScoreText.text = `${this.scene.initGameData.highScore}`;
        this.scene.initGameData.hasShellRunnerNft = true;
        this.hasShellRunnerNft = true;
        this.playShellRunnersTween();
      } else {
        const titleConfigFail = {
          fontFamily: GAME_FONT,
          fontSize: '24px',
          resolution: 3,
          color: '#FFDDDD'
        };
        this.mintShellRunnerText.setStyle(titleConfigFail);
        this.mintShellRunnerText.text = 'Mint failed.\nTry again.';
        this.mintShellRunnerImage.setAlpha(1);
        this.isMintEnabled = true;
        this.mintShellRunnerText.setInteractive();
        return;
      }
      this.events.emit(CUSTOM_EVENTS.MINT_SHELLRUNNERS);
    });
    this.add([
      this.mintShellRunnerImage,
      this.mintShellRunnerText,
      this.noMintInfoText,
    ]);
  }

  updateResultDetails(resultDetails: { highScore: number, isMintable: boolean, travelled: string, score: string, hasShellRunnerNft: boolean }): void {
    this.highScoreText.text = `${resultDetails.highScore}`;
    this.yourScoreText.text = resultDetails.score;
    this.travelledText.text = resultDetails.travelled;
    this.lastScore = Number(resultDetails.score) || 0;
    this.hasShellRunnerNft = !!resultDetails.hasShellRunnerNft;
    if (resultDetails.isMintable) {
      const titleConfig = {
        fontFamily: GAME_FONT,
        fontSize: '30px',
        resolution: 3,
        color: '#FFFFFF'
      }
      this.mintShellRunnerImage.setVisible(true).setAlpha(1);
      this.mintShellRunnerText.setVisible(true);
      this.noMintInfoText.setVisible(false);
      this.mintShellRunnerText.text = this.hasShellRunnerNft
        ? 'Tap to Update Shell Runner!'
        : 'Tap to Mint Shell Runner!';
      this.mintShellRunnerText.setStyle(titleConfig);
      this.mintShellRunnerText.y = 0;
      this.isMintEnabled = true;
      this.mintShellRunnerText.setInteractive();
      // touch enabled
    } else {
      // No CTA unless the player actually beat their previous high score.
      this.mintShellRunnerImage.setVisible(false);
      this.mintShellRunnerText.setVisible(false);
      this.noMintInfoText.setVisible(true);
      this.isMintEnabled = false;
      this.mintShellRunnerText.disableInteractive();
      // touch disabled
    }
  }

  showResultScreen() {
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      ease: TWEEN_EASING.BACK_EASE_OUT,
      duration: 350,
      onStart: () => {
        this.setScale(0);
        this.setVisible(true);
      },
      onComplete: () => {
        this.playAgainButton.isEnabled = true;
      }
    });
  }

  hideResultScreen() {
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      ease: TWEEN_EASING.BACK_EASE_IN,
      duration: 250,
      onStart: () => {
        this.playAgainButton.isEnabled = false;
        this.isMintEnabled = false;
        this.mintShellRunnerImage.setVisible(true);
        this.mintShellRunnerText.setVisible(true);
      },
      onComplete: () => {
        this.setVisible(false);
      }
    });
  }
}
