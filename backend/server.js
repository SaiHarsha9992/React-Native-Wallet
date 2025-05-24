import express from "express";
import dotenv from "dotenv";
import { sql } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;
app.use(express.json());
app.use(rateLimiter)
async function initDB(){
    try{
        await sql`CREATE TABLE IF NOT EXISTS transactions(
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            category VARCHAR(255) NOT NULL,
            created_at DATE NOT NULL DEFAULT CURRENT_DATE
        )`

        console.log(`Table created successfully`);
    } catch(err){
        console.error("Error creating table:", err);
        process.exit(1);
    }
}

app.get("/", (req, res) => {
    res.send("Welcome to the Expense Tracker API");
})

app.post("/api/transactions", async (req, res) => {
    
    try {
        const { user_id, title, amount, category } = req.body;
        if(!title || amount === undefined || !category || !user_id) {
            return res.status(400).json({ error: "All fields are required" });
        } 
        const transaction = await sql`
            INSERT INTO transactions (user_id, title, amount, category)
            VALUES (${user_id}, ${title}, ${amount}, ${category})
            RETURNING *;
        `;
        console.log("Transaction inserted:", transaction);
        res.status(201).json(transaction[0]);
    } catch (err) {
        console.error("Error inserting transaction:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/api/transactions/:userId", async (req, res) => {
    try{
        const { userId } = req.params;
        const transactions = await sql`
            SELECT * FROM transactions WHERE user_id = ${userId}
            ORDER BY created_at DESC;
        `;
        res.status(200).json(transactions); 
    } catch(err){
        console.error("Error fetching transactions:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

app.delete("/api/transactions/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql`
            DELETE FROM transactions WHERE id = ${id}
            RETURNING *;
        `;
        if (result.length === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.status(200).json({ message: "Transaction deleted successfully", transaction: result[0] });
    } catch (err) {
        console.error("Error deleting transaction:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

app.get("/api/transactions/summary/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
       const summary = await sql`
    SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = ${userId};
`;

        const incomeResult = await sql`
            SELECT COALESCE(SUM(amount), 0) as income FROM transactions WHERE user_id = ${userId} AND amount > 0;
        `;
        const expensesResult = await sql`
            SELECT COALESCE(SUM(amount), 0) as income FROM transactions WHERE user_id = ${userId} AND amount < 0;
        `;
        res.status(200).json({
            balance: summary[0].balance,
            income: incomeResult[0].income,
            expenses: expensesResult[0].income
        });
    } catch (err) {
        console.error("Error fetching summary:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

initDB().then(() => {
    app.listen(PORT, () => {
    console.log("Server is running on PORT:", PORT);
})
})