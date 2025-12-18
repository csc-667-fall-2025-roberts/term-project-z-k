"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requestTimestampMiddleware = (request, _response, next) => {
    console.log(`Request received for ${request.url} at ${new Date().toLocaleString()}`);
    next();
};
exports.default = requestTimestampMiddleware;
