`use strict`;
const express = require('express');
var plugin = {
    server: null,
    start: function (server) {
        this.server = server;
        console.log("Webhook started");
        server.app.use('/webhook/', express.json({
            verify: (req, res, buf, encoding) => {
                if (buf && buf.length) {
                    req.rawBody = buf.toString(encoding || 'utf8');
                }
            }
        }));
        server.app.use('/webhook/', express.urlencoded({
            extended: true
        }));
        server.app.post("/webhook/", (req, res) => {
            console.log("Incomming webhook");
            var room = this.getRoomForHash(req.header('X-Hub-Signature-256'), req.rawBody);
            if (!room || room === null) {
                console.log("Webhook payload rejected");
                res.status(404).end();
                return;
            }
            var payload;
            if (req.body.payload) {
                payload = JSON.parse(req.body.payload)
            } else {
                payload = req.body;
            }
            if (!payload) {
                console.log(req.body);
                return;
            }
            var m = '';
            if (payload.action) {
                switch (payload.action) {
                    case "opened":
                        m = "Opened Issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                        if (payload.issue.body && payload.issue.body !== '') {
                            m += "  \n" + payload.issue.body;
                        }
                        var message = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                        break;
                    case "labeled":
                        m = "Changed labels on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                        var message = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                        break;
                    case "created": // Commented
                        m = "Commented on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                        if (payload.comment.body) {
                            m += payload.comment.body.replaceAll("\r\n", "  \n");
                        }
                        var message = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                        break;
                    case "edited":
                        m = "Edited comment on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                        var message = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                    case "deleted":
                        m = "Deleted comment on issue : '" + payload.issue.title + "' in " + payload.repository.full_name;
                        var message = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                    case "started":
                        m = "Starred " + payload.repository.full_name;
                        var message = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.repository.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                        break;
                    case "closed":
                        m = "Closed '" + payload.issue.title + "' on " + payload.repository.full_name;
                        var messag = {
                            type: 'webhook',
                            avatar: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.url
                        }
                        server.storage.addNewMessage(room.id, message);
                        server.sendUpdatesMessages(room.id);
                        break;
                    default:
                        console.log(payload);
                        break;
                }
            } else if (payload.commits) {
                m = "Pushed commits to " + payload.repository.full_name;
                payload.commits.forEach(commit => {
                    m += "\n```\n" + commit.message + "\n```";
                })
                var message = {
                    type: 'webhook',
                    avatar: payload.sender.avatar_url,
                    username: payload.sender.login,
                    text: m,
                    url: payload.repository.url
                }
                server.storage.addNewMessage(room.id, message);
                server.sendUpdatesMessages(room.id);

            } else if (payload.forkee) {
                m = "Project " + payload.forkee.full_name + " forked from " + payload.repository.full_name;
                var message = {
                    type: 'webhook',
                    avatar: payload.sender.avatar_url,
                    username: payload.sender.full_name,
                    text: m,
                    url: payload.forkee.url
                }
                server.storage.addNewMessage(room.id, message);
                server.sendUpdatesMessages(room.id);

            } else {
                // No idea what it is
                console.log(payload);
            }

            res.status(200).end();
        });
    },
    getRoomForHash: function (hash, payload) {
        var r = null;

        this.server.storage.getAllRooms().forEach(room => {
            if (room.type == 'text') {
                var hmac = crypto.createHmac('sha256', room.id);
                var roomHash = "sha256=" + hmac.update(payload).digest('hex');
                if (roomHash === hash) {
                    r = room;
                }
            }
        })
        return r;
    }
}
module.exports = plugin;