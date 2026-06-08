// ** HTTP SERVER ** //
const HTTP = require('http');
const CONSTANTS = require('./custom_lib/websocket_constants');
const METHODS = require('./custom_lib/websocket_methods');

const GET_INFO = 1;
const GET_LENGTH = 2;
const GET_MASK_KEY = 3;
const GET_PAYLOAD = 4;
const SEND_ECHO = 5;

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
    const methodCheck = req.method === CONSTANTS.METHOD;

    const origin = req.headers['origin'] || 'unknown origin';
    const originCheck = METHODS.isOriginAllowed(origin);

    if(METHODS.check(socket, upgradeHeaderCheck, connectionHeaderCheck, methodCheck, originCheck)) {
        console.log("Upgrade request checks out. Upgrading connection...");
        upgradeConnection(req, socket, head);
    }
});

function upgradeConnection(req, socket, head) {
    const clientKey = req.headers['sec-websocket-key'];
    const headers = METHODS.createUpgradeHeaders(clientKey);
    socket.write(headers);
    startWebSocketConnection(socket);
}

function startWebSocketConnection(socket) {
    console.log(`WebSocket connection established with Port ${socket.remotePort}`);

    const receiver = new WebScoketReceiver(socket);

    socket.on('data', (chunk) => {
        receiver.processBuffer(chunk);
    });

    socket.on('end', () => {
        console.log('WebSocket connection ended with Port ' + socket.remotePort);
    });
};

class WebSocketReceiver {
    constructor(socket) {
        this.socket = socket;
    }

    _buffersArray = [];
    _bufferedBytesLength = 0;
    _taskLoop = false;
    _task = GET_INFO;

    processBuffer(chunk) {
        this._buffersArray.push(chunk);
        this._bufferedBytesLength += chunk.length;

        this.startTaskLoop();
    }

    startTaskLoop() {
        this._taskLoop = true;

        do {
            switch(this._task) {
                case GET_INFO:
                    this._getInfo();
                    break;
                default:
                    break;
            }
        } while (this._taskLoop); {

        }
    }

    _getInfo() {
        const infoBuffer = this._consumeHeaders(CONSTANTS.MIN_FRAME_SIZE);
        const firstByte = infoBuffer[0];
        const secondByte = infoBuffer[1];

        
    }

    _consumeHeaders(n) {
        this._bufferedBytesLength -= n;

        if(n === this._buffersArray[0].length) {
            return this._buffersArray.shift();
        }

        if(n < this._buffersArray[0].length) {
            const infoBuffer = this._buffersArray[0];
            this._buffersArray[0] = this._buffersArray[0].slice(n);
            return infoBuffer.slice(0, n);
        } else {
            throw new Error('Cannot extract more data from WS frame than actual frame size');
        }
    }
};