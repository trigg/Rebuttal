/*
  Plugin to have the client accessible via browser on the server.

  Will allow a lower bar to join chat but some features may not be possible if this is the primary client
*/
import fs from 'fs';
import express from 'express';

import { type pluginInterface } from './interface.ts';
import { type rebuttal } from '../server.ts';

export const webclientplugin: pluginInterface = {
    pluginName: 'webclient',
    // eslint-disable-next-line @typescript-eslint/require-await
    start: async (server: rebuttal) => {
        // Check if we have a webapp

        if (fs.existsSync("webapp")) {
            console.log('Webclient started');

            // Allow access to the client files
            server.app.use('/', express.static('webapp/dist/'));

        } else {
            console.log("No Webapp content present");
            return;
        }
        return;
    },
};
export default webclientplugin;
