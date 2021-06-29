const shell = require('shelljs');
const fs = require('fs');
const express = require('express');

// Get client
if (!fs.existsSync('client')) {
    shell.exec('git clone https://github.com/trigg/Rebuttal-Client.git client');
}
// Update it
shell.cd('client');
shell.exec('git pull');

var plugin = {
    server: null,
    start: function (server) {
        this.server = server;
        console.log("Webclient started");
        server.app.use('/', express.static('../client/public/'));
    }
};

module.exports = plugin;