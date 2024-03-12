import express from 'express';
import { query, pool } from '../db/db.js'; // Adjust the path as necessary
import axios from "axios";
import authenticateToken from '../middleware/authenticateToken.js';
import { getRecipesByUserId } from '../db/db.js';
import { saveAIGeneratedRecipe } from '../db/db.js';
import { saveRecipeAndUserMapping } from '../db/db.js';
import {saveRecipe} from '../db/db.js';

const router = express.Router();




router.get('/recipes/cuisines', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM cuisines ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting all cuisines:', error);
        res.status(500).send('Server error');
    }
});

router.get('/recipes/mealTypes', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM mealtypes ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching meal types:', error);
        res.status(500).json({ message: 'Failed to fetch meal types' });
    }
});

router.get('/recipes/latest', async (req, res) => {
    const limit = parseInt(req.query.limit) || 3;
    try {
        const result = await pool.query(`
            SELECT recipes.*, cuisines.name AS cuisine_name, users.username AS username 
            FROM recipes
            JOIN cuisines ON recipes.cuisine_id = cuisines.id
            JOIN users ON recipes.user_id = users.id 
            ORDER BY recipes.created_at DESC
            LIMIT $1`, [limit]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching latest recipes:', error);
        res.status(500).json({ message: 'An error occurred while fetching the latest recipes.' });
    }
});

router.get('/recipes/latest/by-cuisine/:cuisine', async (req, res) => {
    const { cuisine } = req.params;
    try {
      const queryText = `
        SELECT recipes.*, cuisines.name AS cuisine_name, users.username AS username
        FROM recipes
        JOIN cuisines ON recipes.cuisine_id = cuisines.id
        JOIN users ON recipes.user_id = users.id
        WHERE cuisines.name = $1
        ORDER BY recipes.created_at DESC;
      `;
      const result = await pool.query(queryText, [cuisine]);
      if (result.rows.length === 0) {
        return res.status(200).json([]); // Change to return an empty array with a 200 OK status
      }
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching recipes by cuisine:', error);
      res.status(500).json({ message: 'An error occurred while fetching recipes by cuisine.' });
    }
  });
  
 router.get('/recipes/latest/by-meal-type/:mealType', async (req, res) => {
  const { mealType } = req.params;
  try {
    const queryText = `
    SELECT recipes.*, cuisines.name AS cuisine_name, users.username AS username, mealtypes.name AS meal_type_name
    FROM recipes
    JOIN cuisines ON recipes.cuisine_id = cuisines.id
    JOIN users ON recipes.user_id = users.id
    JOIN mealtypes ON recipes.meal_type_id = mealtypes.id  
    WHERE mealtypes.name = $1
    ORDER BY recipes.created_at DESC;
    
    `;
    const result = await pool.query(queryText, [mealType]);
    if (result.rows.length === 0) {
        return res.status(200).json([]); // Change to return an empty array with a 200 OK status
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recipes by meal type:', error);
    res.status(500).json({ message: 'An error occurred while fetching recipes by meal type.' });
  }
});

router.get('/recipes/:id(\\d+)', async (req, res) => {
    const recipeId = req.params.id;

    try {
        const result = await pool.query(`
            SELECT recipes.*, 
                   cuisines.name AS cuisine_name, 
                   users.username AS username, 
                   mealTypes.name AS meal_type_name
            FROM recipes 
            JOIN cuisines ON recipes.cuisine_id = cuisines.id
            JOIN users ON recipes.user_id = users.id
            JOIN mealTypes ON recipes.meal_type_id = mealTypes.id
            WHERE recipes.id = $1
        `, [recipeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Recipe not found"});
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting recipe:', error);
        res.status(500).json({ message: 'An error occurred while getting the recipe.' });
    }
});

// router.get('/recipes/latest/by-cuisine/:cuisine', async (req, res) => {
//     const { cuisine } = req.params;
//     try {
//         const result = await pool.query(`
//             SELECT recipes.*, cuisines.name AS cuisine_name, users.username AS username
//             FROM recipes
//             JOIN cuisines ON recipes.cuisine_id = cuisines.id
//             JOIN users ON recipes.user_id = users.id
//             WHERE cuisines.name = $1
//             ORDER BY recipes.created_at DESC`, [cuisine]);
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'No recipes found for this cuisine.' });
//         }
//         res.json(result.rows);
//     } catch (error) {
//         console.error('Error fetching recipes by cuisine:', error);
//         res.status(500).json({ message: 'An error occurred while fetching recipes by cuisine.' });
//     }
// });

// router.get('/recipes/latest/by-meal-type/:mealType', async (req, res) => {
//     const { mealType } = req.params;
//     try {
//         const result = await pool.query(`
//             SELECT recipes.*, cuisines.name AS cuisine_name, users.username AS username, mealtypes.name AS meal_type_name
//             FROM recipes
//             JOIN cuisines ON recipes.cuisine_id = cuisines.id
//             JOIN users ON recipes.user_id = users.id
//             JOIN mealtypes ON recipes.meal_type_id = mealtypes.id  
//             WHERE mealtypes.name = $1
//             ORDER BY recipes.created_at DESC`, [mealType]);
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'No recipes found for this meal type.' });
//         }
//         res.json(result.rows);
//     } catch (error) {
//         console.error('Error fetching recipes by meal type:', error);
//         res.status(500).json({ message: 'An error occurred while fetching recipes by meal type.' });
//     }
// });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function getCuisineIdByName(cuisineName) {
    console.log("Looking up ID for cuisine:", cuisineName);

    try {
        // Assuming you're using a SQL-based database
        const result = await pool.query("SELECT id FROM cuisines WHERE name = $1", [cuisineName]);
        if (result.rows.length > 0) {
            console.log("Cuisine ID found:", result.rows[0].id);
            return result.rows[0].id;
        } else {
            console.log("No ID found for cuisine:", cuisineName);
            return null;
        }
    } catch (error) {
        console.error("Error in getCuisineIdByName:", error);
        // Handle error appropriately
    }
}
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






