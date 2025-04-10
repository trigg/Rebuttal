'use strict';
const server = require('./server.js');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json'));

(async () => {
    await server.create(config);
    server.server.listen(server.port, '0.0.0.0');
})();
