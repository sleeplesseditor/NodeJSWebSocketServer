import CONSTANTS from './websocket_constants.js';
import crypto from 'crypto';

function isOriginAllowed(origin) {
    return CONSTANTS.ALLOWED_ORIGINS.includes(origin);
};

function check(socket, upgradeHeaderCheck, connectionHeaderCheck, methodCheck, originCheck) {
    if(upgradeHeaderCheck && connectionHeaderCheck && methodCheck && originCheck) {
        return true;
    } else {
        const message = "400 Bad Request: One or more required headers are missing or invalid. Did not comply with RCFC6455 Spec.";
        const messageLength = message.length;
        const response = `HTTP/1.1 400 Bad Request\r\n` + 
        `Content-Type: text/plain\r\n` +
        `Content-Length: ${messageLength}\r\n` + 
        `\r\n` +
        message;
        socket.write(response);
        socket.end();
    }
}

function generateServerKey(clientKey) {
    let data = clientKey + CONSTANTS.GUID;

    const hash = crypto.createHash('sha1');
    hash.update(data);
    let serverKey = hash.digest('base64');
    return serverKey;
}

function createUpgradeHeaders(clientKey) {
    let serverKey = generateServerKey(clientKey);
    let headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${serverKey}`
    ];
    const upgradeHeaders = headers.join('\r\n') + '\r\n\r\n';
    return upgradeHeaders;
}

function unMaskPayload(payloadBuffer, maskKey) {
    for(let i = 0; i < payloadBuffer.length; i++) {
        payloadBuffer[i] = payloadBuffer[i] ^ maskKey[i % CONSTANTS.MASK_LENGTH];
    }

    return payloadBuffer;
}

export default {
    isOriginAllowed,
    check,
    createUpgradeHeaders,
    unMaskPayload
};