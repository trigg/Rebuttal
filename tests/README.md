# Tests

Tests are good. Let's do lots of them, and then it's always someone elses problem when my code sucks.

Having multiple test files to bunch together logically seems best, so let's do that.

## Externally accessible API

Although we currently only have the JS/Electron client, this is by no means the intended case. The API should (at some point very soon) be declared stable, after which we start versioning the Websocket protocol and declaring which (of multiple) versions the server supports on the welcome message, and the client picks one and gets that specific handler.

This means we will need a v1/v2 etc tester and once a version is considered stable, no material changes should be allowed to it or its tests.

## Storage tests

Storage tests should be done directly on the storage medium and skip the express/WS entirely.

## Non-storage server tests

Other tests should feed a JSON object into json storage, disable saving, and run tests that way. This helps with ensuring tests don't accidentally cause others to fail due to leftover stored data

## AREAS WE NEED COVERING

- Image uploads
- Server Logos - aspect ratios, too large, too small, formats
- Storage systems
- - Create resources
- - Delete resources
- - Select resources
- plugins
- - webhooks