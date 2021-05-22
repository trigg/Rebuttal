Table of Contents
=================
   * [Rebuttal Electron App](#rebuttal-electron-app)
   * [Rebuttal webchat](#rebuttal-webchat)
      * [Customisation](#customisation)
         * [Themes](#themes)
      * [Installation](#installation)
         * [Generic Linux](#generic-linux)
            * [Get Source Code](#get-source-code)
            * [Get Yarn](#get-yarn)
            * [Get Dependencies](#get-dependencies)
            * [Configure](#configure)
            * [Storage](#storage)
            * [SSL](#ssl)
               * [Self Signed](#self-signed)
               * [Existing key](#existing-key)
            * [First Run](#first-run)
      * [Post Install](#post-install)
         * [Port Forwarding](#port-forwarding)
         * [Reverse Proxy](#reverse-proxy)
            * [Apache](#apache)
            * [Nginx](#nginx)
      * [Using](#using)
         * [Permissions &amp; Groups](#permissions--groups)
         * [Sending images in text chat](#sending-images-in-text-chat)
            * [Mouse &amp; Keyboard](#mouse--keyboard)
            * [Touch screens](#touch-screens)

Created by [gh-md-toc](https://github.com/ekalinin/github-markdown-toc)

# Rebuttal Electron App

Install this repository and run `yarn client -- --url=https://127.0.0.1:9000/ipc` in the root. Naturally change the url to point to a running IPC URI on a server

# Rebuttal webchat

Rebuttal webchat is a multimedia webchat system featuring text channels and Voice, Webcam and Livestream rooms. It is written as a NodeJS server and a HTML/JS client served from the server

This is still extremely early development

## Customisation

### Themes

Rebuttal comes with 3 themes by default and allows extras. To create a theme called `example` you need to create `public/css/example.css` and `public/img/example/...`

SCSS sections are used to our own themes but not required of any new themes

## Installation

### Generic Linux

#### Get Source Code

`https://github.com/trigg/Rebuttal.git`

#### Get Yarn

Get Yarn Using your package manager. 

#### Get Dependencies

`yarn`

#### Configure

```
cp config-example.json config.json
nano config.json
```

| Server Option      |  Effect                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `serverimg`        | relative path to an image in ./public/                                  |
| `servername`       | Text under image on login page. Accepts Markdown                        |
| `port`             | Port to bind for this server. default is 9000                           |
| `storage`          | See [Storage](#storage). Default `json`                                 |
| `gravatarfallback` | See [Gravatar](https://en.gravatar.com/site/implement/images/) Default `monsterid` |
| `infinitesignup`   | If set anyone can make an account without invite by visiting `/?signup`. Default not set |

#### Storage

the config option `storage` changes which `storage-*.js` to load. Currently there are three options, JSON, SQLite, and MySQL.

- JSON is a plaintext file, users password is hashed but everything else is easily accessible to anyone with access to terminal or disk.
- SQLite is a database file stored in the server directory, passwords are hashed but anyone with access to the terminal or disk will be able to read any other data.
- MySQL is not yet implemented. 

Other storage backends are welcome to be included as Pull Request provided they're not excessively large.

#### SSL

##### Self Signed

```
openssl req -nodes -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365
```

##### Existing key

Make sure a copy of the key and cert are in the root directory of the project named `key.pem` and `cert.pem` respectively

#### First Run

`node index.js`

On first run a default configuration will be set. Currently this is decided by the storage backend.

## Post Install

Depending on your use case, this might not be the end of your setup.

### Port Forwarding

If Rebuttal is running behind a NAT router and intended for access by the world in general you will need to port forward the port used by the server (Default 9000). This is not done by the server

### Reverse Proxy

If you want to have Rebuttal accessible on HTTPS port 443 and already have a service running it is possible to set up a reverse proxy to allow a directory or subdomain to pass requests through to rebuttal.

#### Apache

TBC

#### Nginx

TBC

## Using

### Permissions & Groups

Users belong to one group only. A users permissions is defined by their group only.


| Permission Name | Description         |
| --------------- | ------------------- |
| createRoom      | Can create chat rooms |
| renameRoom      | Can change a rooms name |
| removeRoom      | Can remove a room, messages are deleted with or without permission when this happens |
| createUser      | Can create user. This is not linked to inviting users, and is intended for creating bot accounts |
| renameUser      | Can chane a users name |
| removeUser      | Can remove a user. Optionally deletes all messages and user uploads, with no other permission required |
| renameServer    | Can change `serverimg` and `servername` in config.json from web interface |
| inviteUser      | Can generate invites |
| joinVoiceRoom   | Can join voice chat rooms. Without this the user can only be involved in text chat |
| sendMessage     | Can send messages to text chat |
| changeMessage   | Can change the contents of another users message |
| setUserGroup    | Can change users to a different group |
| noInviteFor     | Invites for new users cannot be an invite at this level |
| inviteUserAny   | Users with this permission can give invites for any group, even those with `noInviteFor` |

### Sending images in text chat


#### Mouse & Keyboard

When viewing a text room Drag-and-Drop the image over the app. A preview should appear above the text input box. To cancel the upload press the red 'x'

#### Touch screens

Honestly I have no idea.




