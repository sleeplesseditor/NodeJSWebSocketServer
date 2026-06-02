// ** HTTP SERVER ** //
const HTTP = require('http');
const CONSTANTS = require('./custom_lib/websocket_constants');
const METHODS = require('./custom_lib/websocket_methods');

const HTTP_SERVER = HTTP.createServer((req, res) => {
    res.writeHead(200);
    res.end('Greetings')
});

HTTP_SERVER.listen(CONSTANTS.PORT, () => {
    console.log('HTTP server is listening on port ' + CONSTANTS.PORT)
});

CONSTANTS.CUSTOM_ERRORS.forEach(errorEvent => {
    process.on(errorEvent, (err) => {
        console.log(`Caught an error event: ${errorEvent}. Error Objec: ${err}`);
        process.exit(1);
    })
});

HTTP_SERVER.on('upgrade', (req, socket, head) => {
    const upgradeHeaderCheck = req.headers['upgrade'] && req.headers['upgrade'].toLowerCase() === CONSTANTS.UPGRADE;
    const connectionHeaderCheck = req.headers['connection'] && req.headers['connection'].toLowerCase() === CONSTANTS.CONNECTION;
    const methodChecl = req.method === CONSTANTS.METHOD;

    const origin = req.headers['origin'] || 'unknown origin';
    const originCheck = METHODS.isOriginAllowed(origin);

    if(METHODS.check(upgradeHeaderCheck, connectionHeaderCheck, methodChecl, originCheck)) {
        upgradeConnection(req, socket, head);
    }
});

function upgradeConnection(req, socket, head) {
    console.log('All checks completed')
}