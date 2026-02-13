export interface IInitGameData {
    initMetaData: Array<IUserNftWithMetadata>;
    highScore: number;
    isEmbedded?: boolean;
    endGameCB: (score: number, metersTravelled: number, choseToMint?: boolean) => void;
    mintShellRunnersCB: (score: number) => Promise<boolean>;
    goHomeCB: () => void;
    // Game mints exactly once; subsequent improvements upgrade the existing NFT.
    hasShellRunnerNft?: boolean;
    snapshotIntervalMs?: number;
    snapshotScoreCB?: (score: number) => void;
    sessionStartCB?: () => void;
    exitToCoreCB?: () => void;
}
