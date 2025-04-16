## P1

## Server to Client

## Client to Server

| type        | `invite` |                                                                 |
| ----------- | -------- | --------------------------------------------------------------- |
| `groupName` | string   | The name of the group assigned to the user who uses this invite |

Create an invite code for a new user. Must include the name of the group the invited user will have.
Requires permission `inviteUserAny` currently. Returns an `invite` packet or an `error`

| type      | `getmessages`          |                                                                             |
| --------- | ---------------------- | --------------------------------------------------------------------------- |
| `segment` | int, null or undefined | The segment of chat to return. If null or undefined returns the most recent |
| `roomid`  | string (uuid)          | The room from which to get text segments                                    |

Get a segment of chat messages for a specific room. Returns an `updateText` packet.

| type       | `message`                            |                                                                                                                                                                      |
| ---------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filename` | string or null or undefined          | (Optionally) the name of the file being uploaded.                                                                                                                    |
| `rawfile`  | string (base64) or null or undefined | (Optionally) the contents of the file being uploaded. Must be a format in [this list](https://github.com/image-size/image-size?tab=readme-ov-file#supported-formats) |
| `roomid`   | string (uuid)                        | The room this text message is being sent to.                                                                                                                         |
| `message`  | [object](../objects.md)              | The object describing the message ...                                                                                                                                |

Send a message to a text room. Includes optionally attatching an image

| type     | `joinroom`    |                  |
| -------- | ------------- | ---------------- |
| `roomid` | string (uuid) | The room to join |

Join a `voice` room. Triggers a `joinRoom` and `updateRooms` message for every connected user.

| type     | `leaveroom`   |                              |
| -------- | ------------- | ---------------------------- |
| `roomid` | string (uuid) | The room the user is leaving |

Leave a `voice` room. Triggers a `leaveRoom` and `updateRooms` message for every connected user.

| type       | `video`       |                                       |
| ---------- | ------------- | ------------------------------------- |
| `touserid` | string (uuid) | The User this message is intended for |
| `payload`  | string        | Message to send to user               |

Send message directly to another user. Intended as a way to pass direct WebRTC payloads. Currently no sanity checking is done by the server on this, so client MUST ensure it is sane before using it.

| type        | `golive` |                                                                                              |
| ----------- | -------- | -------------------------------------------------------------------------------------------- |
| `livestate` | boolean  | true if the user is now livestreaming a video (not webcam stream)                            |
| `livelabel` | string   | text label of what the user is live streaming. may be window name, may be user entered text. |

Used to change the users livestreaming state. Webcam and voice audio are not considered live streaming, this is specifically for screen or window sharing.

| type       | `letmesee`    |                                                                  |
| ---------- | ------------- | ---------------------------------------------------------------- |
| `touserid` | string (uuid) | The (other) user this user wishes to watch the livestream of     |
| `message`  | string        | raw WebRTC message to send to facilitate a livestream connection |

Request a webrtc livestream of window or screen shared by `touserid`

| type       | `createroom` |                                                            |
| ---------- | ------------ | ---------------------------------------------------------- |
| `roomType` | string       | `voice` or `text` to define how the new room will function |
| `roomName` | string       | the name of the new room                                   |

Request a room be created. A random UUID will be assigned. This will trigger an `updateRooms` message to all connected clients

| type        | `createuser` |                                                                                                                                                                                                                             |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userName`  | string       | the initial username of the new user. Currently limited to /a-zA-Z0-9\_-/ but this is NOT intended to be final. Ideally allow any printable characters and allow clients to filter as necessary for their display purposes. |
| `groupName` | string       | the group this new user is assigned to. The client should attempt to steer users to existing group names as this Should allow arbitrary new group names                                                                     |
| `email`     | string       | the email of the new user. This is used as the users login ID.                                                                                                                                                              |

Requires permission `createUser`. Create a new user. The password must be randomly generated by the server and Either an email sent to the email address provided with the initial password, and a requirement they change it on login OR an `adminMessage` sent to the initiating user with a confirmation message including the password.

| type       | `updateroom`  |                                   |
| ---------- | ------------- | --------------------------------- |
| `roomid`   | string (uuid) | the room id of the room to update |
| `roomName` | string        | the new name of the room          |

Requires permission `renameRoom`. Changes the name of the room. This will trigger an `updateRooms` message to all connected clients

| type       | `updateuser`  |                                   |
| ---------- | ------------- | --------------------------------- |
| `userid`   | string (uuid) | the id of the user to update      |
| `userName` | string        | the new display name for the user |

