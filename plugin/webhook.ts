/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// TODO Come back to clean up webhook typing
import express from 'express';
import crypto from 'crypto';
import { type pluginInterface } from './interface.ts';
import event, { Priority } from '../events.ts';
import { type rebuttal } from '../server.ts';
import { type RoomStorage, type MessageStorage } from '../storage/interface.ts';

type WebhookPlugin = pluginInterface & {
    getRoomForHash(hash: string, payload: string): Promise<RoomStorage | null>;
    server: rebuttal | null;
};

export const webhookplugin: WebhookPlugin = {
    pluginName: 'webhook',
    server: null,

    // eslint-disable-next-line @typescript-eslint/require-await
    start: async function (server: rebuttal) {
        this.server = server;
        // Listen for serverprep - before start
        event.listen('serverprep', Priority.NORMAL, () => {
            // Add a context menu option to text rooms
            server.contextmenu.textroom.push({
                label: 'Manage Webhooks',
                permissionRequired: 'renameRoom', //TODO Not this
                option: 'managewebhooks',
            });
        });
        // Listen for users clicking a context menu item
        event.listen(
            'usercontextmenucallback',
            Priority.NORMAL,
            (event: any) => {
                const { option, value, ref } = event;
                if (option === 'managewebhooks') {
                    // Show Gui managing webhooks
                    const window = {
                        type: 'div',
                        children: [
                            {
                                type: 'input',
                                inputtype: 'button',
                                value: 'Regenerate webhook',
                            },
                            {
                                type: 'input',
                                inputtype: 'hidden',
                                value,
                            },
                            {
                                type: 'span',
                                text: '',
                            },
                        ],
                    };
                    server.presentCustomWindow(ref, window);
                }
            },
        );

        console.log('Webhook started');

        server.app.use(
            '/webhook/',
            express.json({
                verify: (req, res, buf, encoding) => {
                    if (encoding !== 'utf8') {
                        throw new Error('Webhook not utf-8');
                    }
                    //if (buf && buf.length) {
                    //    req.rawBody = buf.toString('utf8');
                    //}
                },
            }),
        );
        server.app.use(
            '/webhook/',
            express.urlencoded({
                extended: true,
            }),
        );
        server.app.post('/webhook/', async (req, res) => {
            console.log('Incomming webhook');
            const xhub_sig = req.header('X-Hub-Signature-256');
            if (!xhub_sig) {
                return;
            }
            const rawBody = req.body;
            const room = await webhookplugin.getRoomForHash(xhub_sig, rawBody);
            if (!room || room === null) {
                console.log('Webhook payload rejected');
                res.status(404).end();
                return;
            }
            let payload: any;
            if (req.body.payload) {
                payload = JSON.parse(req.body.payload);
            } else {
                payload = req.body;
            }
            if (!payload) {
                console.log(req.body);
                return;
            }
            let m = '';
            let message;
            if ('action' in payload) {
                switch (payload.action) {
                    case 'opened':
                        m =
                            "Opened Issue : '" +
                            payload.issue.title +
                            "' in " +
                            payload.repository.full_name;
                        if (payload.issue.body && payload.issue.body !== '') {
                            m += '  \n' + payload.issue.body;
                        }
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    case 'labeled':
                        m =
                            "Changed labels on issue : '" +
                            payload.issue.title +
                            "' in " +
                            payload.repository.full_name;
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    case 'created': // Commented
                        m =
                            "Commented on issue : '" +
                            payload.issue.title +
                            "' in " +
                            payload.repository.full_name;
                        if (payload.comment.body) {
                            m += payload.comment.body.replaceAll(
                                '\r\n',
                                '  \n',
                            );
                        }
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    case 'edited':
                        m =
                            "Edited comment on issue : '" +
                            payload.issue.title +
                            "' in " +
                            payload.repository.full_name;
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    case 'deleted':
                        m =
                            "Deleted comment on issue : '" +
                            payload.issue.title +
                            "' in " +
                            payload.repository.full_name;
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    case 'started':
                        m = 'Starred ' + payload.repository.full_name;
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.repository.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    case 'closed':
                        m =
                            "Closed '" +
                            payload.issue.title +
                            "' on " +
                            payload.repository.full_name;
                        message = {
                            type: 'webhook',
                            img: payload.sender.avatar_url,
                            username: payload.sender.login,
                            text: m,
                            url: payload.issue.html_url,
                        } as MessageStorage;
                        await server.storage.addNewMessage(room.id, message);
                        await server.sendUpdatesMessages(room.id);
                        break;
                    default:
                        console.log(payload);
                        break;
                }
            } else if (payload.commits) {
                m = 'Pushed commits to ' + payload.repository.full_name;
                for (const commit of payload.commits) {
                    m += '\n```\n' + commit.message + '\n```';
                }
                message = {
                    type: 'webhook',
                    img: payload.sender.avatar_url,
                    username: payload.sender.login,
                    text: m,
                    url: payload.repository.html_url,
                } as MessageStorage;
                await server.storage.addNewMessage(room.id, message);
                await server.sendUpdatesMessages(room.id);
            } else if (payload.forkee) {
                m =
                    'Project ' +
                    payload.forkee.full_name +
                    ' forked from ' +
                    payload.repository.full_name;
                message = {
                    type: 'webhook',
                    img: payload.sender.avatar_url,
                    username: payload.sender.full_name,
                    text: m,
                    url: payload.forkee.html_url,
                } as MessageStorage;
                await server.storage.addNewMessage(room.id, message);
                await server.sendUpdatesMessages(room.id);
            } else {
                // No idea what it is
                console.log(payload);
            }

            res.status(200).end();
        });
    },
    getRoomForHash: async function (hash, payload) {
        let r = null;
        if (this.server === null) {
            throw new Error('Null server in webhook');
        }

        const rooms = await this.server.storage.getAllRooms();

        for (const room of rooms) {
            if (room.type == 'text') {
                const hmac = crypto.createHmac('sha256', room.id);
                const roomHash = 'sha256=' + hmac.update(payload).digest('hex');
                if (roomHash === hash) {
                    r = room;
                }
            }
        }
        return r;
    },
} as WebhookPlugin;
export default webhookplugin;
