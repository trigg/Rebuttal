import { type rebuttal } from '../server.ts';

export interface pluginInterface {
    pluginName: string;
    start(server: rebuttal): Promise<void>;
}