function extractMealTypeIdFromLine(line) {
    const mealTypeStart = line.indexOf('[Meal Type:]') + '[Meal Type:]'.length;
    const mealTypeEnd = line.length;  // Assuming the meal type is at the end of the line
    const mealType = line.slice(mealTypeStart, mealTypeEnd).trim();

    console.log("Extracted meal type:", mealType);  // Log the extracted meal type

    // Assuming your getMealTypeIdByName function can handle the extracted meal type correctly
    return getMealTypeIdByName(mealType);
}



// extractMealTypeIdFromLine('[Meal Type:] Dinner ');

async function transformResponseToRecipe(botResponse, cuisine) {
    const lines = botResponse.split('\n');

    // Extract the recipe name
    const nameLine = lines.find(line => line.includes("[Name:]"));
    const name = nameLine ? nameLine.slice(7).trim() : 'Default Recipe Name';

    
    // Extract ingredients
    const ingredientsStart = lines.findIndex(line => line.trim().startsWith("[Ingredients:]"));
    const ingredientsEnd = lines.findIndex((line, idx) => idx > ingredientsStart && line.trim().startsWith("[Instructions:]"));
    const ingredients = lines.slice(ingredientsStart + 1, ingredientsEnd).join('\n').trim();

    // Define the start of instructions
    const instructionsStart = ingredientsEnd;

    let instructions = '';
    let nutritionFacts = '';
    let isNutritionSection = false;

    for (let i = instructionsStart + 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith("[Macronutrient Breakdown:]")) {
            isNutritionSection = true;
            continue;
        }

        if (isNutritionSection) {
            nutritionFacts += lines[i].trim() + '\n';
        } else {
            instructions += lines[i].trim() + '\n';
        }
    }

    // Extract meal type and cuisine ID
    let mealTypeId;
    for (const line of lines) {
        if (line.includes('[Meal Type:]')) {
            mealTypeId = await extractMealTypeIdFromLine(line);
            break;  // Exit the loop once we've found and processed the meal type
        }
    }    

    const cuisineId = await getCuisineIdByName(cuisine);

    return {
        name,
        cuisineId,
        mealTypeId,
        ingredients,
        instructions: instructions.trim(),
        nutritionFacts: nutritionFacts.trim()
    };
}



