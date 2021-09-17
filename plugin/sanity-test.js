/*
    This plugin will cover testing and when I can be bothered I'll put up a continuous integration pipeline 
    that keys off of tests written in this plugin
*/
var plugin = {
    pluginName: "sanity-test",
    server: null,
    start: function (server) {
        this.server = server;
        console.log("Doing an event sanity test");
        var eventstage = -1;
        server.event.register('testevent');
        server.event.listen('testevent', server.event.priority.MONITOR, function (e) {
            console.log("Sanity test-  should be last");
            if (eventstage >= server.event.priority.MONITOR) {
                throw new Error('Event priorities called out of order');
            }
            if (eventstage === 0) {
                throw new Error('Event priority MONITOR called first');
            }
            eventstage = server.event.priority.MONITOR;
        })
        server.event.listen('testevent', server.event.priority.EARLY, function (e) {
            console.log("Sanity test-  should be first");
            if (eventstage >= server.event.priority.EARLY) {
                throw new Error('Event priorities called out of order');
            }

            eventstage = server.event.priority.EARLY;
        })
        server.event.listen('testevent', server.event.priority.LATE, function (e) {
            console.log("Sanity test-  should be middle");
            if (eventstage >= server.event.priority.LATE) {
                throw new Error('Event priorities called out of order');
            }
            eventstage = server.event.priority.LATE;
        })

        server.event.trigger('testevent', {});



        console.log("All tests successful. Exiting");
        process.exit(0);
    }
};

module.exports = plugin;