import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();


const authenticateToken = async (req, res, next) => {
    
    const token = req.cookies.token;
    console.log("cookies:", token);
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Promisify jwt.verify to use with await
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) reject(err);
                resolve(decoded);
            });
        });

        req.user = { id: decoded.userId };
        next();
    } catch (error) {
        console.error("Authentication error:", error.message);
        return res.status(403).json({ message: 'Invalid token' });
    }
};

export default authenticateToken;
