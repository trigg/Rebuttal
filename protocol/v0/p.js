const { v4: uuidv4 } = require('uuid');
const protocolv1 = require('../v1/p');

var protocolv0 = {
    handle: async function (server, socket, data) {
        var allow;
        const { type, userName, email, password, signUp, protocol } = data;
        switch (type) {
            case 'signup':
                // Put effort into matching the same checks from client side
                if (
                    password &&
                    email &&
                    userName &&
                    signUp &&
                    email.indexOf('@') > -1 &&
                    email.indexOf('.') > -1 &&
                    userName.match(/^[a-zA-Z0-9-_ ]+$/) &&
                    userName.length >= 3 &&
                    password.length >= 7
                ) {
                    console.log('Checking invite');
                    var group = null;
                    if (
                        'infinitesignup' in server.config &&
                        signUp === 'signup'
                    ) {
                        group = server.config.infinitesignup;
                    } else {
                        group = await server.storage.expendSignUp(signUp);
                    }
                    if (group) {
                        allow = await server.event.trigger('usercreate', {
                            userName,
                            userUuid,
                        });
                        // In this case we don't use FINAL event as it won't have email/password
                        // If we put email/password in the event it'll be plaintext for every plugin
                        // I simply don't feel that is right
                        if (allow) {
                            console.log('Created user');
                            var userUuid = uuidv4();
                            await server.storage.createAccount({
                                id: userUuid,
                                name: userName,
                                password,
                                email,
                                group,
                            });

                            server.sendTo(socket, { type: 'refreshNow' });
                        } else {
                            console.log('Invite denied by plugin');
                            server.sendTo(socket, {
                                type: 'error',
                                message: 'Signup permission denied by plugin',
                            });
                        }
                    } else {
                        console.log('Invite invalid');
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Signup code expired or invalid',
                        });
                    }
                } else {
                    console.log('Not enough details to create account');
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Not enough info',
                    });
                }

                break;
            case 'login':
                var user = await server.storage.getAccountByLogin(
                    email,
                    password,
                );
                if (!server.protocols.includes(protocol)) {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Invalid protocol selected',
                    });
                    socket.close(3001, 'Invalid protocol selected');
                }
                socket.protocol_version = protocol;
                if (user) {
                    allow = await server.event.trigger('userauth', {
                        userUuid: user.id,
                        userName: user.name,
                    });
                    // As before, avoiding FINAL event as we can't allow plain-text passwords to be seen by plugin
                    if (allow) {
                        socket.name = user.name;
                        socket.id = user.id;

                        server.connections.push(socket);
                        switch (protocol) {
                            case 'v0':
                                server.sendTo(socket, {
                                    type: 'error',
                                    message: 'Cannot switch from v0 to v0',
                                });
                                socket.close(
                                    3001,
                                    'Cannot switch from v0 to v0',
                                );
                                break;
                            case 'v1':
                                await protocolv1.switch_protocol(
                                    server,
                                    socket,
                                    user,
                                );
                                break;
                            default:
                                server.sendTo(socket, {
                                    type: 'error',
                                    message: 'Invalid protocol selected',
                                });
                                socket.close(3001, 'Invalid protocol selected');
                                break;
                        }
                    } else {
                        console.log('User login denied by plugin');
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Permission denied',
                        });
                    }
                } else {
                    server.sendTo(socket, {
                        type: 'error',
                        message: 'Permission denied',
                    });
                    socket.close(3001, 'Permission denied');
                }
                break;
            default:
                console.log('v0 does not handle packet type : ' + type);
                server.sendTo(socket, {
                    type: 'error',
                    message: 'Unknown packet type : "' + type + '"',
                });
                socket.close(3001, 'Unknown packet type : "' + type + '"');
        }
    },
};
module.exports = protocolv0;
