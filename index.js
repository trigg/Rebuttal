'use strict';
const config = require('./config.json');
const server = require('./server');
server.create(config)
server.server.listen(server.port, '0.0.0.0');