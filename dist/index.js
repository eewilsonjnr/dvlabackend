"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("./routes"));
const database_1 = __importDefault(require("./config/database"));
const activityTracker_1 = require("./middleware/activityTracker");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(activityTracker_1.activityTracker);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'uploads')));
app.get('/', (_req, res) => res.json({
    status: 'ok',
    message: 'DVLA IDP/ICMV Issuance System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
}));
app.get('/health', (_req, res) => res.json({ status: 'healthy', uptime: process.uptime() }));
app.use('/api', routes_1.default);
// Error handler
app.use((err, req, res, _next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
process.on('SIGTERM', async () => { await database_1.default.$disconnect(); process.exit(0); });
process.on('SIGINT', async () => { await database_1.default.$disconnect(); process.exit(0); });
app.listen(PORT, () => {
    console.log(`🚀 DVLA IDP Backend running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map