router.post('/chatbot', authenticateToken, async (req, res) => {
    const userQuery = req.body.query;
    const cuisine = req.body.cuisine;
    const mealType = req.body.mealTypeId;

    const userId = req.user.id;
    console.log(userId);
    
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system",     content: `You are a chatbot specialized in ${cuisine} cuisine. Provide a recipe that includes the following details clearly separated and marked: Name of the dish within "[Name:]", list of ingredients within "[Ingredients:]", step-by-step instructions within "[Instructions:]", type of meal within and only one of the options, Breakfast, Lunch, Dinner, Dessert, Snack, Bread, Pastry, other"[Meal Type:] REMEMBER YOU CANNOT GIVE SOMETHING MORE THAN ONE MEAL", cuisine type within "[Cuisine:]", and macronutrient breakdown within "[Macronutrient Breakdown:]". Ensure each section is clearly separated by line breaks for easy parsing.
                ` },
                { role: "user", content: userQuery }
            ],
        }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    withCredentials: true
    });

        if (response.data.choices && response.data.choices.length > 0) {
            const botResponse = response.data.choices[0].message.content;
            console.log("Bot response:", botResponse);
            const transformedRecipe = await transformResponseToRecipe(botResponse, cuisine);
            transformedRecipe.userId = userId; 
            transformedRecipe.mealTypeId = transformedRecipe.mealTypeId || req.body.mealTypeId;
                console.log("Transformed recipe:", transformedRecipe);

                console.log("Transformed recipe with userId:", transformedRecipe);

            res.json({ recipe: transformedRecipe, reply: botResponse });
        } else {
            res.status(500).send("Chatbot response was not in the expected format.");
        }
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        res.status(500).send('Failed to fetch response from OpenAI');
    }
});

// Authenticated User Routes
router.use(authenticateToken);

router.post('/submit-recipe', async (req, res) => {
    const { name, cuisine, mealType, ingredients, instructions, rating, nutritionFacts } = req.body;
    const userId = req.user.id;
    try {
        const cuisineResult = await query('SELECT id FROM cuisines WHERE name = $1', [cuisine]);
        const cuisineId = cuisineResult.rows[0]?.id;
        const mealTypeResult = await query('SELECT id FROM mealtypes WHERE name = $1', [mealType]);
        const mealTypeId = mealTypeResult.rows[0]?.id;

        const result = await query(
            'INSERT INTO recipes (name, cuisine_id, meal_type_id, ingredients, instructions, rating, user_id, nutritionfacts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [name, cuisineId, mealTypeId, ingredients, instructions, rating, userId, nutritionFacts]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error inserting recipe:', error);
        res.status(500).json({ message: 'An error occurred while inserting the recipe.' });
    }
});

router.get('/my-recipes', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const recipes = await getRecipesByUserId(userId);
        res.json(recipes);
    } catch (error) {
        console.error('Error fetching saved recipes:', error);
        res.status(500).send('Failed to fetch saved recipes');
    }
});

router.post('/save-recipe', authenticateToken, async (req, res) => {
    const { recipeText } = req.body;
    console.log('Received recipeText:', recipeText);

    if (!recipeText) {
        console.log('No text provided to extractBetweenMarkers function');
        return res.status(400).json({ message: 'No recipe text provided' });
      }
    const userId = req.user.id;

    const name = extractBetweenMarkers(recipeText, "[Name:]", "[Ingredients:]").trim();
    const ingredients = extractBetweenMarkers(recipeText, "[Ingredients:]", "[Instructions:]").trim();
    const instructions = extractBetweenMarkers(recipeText, "[Instructions:]", "[Meal Type:]").trim();
    const mealType = extractBetweenMarkers(recipeText, "[Meal Type:]", "[Cuisine:]").trim();
    const cuisine = extractBetweenMarkers(recipeText, "[Cuisine:]", "[Macronutrient Breakdown:]").trim();
    const nutritionFacts = extractBetweenMarkers(recipeText, "[Macronutrient Breakdown:]", "").trim();

    // Assuming you have functions to convert mealType and cuisine to their respective IDs
    const cuisineId = await getCuisineIdByName(cuisine);
    const mealTypeId = await getMealTypeIdByName(mealType);

    const recipeData = {
        userId,
        name,
        ingredients,
        instructions,
        mealTypeId,
        cuisineId,
        nutritionFacts
    };

    try {
        const recipeId = await saveRecipeAndUserMapping(userId, recipeData);
        res.json({ message: 'Recipe saved successfully', recipeId });
    } catch (error) {
        console.error('Error saving recipe:', error);
        res.status(500).send('Failed to save recipe');
    }
});

router.get('/ai-recipes/:id(\\d+)', async (req, res) => {
    const recipeId = req.params.id;
    console.log("Requested recipe ID:", recipeId);

    try {
        const result = await pool.query(`
        SELECT ai_generated_recipes.*, 
                   cuisines.name AS cuisine_name, 
                   mealTypes.name AS meal_type_name
            FROM ai_generated_recipes 
            JOIN cuisines ON ai_generated_recipes.cuisine_id = cuisines.id
            JOIN mealTypes ON ai_generated_recipes.meal_type_id = mealTypes.id
            WHERE ai_generated_recipes.id = $1
        `, [recipeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Recipe not found"});
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting recipe:', error);
        res.status(500).json({ message: 'An error occurred while getting the recipe.' });
    }
});


function extractBetweenMarkers(text, startMarker, endMarker) {
    if (!text) {
        console.error('No text provided to extractBetweenMarkers function');
        return '';
    }
    const startIndex = text.indexOf(startMarker) + startMarker.length;
    const endIndex = endMarker ? text.indexOf(endMarker, startIndex) : text.length;
    if (startIndex === -1 || endIndex === -1) {
        console.error('Markers not found in text', { startMarker, endMarker });
        return '';
    }
    return text.slice(startIndex, endIndex).trim();
}



router.post('/recipes/:id/comments', authenticateToken, async (req, res) => {
    const recipeId = req.params.id; // Make sure this is correctly extracting the 'id'
    const userId = req.user.id;
    const { comment } = req.body;
    
    try {
        const result = await pool.query(
            `INSERT INTO comments (recipe_id, user_id, comment) VALUES ($1, $2, $3) RETURNING *`,
            [recipeId, userId, comment]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ message: 'Failed to post comment' });
    }
});

router.get('/recipes/:id/comments', authenticateToken, async (req, res) => {
    const {id: recipeId} = req.params;
    

    try {
        const result = await pool.query(
        `SELECT comments. *, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE recipe_id = $1 ORDER BY created_at DESC`,
        [recipeId]
);
res.json(result.rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
        
    }
})

router.delete('/recipes/:recipeId/comments/:commentId', authenticateToken, async (req, res) => {
    const { recipeId, commentId } = req.params;
    const userId = req.user.id; // Assuming you have a middleware to set req.user based on the authenticated user

    try {
        // Optional: Check if the comment belongs to the user attempting to delete it
        const ownershipResult = await pool.query('SELECT * FROM comments WHERE id = $1 AND user_id = $2', [commentId, userId]);
        if (ownershipResult.rows.length === 0) {
            return res.status(403).json({ message: 'You do not have permission to delete this comment.' });
        }

        // Proceed to delete the comment
        const deleteResult = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING *', [commentId]);
        
        if (deleteResult.rows.length > 0) {
            res.json({ message: 'Comment deleted successfully', deletedComment: deleteResult.rows[0] });
        } else {
            res.status(404).json({ message: 'Comment not found' });
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'An error occurred while deleting the comment.' });
    }
});





// Export the router
export default router;