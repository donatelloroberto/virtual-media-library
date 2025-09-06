const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI; // read from your .env

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let dbInstance = null;

async function connectDB() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db('virtual_media'); // You can change 'virtual_media' to your DB name
    console.log('MongoDB connected');
  }
  return dbInstance;
}

module.exports = { connectDB };