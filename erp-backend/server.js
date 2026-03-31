const app = require('./src/app');
const connectDB = require('./src/config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Fonction pour démarrer le serveur
const startServer = async () => {
  try {
    // Tentative de connexion à MongoDB
    await connectDB();
    console.log('✅ Connexion DB établie');
    
    // Démarrer le serveur
    const server = app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      console.log(`📡 Environnement: ${process.env.NODE_ENV}`);
      console.log('✅ Le serveur est en écoute...');
    });

    // Garder le processus en vie
    server.keepAliveTimeout = 65000; // 65 secondes

  } catch (error) {
    console.error('❌ Erreur au démarrage:', error.message);
    // On ne quitte pas, on continue pour voir l'erreur
  }
};

startServer();

process.on('unhandledRejection', (err) => {
  console.log('❌ Erreur non gérée:', err);
});