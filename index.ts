'use strict';
import { type config, create_rebuttal } from './server.ts';
import fs from 'fs';
const config = JSON.parse(
    fs.readFileSync('./config.json').toString(),
) as config;

const rebuttal = await create_rebuttal(config);
rebuttal.listen(rebuttal.port, '0.0.0.0', () => {});
