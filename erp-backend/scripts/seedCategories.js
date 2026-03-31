const mongoose = require('mongoose');
const path = require('path');
const Category = require('../src/models/Category');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const categories = [
  { 
    name: 'Électronique', 
    description: 'Produits électroniques et gadgets technologiques'
  },
  { 
    name: 'Informatique', 
    description: 'Ordinateurs, serveurs et accessoires informatiques'
  },
  { 
    name: 'Téléphonie', 
    description: 'Téléphones mobiles et accessoires'
  },
  { 
    name: 'Audio', 
    description: 'Casques, écouteurs, enceintes et équipements audio'
  },
  { 
    name: 'Accessoires', 
    description: 'Accessoires divers pour appareils électroniques'
  },
  { 
    name: 'Réseau', 
    description: 'Équipements réseau et connectivité'
  }
];

const seedCategories = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zee');
    console.log(`✅ Connecté à MongoDB (${mongoose.connection.name})`);

    // Supprimer les anciennes catégories
    await Category.deleteMany();
    console.log('📝 Anciennes catégories supprimées');

    // Insérer les nouvelles catégories
    const result = await Category.insertMany(categories);
    console.log(`✅ ${result.length} catégories ajoutées avec succès:`);
    result.forEach(cat => {
      console.log(`   - ${cat.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
};

seedCategories();
