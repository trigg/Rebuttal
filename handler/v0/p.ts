import { protocolv1 } from '../v1/p.ts';
import event from '../../events.ts';
import { type rebuttalSocket, type rebuttal } from '../../server.ts';
import { type v0_cts_packet } from '../../protocols/v0/client_to_server.ts';
import { createCheckers } from 'ts-interface-checker';
import v0_cts_iface from '../../protocols/v0/client_to_server-ti.ts';
import { v4 as uuidv4 } from 'uuid';

const checker = createCheckers(v0_cts_iface);

/* Heavy handed get an error message to user and close connection */
function invalid_packet(server: rebuttal, socket: rebuttalSocket, data: unknown) {
    if (!(data instanceof Object && 'type' in data && typeof data.type == 'string')) {
        console.log("v0 got malformed packet : ");
        console.log(data);
        return;
    }
    console.log('v0 got malformed packet : ' + data.type);
    console.log(JSON.stringify(data));

    const issues = checker.v0_cts_packet.validate(data);
    if (issues != null) {
        server.chase(issues);
    }

    server.sendTo(socket, {
        type: 'error',
        message: 'Malformed packet of type : "' + data.type + '"',
    });
    socket.close(
        3001,
        'Malformed packet of type : "' + data.type + '"',
    );
}

export const protocolv0 = {
    handle: async function (
        server: rebuttal,
        socket: rebuttalSocket,
        data: unknown,
    ) {
        if (!checker.v0_cts_packet.test(data)) {
            invalid_packet(server, socket, data);
            return
        }
        const packet = data as v0_cts_packet;
        switch (packet.type) {
            case 'signup':
                {

                    console.log('Checking invite');
                    let group = null;
                    if (packet.signUp === 'signup') {
                        if ('infinitesignup' in server.config) {
                            group = server.config.infinitesignup;
                        }
                    } else {
                        group = await server.storage.expendSignUp(
                            packet.signUp,
                        );
                    }
                    if (group) {
                        const event_return = await event.trigger('usercreate', {
                            userName: packet.userName,
                            cancelled: false,
                        });

                        // In this case we don't use FINAL event as it won't have email/password
                        // If we put email/password in the event it'll be plaintext for every plugin
                        // I simply don't feel that is right
                        if (!event_return.cancelled) {
                            console.log('Created user');
                            const user_uuid = uuidv4();
                            await server.storage.createAccount({
                                id: user_uuid,
                                name: packet.userName,
                                passwordHash: '',
                                email: packet.email,
                                group,
                            }, packet.password);

                            server.sendTo(socket, { type: 'refreshNow' });
                        } else {
                            console.log('Invite denied by plugin');
                            server.sendTo(socket, {
                                type: 'error',
                                message:
                                    'Signup permission denied by plugin',
                            });
                        }
                    } else {
                        console.log('Invite invalid');
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Signup code expired or invalid',
                        });
                    }

                }
                return;
            case 'login':
                {
                    if (packet.email && packet.password && packet.protocol) {
                        const user = await server.storage.getAccountByLogin(
                            packet.email,
                            packet.password,
                        );
                        if (!server.protocols.includes(packet.protocol)) {
                            server.sendTo(socket, {
                                type: 'error',
                                message: 'Invalid protocol selected',
                            });
                            socket.close(3001, 'Invalid protocol selected');
                        }
                        socket.protocol_version = packet.protocol;
                        if (user) {
                            const allow = await event.trigger('userauth', {
                                userUuid: user.id,
                                userName: user.name,
                            });
                            // As before, avoiding FINAL event as we can't allow plain-text passwords to be seen by plugin
                            if (!allow.cancelled) {
                                socket.name = user.name;
                                socket.id = user.id;

                                server.connections.push(socket);
                                switch (packet.protocol) {
                                    case 'v0':
                                        server.sendTo(socket, {
                                            type: 'error',
                                            message:
                                                'Cannot switch from v0 to v0',
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
                                            message:
                                                'Invalid protocol selected',
                                        });
                                        socket.close(
                                            3001,
                                            'Invalid protocol selected',
                                        );
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
                    } else {
                        server.sendTo(socket, {
                            type: 'error',
                            message: 'Malformed login',
                        });
                        socket.close(3001, 'Malformed login');
                    }
                }
                return;
        }
        invalid_packet(server, socket, data);

    },
};
export default protocolv0;