Requires permission `renameUser` OR for the connected user to be `userid`. Changes the display name of the user. This will trigger an `updateUsers` message to all connected clients

| type     | `removeroom`  |     |
| -------- | ------------- | --- |
| `roomid` | string (uuid) |     |

Requires permission `removeRoom`. Deletes a room. This will trigger an `updateRoom` message to all connected clients

| type           | `removeuser`  |                                                                                     |
| -------------- | ------------- | ----------------------------------------------------------------------------------- |
| `touserid`     | string (uuid) | The user intended to be deleted                                                     |
| `withvengence` | boolean       | If true, all messages, uploads etc for the user should be deleted at this point too |

Requires permission `removeUser`.

| type        | `updatemessage`         |                                       |
| ----------- | ----------------------- | ------------------------------------- |
| `roomid`    | string (uuid)           | The room whose contents are to change |
| `messageid` | int                     | The message index which will change   |
| `message`   | [object](../objects.md) | The new message contents              |

Requires permission `changeMessage`. Alters the contents of the message.

| type        | `removemessage` |                                       |
| ----------- | --------------- | ------------------------------------- |
| `roomid`    | string (uuid)   | The room whose contents are to change |
| `messageid` | int             | The message index which will change   |

Requires permission `changeMessage`. Mask the contents of the message. Servers MUST set the text to `*Message Removed*` and remove `userid`. Clients may decide to not show messages with text `*Message Removed*` and undefined `userid`

| type        | `creategroup` |                                  |
| ----------- | ------------- | -------------------------------- |
| `groupName` | string        | The name of the group to create. |

Requires permission `setGroupPerm`. If the storage backing doesnt separate groups from permission list, this is allowed to be a NOOP on the server, but the client MUST send it before `updategroup` if it doesn't already exist, as a precaution.

| type        | `updategroup` |                                                |
| ----------- | ------------- | ---------------------------------------------- |
| `groupName` | string        | The name of the group to update                |
| `changes`   | list          | a list of [group change objects](../object.md) |

Requires permission `setGroupPerm`. Iterates over `changes` and performs each in order.

| type        | `removegroup` |                                 |
| ----------- | ------------- | ------------------------------- |
| `groupName` | string        | the name of the group to remove |

Requires permission `setGroupPerm`. Removes a group and all permissions. Any user still assigned to the group will still keep the groupName, but will lose all permissions. Clients Should suggest to an administrator to move all affected users to another group at the same time and send `setusergroup` messages to this end.

| type        | `setusergroup` |                                |
| ----------- | -------------- | ------------------------------ |
| `userid`    | string (uuid)  | The user to affect             |
| `groupName` | string         | The group to set this user to. |

Requires permission `setUserGroup`. Client Should steer users towards a list of known groups, and the server MUST NOT decline a change to a groupName if the group does not exist. It may create the group, if necessary, but not assign any permissions to it.

| type    | `chatdev` |                                  |
| ------- | --------- | -------------------------------- |
| `video` | boolean   | This client has a webcam enabled |
| `audio` | boolean   | This client has a mic enabled    |

Sent whenever the client either loses/gains a device or toggles a device state. If false, the user doesn't have or has disabled a device. This will result in an equal `chatdev` message sent to every client in the same voice room as the sending user, with this users `userid` also attached.

| type       | `servermute`  |                             |
| ---------- | ------------- | --------------------------- |
| `userid`   | string (uuid) | the user to affect          |
| `suppress` | boolean       | If the user is server muted |

Requires permission `suppressUser`. Sends a `servermute` message to all connected clients. Indicates to clients that audiostreams from this user should be muted.

| type      | `talking` |                                                                                                                                                             |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `talking` | boolean   | if the user is currently talking. The client should monitor the microphone audio stream and send `true` when considered to be talking and `false` when not. |

This sends a `talking` message to all connected clients to allow users to see at a glance who is talking at any time.

| type      | `contextoption` |                                                                   |
| --------- | --------------- | ----------------------------------------------------------------- |
| `context` | string          | `user`, `room`, `voiceroom`, `textroom`, `message`, `livestream`, |
| `option`  | string          | the id of option the client has selected                          |
| `value`   | string          | the value of the option the user has selected                     |

Sent by the client when a context menu has been opened, and a callback selected.

| type        | `windowinput` |     |
| ----------- | ------------- | --- |
| `inputid`   | string        |     |
| `value`     | string        |     |
| `allinputs` | string        |     |

TBD. Sent by client when a custom window has been interacted with in a way which alters a value.
