const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

/**
 * Script pour créer le premier utilisateur admin_principal (président)
 * À exécuter une seule fois au déploiement
 */
const createPresident = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connecté à MongoDB');

    // Vérifier si un président existe déjà
    const existingPresident = await User.findOne({ role: 'admin_principal' });
    if (existingPresident) {
      console.log('\n👑 Un président existe déjà dans le système:');
      console.log(`   ID: ${existingPresident._id}`);
      console.log(`   Nom: ${existingPresident.firstName} ${existingPresident.lastName}`);
      console.log(`   Email: ${existingPresident.email}`);
      console.log(`   Créé le: ${existingPresident.createdAt?.toLocaleDateString()}`);
      console.log('\n📝 Aucune action nécessaire.');
      process.exit(0);
    }

    // Créer le président avec des valeurs par défaut
    const presidentData = {
      firstName: process.env.PRESIDENT_FIRSTNAME || 'azer',
      lastName: process.env.PRESIDENT_LASTNAME || 'missaoui',
      email: process.env.PRESIDENT_EMAIL || 'president@erp.com',
      password: process.env.PRESIDENT_PASSWORD || 'Admin123!',
      role: 'admin_principal',
      department: process.env.PRESIDENT_DEPARTMENT || 'Direction Générale',
      isActive: true
    };

    const president = new User(presidentData);
    await president.save();

    console.log('\n✅ ' + '='.repeat(50));
    console.log('✅ PRÉSIDENT CRÉÉ AVEC SUCCÈS !');
    console.log('✅ ' + '='.repeat(50));
    console.log('👑 Rôle:        Président / Admin Principal');
    console.log('📧 Email:       ' + presidentData.email);
    console.log('🔑 Mot de passe: ' + presidentData.password);
    console.log('👤 Nom:         ' + presidentData.firstName + ' ' + presidentData.lastName);
    console.log('🏢 Département: ' + presidentData.department);
    console.log('✅ ' + '='.repeat(50));
    console.log('\n⚠️  IMPORTANT: Changez ce mot de passe à la première connexion !');
    console.log('📝 Conservez ces informations dans un endroit sécurisé.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la création du président:');
    console.error('   ' + error.message);
    if (error.code === 11000) {
      console.error('   ⚠️  Un utilisateur avec cet email existe déjà.');
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Exécuter le script
createPresident();