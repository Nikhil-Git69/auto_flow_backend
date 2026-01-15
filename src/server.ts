// backend/src/server.ts - Add auth routes
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import connectDB from "./config/db";
import analysisRoutes from "./routes/analysis";
import authRoutes from "./routes/Auth"; // Add this

const app = express();
const PORT = 5000;

app.use(cors({
  origin: ['http://localhost:3000'], // Your React app
  credentials: true
}));
app.use(express.json());

connectDB();

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

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.get("/", (_req, res) => {
  res.send(`
    <div style="text-align:center;padding:50px">
      <h1>AutoFlow API 🚀</h1>
      <p><a href="/api-docs">📚 Swagger UI</a></p>
      <p>Available endpoints:</p>
      <ul style="list-style:none;padding:0">
        <li>POST /auth/register - Register user</li>
        <li>POST /auth/login - Login user</li>
        <li>GET /auth/me - Get profile (requires token)</li>
        <li>GET /analysis - Get all analyses</li>
        <li>POST /analysis - Create analysis</li>
      </ul>
    </div>
  `);
});

// Register routes
app.use("/auth", authRoutes); // Add this
app.use("/analysis", analysisRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
});