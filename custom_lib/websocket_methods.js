const CONSTANTS = require('./websocket_constants');

function isOriginAllowed(origin) {
    return CONSTANTS.ALLOWED_ORIGINS.includes(origin);
};

function check(upgradeHeaderCheck, connectionHeaderCheck, methodChecl, originCheck) {
    if(upgradeHeaderCheck && connectionHeaderCheck && methodChecl && originCheck) {
        return true;
    } else {
        throw new Error(`Can't connect. HTTP Headers not in accordance with RFC 6455 spec`)
    }
}

module.exports = {
    isOriginAllowed,
    check
}