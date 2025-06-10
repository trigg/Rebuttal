/*
  Plugin to have the client accessible via browser on the server.

  Will allow a lower bar to join chat but some features may not be possible if this is the primary client
*/
import fs from 'fs';
import express from 'express';
import path from 'path';
import event, { Priority, type Event } from '../events.ts';

import { type pluginInterface } from './interface.ts';
import { type rebuttal } from '../server.ts';

interface Theme {
    name: string;
    description: string;
    id?: string;
}

export const webclientplugin: pluginInterface = {
    pluginName: 'webclient',
    // eslint-disable-next-line @typescript-eslint/require-await
    start: async (server: rebuttal) => {
        const themelist: Theme[] = [];

        // Enumerate all themes on the server side
        fs.readdirSync(path.join('webapp', 'dist', 'img'), {
            withFileTypes: true,
        })
            .filter((entry) => entry.isDirectory())
            .forEach((entry) => {
                const themefile = path.join(
                    'webapp',
                    'dist',
                    'img',
                    entry.name,
                    'theme.json',
                );
                if (fs.existsSync(themefile)) {
                    const string = fs.readFileSync(themefile).toString();
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const data: Theme = JSON.parse(string);
                    data.id = entry.name;
                    themelist.push(data);
                }
            });
        console.log('Webclient started');

        // Allow access to the client files
        server.app.use('/', express.static('webapp/dist/'));

        // Inject themes into welcomeObj
        event.listen('connectionnew', Priority.NORMAL, (event: Event) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            event.welcomeObj.themelist = themelist;
        });
    },
};
export default webclientplugin;
