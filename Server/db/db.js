// Correctly import the pg package and destructure Pool from it
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

// Initialize a connection pool
export const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  connectionString: process.env.DATABASE_URL,
});


// Async function to query the database
export const query = async (text, params) => {
  try {
    const response = await pool.query(text, params);
    return response; // This contains rows and other response properties
  } catch (err) {
    console.error('Query error', err.stack);
    throw err;
  }
};

// Assuming you have a db.js file where you've set up your database connection
/**
 * Save a recipe to the database for a specific user.
 * 
 * @param {number} userId - The ID of the user saving the recipe.
 * @param {object} recipe - The recipe object to save.
 * @returns {Promise<void>}
 */
export async function saveAIGeneratedRecipe(recipe) {
  const { name, cuisineId, mealTypeId, ingredients, instructions, userId, nutritionFacts } = recipe;

  // Validate required fields
  if (!name || !cuisineId || !mealTypeId || !ingredients || !instructions || !userId || !nutritionFacts) {
    throw new Error("Missing required recipe fields");
  }

  const sql = `
      INSERT INTO ai_generated_recipes (name, cuisine_id, meal_type_id, ingredients, instructions, user_id, nutrition_facts) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `;

  const values = [name, cuisineId, mealTypeId, ingredients, instructions, userId, nutritionFacts];

  try {
      const result = await query(sql, values);
      return result.rows[0].id; // Return the ID of the newly inserted recipe
  } catch (error) {
      console.error('Error saving AI-generated recipe to database:', error);
      throw error;
  }
}

export async function saveRecipe(recipeData) {
  try {
      // Construct the SQL query and parameters for inserting the recipe data
      const query = `
          INSERT INTO ai_generated_recipes (user_id, name, ingredients, instructions, meal_type_id, cuisine_id, nutrition_facts)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;  
      `;
      const values = [
          recipeData.userId,
          recipeData.name,
          recipeData.ingredients,
          recipeData.instructions,
          recipeData.mealTypeId,
          recipeData.cuisineId,
          recipeData.nutritionFacts
      ];

      // Execute the query
      const result = await pool.query(query, values);
      console.log('Recipe saved, ID:', result.rows[0].id);
      return result.rows[0]; // Return the saved recipe record
  } catch (error) {
      console.error('Error saving recipe in the database:', error);
      throw error; // Rethrow or handle as needed
  }
}

// Assuming this is in a file like dbOperations.js or a similar module
export async function getRecipesByUserId(userId) {
  const sql = `
  SELECT agr.*, c.name AS cuisine_name 
  FROM ai_generated_recipes agr
  JOIN cuisines c ON agr.cuisine_id = c.id
  WHERE agr.user_id = $1;
    `;

  try {
      const result = await query(sql, [userId]); // Execute the query
      return result.rows; // Return the rows from the query result
  } catch (error) {
      console.error('Error fetching recipes from database:', error);
      throw error; // Rethrow the error to be caught by the caller
  }
}

export async function saveRecipeAndUserMapping(userId, recipeData) {
  try {
      // Begin transaction
      await pool.query('BEGIN');

      // Save the recipe and get its ID
      // Ensure the order of fields in the INSERT statement matches the order of variables passed.
      const recipeResult = await pool.query(
          'INSERT INTO ai_generated_recipes (user_id, name, ingredients, instructions, meal_type_id, cuisine_id, nutrition_facts) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', 
          [userId, recipeData.name, recipeData.ingredients, recipeData.instructions, recipeData.mealTypeId, recipeData.cuisineId, recipeData.nutritionFacts]
      );
      const recipeId = recipeResult.rows[0].id;

      // Save the user-recipe mapping
      await pool.query(
          'INSERT INTO user_saved_recipes (user_id, recipe_id) VALUES ($1, $2)', 
          [userId, recipeId]
      );

      // Commit transaction
      await pool.query('COMMIT');

      return recipeId;
  } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      console.error('Error during saving recipe and user mapping:', error);
      throw error; // re-throw the error for further handling
  }
}
