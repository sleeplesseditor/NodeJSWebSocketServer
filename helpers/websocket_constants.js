export default {
    PORT: 8080,
    CUSTOM_ERRORS: [
        'uncaughtException',
        'unhandledRejection',
        'SIGINT'
    ],
    METHOD: "GET",
    VERSION: 13,
    CONNECTION: 'upgrade',
    UPGRADE: 'websocket',
    ALLOWED_ORIGINS: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'null'
    ],
    GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
    MIN_FRAME_SIZE: 2,
    SMALL_DATA_SIZE: 125,
    MEDIUM_DATA_SIZE: 65535,
    LARGE_DATA_SIZE: 4294967295,
    MEDIUM_DATA_FLAG: 126,
    LARGE_DATA_FLAG: 127,
    MEDIUM_SIZE_CONSUMPTION: 2,
    LARGE_SIZE_CONSUMPTION: 8,
    MASK_LENGTH: 4,
    OPCODE_TEXT_FRAME: 0x01,
    OPCODE_BINARY_FRAME: 0x02,
    OPCODE_CLOSE_FRAME: 0x08,
    OPCODE_PING_FRAME: 0x09,
    OPCODE_PONG_FRAME: 0x0A
}