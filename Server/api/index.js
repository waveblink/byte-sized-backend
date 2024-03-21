import express from "express";
import dotenv from "dotenv";
import authRoutes from '../routes/authRoutes.js';
import recipeRoutes from '../routes/recipeRoutes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authenticateToken from '../middleware/authenticateToken.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: [
    'https://byte-sized-recipev2.vercel.app',
    'https://byte-sized-recipev2-git-master-waveblinks-projects.vercel.app',
    'https://byte-sized-recipev2-h8xd4eo6t-waveblinks-projects.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// Public routes
app.use('/api', authRoutes);

app.use('/api', recipeRoutes);

app.use('/api', recipeRoutes);



app.use('/validate', authRoutes);

// A simple protected route to test the authenticateToken middleware
app.get('/api/protected', authenticateToken, (req, res) => {

  res.json({ message: 'You have accessed a protected route' });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
