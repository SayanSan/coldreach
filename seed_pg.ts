import { Client } from 'pg';
import bcrypt from 'bcryptjs';

async function main() {
    const client = new Client({
        connectionString: "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
    });
    
    try {
        await client.connect();
        
        const email = "admin@codevisionaryservices.com";
        const password = "CVS@rocks";
        
        const res = await client.query('SELECT email FROM users WHERE email = $1', [email]);
        if (res.rows.length > 0) {
            console.log("Admin user already exists.");
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Ensure crypto extension is loaded for gen_random_uuid if it's not native, but usually in PG 13+ it's native.
        await client.query(
            'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (gen_random_uuid(), $1, $2, $3, NOW())',
            [email, passwordHash, 'Admin']
        );
        console.log("SUCCESS! Admin user created.");
    } catch (e) {
        console.error("Error creating user directly via pg:", e);
    } finally {
        await client.end();
    }
}

main();
