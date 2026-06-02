module.exports = {
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
    ]
}