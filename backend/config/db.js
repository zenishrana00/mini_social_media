import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS servers to prevent querySrv ECONNREFUSED on Windows with MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

/**
 * Connect to MongoDB database
 * Uses MONGODB_URI environment variable or defaults to a local instance
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mini_social_media';

    const conn = await mongoose.connect(mongoUri);

    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    // Exit process with failure code so server doesn't run without a database
    process.exit(1);
  }
};

export default connectDB;
