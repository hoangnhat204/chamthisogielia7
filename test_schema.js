const { pool } = require('./db');

async function test() {
    try {
        console.log("Checking DB schema...");
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'candidates';");
        console.log("Columns in candidates table:", res.rows);
    } catch (e) {
        console.error("DB error:", e.message);
    }
    process.exit();
}
test();
