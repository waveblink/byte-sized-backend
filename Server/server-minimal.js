import express from 'express';
import { query, pool } from './db/db.js';

const app = express();
const port = 5000;

// Simulate database function
async function getMealTypeIdByName(mealTypeName) {
    console.log("Fetching meal type ID for:", mealTypeName);
    try {
        // Assuming 'pool' is your database connection pool
        const result = await pool.query('SELECT id FROM mealtypes WHERE name = $1', [mealTypeName.trim()]);
        if (result.rows.length > 0) {
            console.log("Found meal type ID:", result.rows[0].id);
            return result.rows[0].id;
        } else {
            console.log("No matching meal type found for:", mealTypeName);
            return null;
        }
    } catch (error) {
        console.error('Error fetching meal type ID:', error);
        return null;
    }
}


app.use(express.json()); // Middleware to parse JSON bodies

app.post('/test-endpoint', async (req, res) => {
    const { mealType, user } = req.body; // Expecting mealType and user in the request body

    try {
        const mealTypeId = await getMealTypeIdByName(mealType);
        const userId = user ? user.id : undefined; // Simulate getting userId

        console.log("Meal Type ID:", mealTypeId, "User ID:", userId);
        res.json({ mealTypeId, userId });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
