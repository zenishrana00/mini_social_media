import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

/**
 * Start the HTTP server after successfully connecting to MongoDB
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express listener
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Mini Social Media Platform Server running!`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/v1/health`);
      console.log(`🌐 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);
    });

    // Handle unhandled promise rejections (e.g. database errors)
    process.on('unhandledRejection', (err) => {
      console.error(`[Server Error] Unhandled Rejection: ${err.message}`);
      // Close server and exit process
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error(`[Server Startup Error] ${error.message}`);
    process.exit(1);
  }
};

startServer();
