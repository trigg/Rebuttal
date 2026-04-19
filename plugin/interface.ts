import { type rebuttal } from '../server.ts';

export interface pluginInterface {
    plugin_name: string;
    start(server: rebuttal): Promise<void>;
}
