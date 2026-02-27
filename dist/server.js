"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
console.log("🔍 CWD:", process.cwd());
console.log("🔍 Attempting to load .env from:", path_1.default.resolve(process.cwd(), '.env'));
const resultLocal = dotenv_1.default.config({ path: '.env.local' });
if (resultLocal.error)
    console.log("⚠️ Failed to load .env.local");
else
    console.log("✅ Loaded .env.local");
const result = dotenv_1.default.config();
if (result.error)
    console.log("⚠️ Failed to load .env");
else
    console.log("✅ Loaded .env");
console.log("🔑 Loaded Keys:", Object.keys(process.env).filter(k => k.includes('GEMINI')));
console.log("🔑 GEMINI_API_KEY available:", !!process.env.GEMINI_API_KEY);
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const db_1 = __importDefault(require("./config/db"));
const analysis_1 = __importDefault(require("./routes/analysis"));
const Auth_1 = __importDefault(require("./routes/Auth"));
const chat_1 = __importDefault(require("./routes/chat"));
const workspace_1 = __importDefault(require("./routes/workspace"));
const user_1 = __importDefault(require("./routes/user"));
const app = (0, express_1.default)();
const PORT = 5000;
// INCREASE PAYLOAD LIMITS FOR FILE UPLOADS
app.use(express_1.default.json({ limit: '100mb' }));
app.use(express_1.default.urlencoded({ limit: '100mb', extended: true }));
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
(0, db_1.default)();
// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AutoFlow API',
            version: '1.0.0',
            description: 'Document Analysis System API',
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        }
    },
    apis: ['./src/routes/*.ts'],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
// Health check endpoint
app.get("/health", (_req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uploadLimit: "100MB",
        message: "AutoFlow API is running"
    });
});
// Routes
app.get("/", (_req, res) => {
    res.send(`
    <div style="text-align:center;padding:50px;font-family:sans-serif">
      <h1 style="color:#4f46e5">AutoFlow API 🚀</h1>
      <p>Document Analysis System</p>
      <div style="margin:30px 0">
        <a href="/api-docs" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          📚 Swagger UI
        </a>
        <a href="/health" style="margin-left:15px;background:#10b981;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          🩺 Health Check
        </a>
      </div>
      <p><strong>Upload Limit:</strong> 100MB</p>
      <p><strong>Available endpoints:</strong></p>
      <div style="max-width:600px;margin:0 auto;text-align:left;background:#f8fafc;padding:20px;border-radius:8px">
        <h3>Authentication</h3>
        <ul style="list-style:none;padding:0">
          <li>🔐 POST /auth/register - Register user</li>
          <li>🔐 POST /auth/login - Login user</li>
          <li>🔐 GET /auth/me - Get profile (requires token)</li>
          <li>🔐 POST /auth/logout - Logout</li>
          <li>🔐 POST /auth/refresh-token - Refresh JWT token</li>
        </ul>
        <h3>Document Analysis</h3>
        <ul style="list-style:none;padding:0">
          <li>📄 POST /analysis/upload-file - Upload and analyze document</li>
          <li>📄 POST /analysis/export-corrected - Export corrected document</li>
          <li>📄 POST /analysis/extract-text - Extract text from Word docs</li>
          <li>📄 GET /analysis/:id - Get analysis by ID</li>
          <li>📄 GET /analysis/stats/:userId - Get user statistics</li>
        </ul>
        <h3>Users</h3>
        <ul style="list-style:none;padding:0">
          <li>👤 GET /users/:id - Get user profile</li>
          <li>👤 PATCH /users/:id - Update profile</li>
          <li>👤 POST /users/:id/avatar - Upload avatar</li>
        </ul>
      </div>
      <div style="margin-top:30px;font-size:0.9em;color:#64748b">
        <p>Server running on port ${PORT}</p>
      </div>
    </div>
  `);
});
// Register routes
app.use("/auth", Auth_1.default);
app.use("/analysis", analysis_1.default);
app.use("/api/chat", chat_1.default);
app.use("/workspace", workspace_1.default);
app.use("/users", user_1.default);
// Serve extracted figures and avatars statically
app.use("/uploads/figures", express_1.default.static(path_1.default.join(__dirname, "../uploads/figures")));
app.use("/uploads/avatars", express_1.default.static(path_1.default.join(__dirname, "../uploads/avatars")));
app.use("/uploads/banners", express_1.default.static(path_1.default.join(__dirname, "../uploads/banners")));
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    // Handle multer/file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            error: 'File too large',
            message: 'Maximum file size is 50MB',
            received: `${(err.limit / 1024 / 1024).toFixed(2)}MB requested`
        });
    }
    if (err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            error: 'File upload error',
            message: err.message
        });
    }
    // Default error handler
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`🩺 Health check: http://localhost:${PORT}/health`);
    console.log(`📁 Upload limit: 100MB`);
    console.log(`🌐 CORS enabled for: http://localhost:3000`);
});
// Increase timeout to 10 minutes for long AI analysis
server.setTimeout(600000);
