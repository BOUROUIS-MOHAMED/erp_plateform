const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
     console.log('🔵 PROTECT EXÉCUTÉ - req.url:', req.url);
    console.log('   next est une fonction?', typeof next === 'function');
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Non autorisé - Token manquant' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Utilisateur non trouvé' 
            });
        }

        next();  // ← Vérifiez que next() est bien appelé
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Non autorisé - Token invalide' 
        });
    }
};

module.exports = { protect };