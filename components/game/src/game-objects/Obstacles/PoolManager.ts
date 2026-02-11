import { CAM_CENTER } from "../../cfg/constants/design-constants";
import { PREFABS } from "../../cfg/constants/game-constants";
import { AbstractScene } from "../../scenes/AbstractScene";
import { ObstacleGroup } from "./ObstacleGroup";

export class PoolManager {
    scene: AbstractScene;

    pool: Map<string, Array<ObstacleGroup>> = new Map();

    constructor(scene: AbstractScene) {
        this.scene = scene;
    }

    get(obsKey: string): ObstacleGroup | undefined {
        if (this.pool.has(obsKey)) {
            const pool = this.pool.get(obsKey)!;
            if (pool.length) {
                return pool.pop()!;
            }
        } else {
            this.pool.set(obsKey, []);
        }
        return undefined;
    }

    put(obs: ObstacleGroup) {
        const pool = this.pool.get(obs.name)!;
        pool.push(obs);
    }
}
