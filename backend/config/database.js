import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Failed: ${error.message}`);
    console.warn('⚠️  Server will start WITHOUT MongoDB');
    console.warn('⚠️  OpenAI and n8n calls will work, data just won\'t be saved');
  }
};

export default connectDB;
