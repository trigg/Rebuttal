/*
  Plugin to have the client accessible via browser on the server.

  Will allow a lower bar to join chat but some features may not be possible if this is the primary client
*/
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
    pluginName: "webclient",
    server: null,
    themelist: null,
    start: function (server) {
        this.server = server;
        this.themelist = [];

        // Enumerate all themes on the server side
        fs.readdirSync(path.join(__dirname, '..', 'client', 'public', 'img'), { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .forEach(entry => {
                var themefile = path.join(__dirname, '..', 'client', 'public', 'img', entry.name, 'theme.json');
                if (fs.existsSync(themefile)) {
                    var data = JSON.parse(fs.readFileSync(themefile));
                    data.id = entry.name;
                    this.themelist.push(data);
                }
            });
        console.log("Webclient started");

        // Allow access to the client files
        server.app.use('/', express.static('../client/public/'));

        // Inject themes into welcomeObj
        server.event.listen('connectionnew', this.event.priority.NORMAL, function (event) {
            event.welcomeObj.themelist = this.themelist;
        });
    }
};

module.exports = plugin;