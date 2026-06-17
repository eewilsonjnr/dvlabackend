"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordActivity = recordActivity;
exports.getLastActivityTime = getLastActivityTime;
exports.activityTracker = activityTracker;
let lastActivity = new Date();
function recordActivity() { lastActivity = new Date(); }
function getLastActivityTime() { return lastActivity; }
function activityTracker(req, res, next) {
    recordActivity();
    next();
}
//# sourceMappingURL=activityTracker.js.map