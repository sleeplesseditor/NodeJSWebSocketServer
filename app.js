// ** HTTP SERVER ** //
const HTTP = require('http');
const CONSTANTS = require('./custom_lib/websocket_constants');
const METHODS = require('./custom_lib/websocket_methods');

const GET_INFO = 1;
const GET_LENGTH = 2;
const GET_MASK_KEY = 3;
const GET_PAYLOAD = 4;
const SEND_ECHO = 5;
const GET_CLOSE_INFO = 6;

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

    const receiver = new WebSocketReceiver(socket);

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
    _fin = false;
    _opcode = null;
    _masked = false;
    _initialPayloadSizeIndicator = 0;
    _framePayloadLength = 0;
    _maximumPayloadSize = 1024 * 1024;
    _totalPayloadLength = 0;
    _mask = Buffer.alloc(CONSTANTS.MASK_LENGTH);
    _framesReceived = 0;
    _fragments = [];

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
                case GET_LENGTH:
                    this._getLength();
                    break;
                case GET_MASK_KEY:
                    this._getMaskKey();
                    break;
                case GET_PAYLOAD:
                    this._getPayload();
                    break;
                case SEND_ECHO:
                    this._sendEcho();
                    break;
                case GET_CLOSE_INFO:
                    this._getCloseInfo();
                    break;
                default:
                    break;
            }
        } while (this._taskLoop); {

        }
    }

    _getInfo() {
        if(this._bufferedBytesLength < CONSTANTS.MIN_FRAME_SIZE) {
            this._taskLoop = false;
            return;
        }

        const infoBuffer = this._consumeHeaders(CONSTANTS.MIN_FRAME_SIZE);
        const firstByte = infoBuffer[0];
        const secondByte = infoBuffer[1];

        this._fin = (firstByte & 0b10000000) === 0b10000000;
        this._opcode = firstByte & 0b00001111;
        this._masked = (secondByte & 0b10000000) === 0b10000000;
        this._initialPayloadSizeIndicator = secondByte & 0b01111111;

        console.log(`FIN: ${this._fin}, Opcode: ${this._opcode}, Masked: ${this._masked}, Initial Payload Size Indicator: ${this._initialPayloadSizeIndicator}`);   

        if(!this._masked) {
            this._sendClose(1002, 'Mask must be set');
        }

        if([CONSTANTS.OPCODE_PING_FRAME, CONSTANTS.OPCODE_PONG_FRAME].includes(this._opcode)) {
            this._sendClose(1003, 'The server does not accept ping or pong frames');
        }

        this._task = GET_LENGTH;
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

    _getLength() {
        switch(this._initialPayloadSizeIndicator) {
            case CONSTANTS.MEDIUM_DATA_FLAG:
                let mediumPayloadLengthBuffer = this._consumeHeaders(CONSTANTS.MEDIUM_SIZE_CONSUMPTION);
                this._framePayloadLength = mediumPayloadLengthBuffer.readUInt16BE();
                this._processLength();
                break;
            case CONSTANTS.LARGE_DATA_FLAG:
                let largePayloadLengthBuffer = this._consumeHeaders(CONSTANTS.LARGE_SIZE_CONSUMPTION);
                let bufBigInt = largePayloadLengthBuffer.readBigUInt64BE();
                this._framePayloadLength = Number(bufBigInt);
                this._processLength();
                break;
            default:
                this._framePayloadLength = this._initialPayloadSizeIndicator;
                this._processLength();
                break;
        }
    }

    _processLength() {
        this._totalPayloadLength = this._framePayloadLength;

        if(this._totalPayloadLength > this._maximumPayloadSize) {
            this._sendClose(1009, 'WebSocket server does not support such large message lengths');
        }

        this._task = GET_MASK_KEY;
    }

    _getMaskKey() {
        this._mask = this._consumeHeaders(CONSTANTS.MASK_LENGTH);
        this._task = GET_PAYLOAD;
    }

    _getPayload() {
        if(this._framePayloadLength > this._bufferedBytesLength) {
            this._taskLoop = false;
            return;
        }

        this._framesReceived++;

        let frameMaskedPayloadBuffer = this._consumePayload(this._framePayloadLength);

        let frameUnmaskedPayloadBuffer = METHODS.unMaskPayload(frameMaskedPayloadBuffer, this._mask);

        if(frameUnmaskedPayloadBuffer.length) {
            this._fragments.push(frameUnmaskedPayloadBuffer);
        };

        if(this._opcode === CONSTANTS.OPCODE_CLOSE_FRAME) {
            this._task = GET_CLOSE_INFO;
            return;
        }

        if(this._framePayloadLength <= 0) {
            this._sendClose(1008, "The text are cannot be empty");
        }

        if(!this._fin) {
            this._task = GET_INFO;
        } else {
            console.log('Total frames received for this message: ' + this._framesReceived);
            this._task = SEND_ECHO;
        }
    }

    _consumePayload(n) {
        this._bufferedBytesLength -= n;

        const payloadBuffer = Buffer.alloc(n);
        let totalBytesRead = 0;

        while(totalBytesRead < n) {
            const currentBuffer = this._buffersArray[0];
            const bytesToRead = Math.min(n - totalBytesRead, currentBuffer.length);
            currentBuffer.copy(payloadBuffer, totalBytesRead, 0, bytesToRead);
            totalBytesRead += bytesToRead;

            if(bytesToRead < currentBuffer.length) {
                this._buffersArray[0] = currentBuffer.slice(bytesToRead);
            } else {
                this._buffersArray.shift();
            }
        }

        return payloadBuffer;
    }

    _sendEcho() {
        const fullMessageBuffer = Buffer.concat(this._fragments);
        let payloadLength = fullMessageBuffer.length;
        let additionalPayloadSizeIndicator = null;

        switch(key) {
            case (payloadLength <= CONSTANTS.SMALL_DATA_SIZE):
                additionalPayloadSizeIndicator = 0;
                break;
            case (payloadLength > CONSTANTS.SMALL_DATA_SIZE && payloadLength <= CONSTANTS.MEDIUM_DATA_SIZE):
                additionalPayloadSizeIndicator = CONSTANTS.MEDIUM_SIZE_CONSUMPTION;
                break;
            default:
                additionalPayloadSizeIndicator = CONSTANTS.LARGE_SIZE_CONSUMPTION;
                break;
        }

        const frame = Buffer.alloc(CONSTANTS.MIN_FRAME_SIZE + additionalPayloadSizeIndicator + payloadLength);

        let fin = 0x01;
        let rsv1 = 0x00;
        let rsv2 = 0x00;
        let rsv3 = 0x00;
        let opcode = CONSTANTS.OPCODE_BINARY_FRAME;

        let firstByte = (fin << 7) | (rsv1 << 6) | (rsv2 << 5) | (rsv3 << 4) | opcode;
        frame[0] = firstByte;

        let maskingBit = 0x00;

        if(payloadLength <= CONSTANTS.SMALL_DATA_SIZE) {
            frame[1] = (maskingBit | payloadLength);
        } else if(payloadLength <= CONSTANTS.MEDIUM_DATA_SIZE) {
            frame[1] = (maskingBit | CONSTANTS.MEDIUM_DATA_FLAG);
            frame.writeUInt16BE(payloadLength, CONSTANTS.MIN_FRAME_SIZE);
        } else {
            frame[1] = (maskingBit | CONSTANTS.LARGE_DATA_FLAG);
            frame.writeBigUInt64BE(BigInt(payloadLength), CONSTANTS.MIN_FRAME_SIZE);
        }

        const messageOffset = CONSTANTS.MIN_FRAME_SIZE + additionalPayloadSizeIndicator;

        fullMessageBuffer.copy(frame, messageOffset);

        this.socket.write(frame);

        this._resetState();
    }

    _resetState() {
        this._buffersArray = [];
        this._bufferedBytesLength = 0;
        this._taskLoop = false;
        this._task = GET_INFO;
        this._fin = false;
        this._opcode = null;
        this._masked = false;
        this._initialPayloadSizeIndicator = 0;
        this._framePayloadLength = 0;
        this._maximumPayloadSize = 1024 * 1024;
        this._totalPayloadLength = 0;
        this._mask = Buffer.alloc(CONSTANTS.MASK_LENGTH);
        this._framesReceived = 0;
        this._fragments = [];
    }

    _getCloseInfo() {
        let closeFramePayload = this._fragments[0];

        if(!closeFramePayload) {
            this.sendClose(1008, "Next time, please set the status code");
            return;
        }

        let closeCode = closeFramePayload.readUInt16BE();
        let closeReason = closeFramePayload.toString('utf8', 2);

        if(closeCode === 1001) {
            this.socket.end();
            this._resetState();
            return;
        }

        console.log(`Received close frame with code: ${closeCode} and reason: ${closeReason}`);

        let serverResponse = "Please open a new connection";

        this._sendClose(closeCode, serverResponse);
    }

    _sendClose(closeCode, closeReason) {
        let closureCode = (typeof closeCode !== 'undefined' && closeCode) ? closeCode : 1000;
        let closureReason = (typeof closeReason !== 'undefined' && closeReason) ? closeReason : '';

        const closureReasonBuffer = Buffer.from(closureReason, 'utf8');
        const closureReasonLength = closureReasonBuffer.length;

        const closeFramePayload = Buffer.alloc(2 + closureReasonLength);

        closeFramePayload.writeUInt16BE(closureCode, 0);
        closureReasonBuffer.copy(closeFramePayload, 2);

        const firstByte = 0b10000000 | 0b0000000 | 0b00001000;
        const secondByte = closeFramePayload.length;
        const mandatoryCloseHeaders = Buffer.from([firstByte, secondByte]);

        const closeFrame = Buffer.concat([mandatoryCloseHeaders, closeFramePayload]);

        this.socket.write(closeFrame);
        this.socket.end();

        this._resetState();
    }
};