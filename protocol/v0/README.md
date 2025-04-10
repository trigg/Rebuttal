## P0

## Server to Client

| type           | `connect` |                                                                                                                                                                                                                              |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`      | string    | Contains a short MOTD style message. Ideally from the server config.                                                                                                                                                         |
| `icon`         | string    | A URL to be used as image source for the server. Ideally PNG or SVG, but other formats may be allowed depending on client.                                                                                                   |
| `url`          | string    | A Fragment or URL encompassing the protocol, domain and optionally port. This is passed from server config and is used to create links for invites on the client                                                             |
| `contextmenus` | object    | an object with keys `user`, `room`, `textroom`, `voiceroom`, `message` which each have a list. Each item in each list is an object describing extra contextual actions that plugins have added to each.                      |
| `protocols`    | array     | a list of strings of protocols this server is capable of speaking. Exactly one must be chosen by the client which they can speak in common. If no protocols in this list can be used by client it is expected to disconnect. |

Sent once by the server directly after the client connects.

| type    | `error` |                                                                      |
| ------- | ------- | -------------------------------------------------------------------- |
| message | string  | A human-readable error message. Currently expected to be in English. |

Sent by the server in plethora conditions when something the client has requested is malformed, incorrect, or not permitted. Might be followed directly by a disconnection by the server. If the server does not close at this point it must be assumed to have had no effect and the server state and connection must still be considered valid and usable.

| type | `refreshNow` |
| ---- | ------------ |

Sent by the server when it expects the client to return to the login prompt. Ideally should only follow a successful `signup` from the client. This may be ignored by the client, in which case it should follow up with a `login` attempt.

## Client to Server

| type     | `signup` |                                                                                                                                                                                                                |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| userName | string   | The chosen user name for the newly created account. Currently only /[a-zA-Z-_ ]/ and MINIMUM of 3 characters. This is for simplicity sake while developing but is NOT intended as the final word on usernames. |
| password | string   | The password the user would like to use to identify with.                                                                                                                                                      |
| signUp   | string   | The invite code required to create an account. If the server is allowing infinite unqualified signups this is required to be the string `signup`                                                               |
| email    | string   | The email address of the user of this account. This is checked to see if it has an `@` and a `.`.                                                                                                              |

Sent on a newly opened connection in the event the user wishes to create an account on this server

| type     | `login` |                                                                                                                                   |
| -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| email    | string  | The email address of the user trying to connect                                                                                   |
| password | string  | The password of the user trying to connect                                                                                        |
| protocol | string  | The protocol the client wishes to speak after this message. The protocol MUST be present in the list the server sent in `connect` |

Sent on a newly opened connection to authenticate the user. Should only be accepted in protocol v0, attempting to send again afterwards is an error. Failure to authenticate the user with the supplied credentials MUST result in an `error` message and disconnection. Server implementations should consider marking failed attempts to login and potentially temporarily blocking repeated IP addresses from further attempts.
