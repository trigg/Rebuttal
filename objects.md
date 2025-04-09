# Message Object

assuming the object is `message`

|           | type                               | meaning |
| `text`    | string                             | The basic string of the message. Formatted as Markdown |
| `img`     | string, undefined or null          | URL of the image attached to this message if a string. otherwise assume no image. |
| `width`   | int                                | If an image is attached, this is the expected width, in pixels, of the image. |
| `height`  | int                                | If an image is attached, this is the expected height, in pixels, of the image. |
| `userid`  | string (uuid) or null or undefined | The user id of the sender of the message. Falsey implies it is plugin generated or a deleted message |
| `username` | string, possibly empty            | The username of the user at the time of sending. Servers may decide to either use the current username or store it at the time and send the historically accurate name |
| `tags`     | string (JSON list)                | A JSON string of a list of userids who have been tagged (`@username`) in the message |
| `type`     | string or undefined               | The type of message. If undefined, it is a standard message. `webhook` defines the message as originating from a webhook from the webhook plugin. Other definitions are allowed, and clients MAY depict them differently if it is aware of the types. Server MUST make a fully valid message object regardless of `type` in case the client has no specific codepath for any given type. |
