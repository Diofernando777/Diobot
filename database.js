// database.js
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://juaniniecho_db_user:JYPHtx8frAX3yOj7@tapiasbot.y3cslbv.mongodb.net/Bot?retryWrites=true&w=majority';

async function conectarDB() {
    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('Conectado exitosamente a MongoDB Atlas');
    } catch (error) {
        console.error('⚠️ Error al conectar a MongoDB:', error.message);
    }
}

// Esquemas y modelos
const adminSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    admin: { type: Boolean, default: true }
}, { versionKey: false });

const banSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    baneado: { type: Boolean, default: true }
}, { versionKey: false });

const Admin = mongoose.model('Admin', adminSchema, 'Admins');
const Ban = mongoose.model('Ban', banSchema, 'Bans');

module.exports = {
    conectarDB,
    Admin,
    Ban
};