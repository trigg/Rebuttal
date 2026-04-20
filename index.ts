'use strict';
import { type config, create_rebuttal } from './server.ts';
import fs from 'fs';
import { env } from 'process';
import segfaultHandler from 'node-segfault-handler';

segfaultHandler.registerHandler(undefined);
if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
}
const default_config = {
    port: 9000,
    storage: env['REBUTTAL_STORAGE'] ? env['REBUTTAL_STORAGE'] : 'sqlite',
    plugins: env['REBUTTAL_PLUGINS'] ? env['REBUTTAL_PLUGINS'].split(" ") : ['webclient'],
    certpath: 'cert.pem',
    keypath: 'key.pem',
    servername: env['REBUTTAL_NAME'] ? env['REBUTTAL_NAME'] : "Rebuttal",
    serverimg: 'img/logo.svg',
    gravatarfallback: env['REBUTTAL_AVATARS'] ? env['REBUTTAL_AVATARS'] : 'monsterid',
    infinitesignup: env['REBUTTAL_INFINITE_SIGNUP'] ? env['REBUTTAL_INFINITE_SIGNUP'] : undefined,
    test_mode: false
};
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const file_config = (fs.existsSync('./config.json') ? JSON.parse(
    fs.readFileSync('./config.json').toString(),
) : default_config) as config;
const rebuttal = await create_rebuttal(file_config);
rebuttal.listen(rebuttal.port, '0.0.0.0', () => { });
