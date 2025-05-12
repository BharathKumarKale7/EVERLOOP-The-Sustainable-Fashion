// Import database service and bcrypt for password hashing
const db = require('../services/db');
const bcrypt = require("bcryptjs");

// User class to manage user-related operations
class User {
    id;
    email; 
    name; 

    // Constructor to initialize email and optional name
    constructor(email, name = null) {
        this.email = email;
        this.name = name;
    }

    // Retrieves user ID from email
    async getIdFromEmail() {
        const sql = "SELECT id FROM Users WHERE email = ?";
        try {
            const result = await db.query(sql, [this.email]);
            if (result.length > 0) {
                this.id = result[0].id; // Set instance ID
                return this.id;
            }
            return false; // Return false if user not found
        } catch (err) {
            console.error("Database error in getIdFromEmail:", err.message);
            return false; // Handle database errors
        }
    }

    // Fetches user details (name, email, phone, gender, DOB) by email
    async getUserDetails() {
        try {
            const rows = await db.query('SELECT name, email, phone_number, gender, date_of_birth FROM Users WHERE email = ?', [this.email]);
            return rows.length > 0 ? rows[0] : null; // Return user details or null if not found
        } catch (err) {
            console.error('Error fetching user details:', err.message);
            return null; // Handle database errors
        }
    }

    // Updates user details in the database
    async updateUserDetails(name, phone_number, gender, date_of_birth) {
        try {
            const sql = 'UPDATE Users SET name = ?, phone_number = ?, gender = ?, date_of_birth = ? WHERE email = ?';
            await db.query(sql, [name, phone_number, gender, date_of_birth, this.email]);
            return true; // Return true on successful update
        } catch (err) {
            console.error('Error updating user details:', err.message);
            return false; // Handle database errors
        }
    }

    // Adds a new address for the user
    async addAddress(address_type, address_line1, address_line2, city, state, country, postal_code) {
        try {
            if (!this.id) {
                await this.getIdFromEmail(); // Ensure user ID is set
                if (!this.id) throw new Error('User ID not found');
            }
            const sql = 'INSERT INTO addresses (user_id, address_type, address_line1, address_line2, city, state, country, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            await db.query(sql, [this.id, address_type, address_line1, address_line2, city, state, country, postal_code]);
            return true; // Return true on successful insertion
        } catch (err) {
            console.error('Error adding address:', err.message);
            return false; // Handle errors
        }
    }

    // Retrieves all addresses for the user
    async getAddresses() {
        try {
            const rows = await db.query('SELECT * FROM addresses WHERE user_id = ?', [this.id]);
            return rows; // Return array of addresses
        } catch (err) {
            console.error('Error fetching addresses:', err.message);
            return []; // Return empty array on error
        }
    }

    // Updates an existing address by ID
    async updateAddress(id, address_type, address_line1, address_line2, city, state, country, postal_code) {
        try {
            const sql = 'UPDATE addresses SET address_type = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, country = ?, postal_code = ? WHERE id = ? AND user_id = ?';
            await db.query(sql, [address_type, address_line1, address_line2, city, state, country, postal_code, id, this.id]);
            return true; // Return true on successful update
        } catch (err) {
            console.error('Error updating address:', err.message);
            return false; // Handle errors
        }
    }

    // Deletes an address by ID
    async deleteAddress(id) {
        try {
            const sql = 'DELETE FROM addresses WHERE id = ? AND user_id = ?';
            await db.query(sql, [id, this.id]);
            return true; // Return true on successful deletion
        } catch (err) {
            console.error('Error deleting address:', err.message);
            return false; // Handle errors
        }
    }

    // Fetches user name by user ID
    async getNameFromId(uId) {
        try {
            const rows = await db.query('SELECT name FROM Users WHERE id = ?', [uId]);
            return rows.length > 0 ? rows[0].name : null; // Return name or null if not found
        } catch (err) {
            console.error('Error fetching name:', err.message);
            return null; // Handle errors
        }
    }

    // Sets or updates user password
    async setUserPassword(password) {
        const pw = await bcrypt.hash(password, 10); // Hash password with bcrypt
        const sql = "UPDATE Users SET password = ? WHERE id = ?";
        await db.query(sql, [pw, this.id]);
        return true; // Return true on success
    }

    // Adds a new user to the database
    async addUser(password) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10); // Hash password
            const sql = "INSERT INTO Users (email, password, name) VALUES (?, ?, ?)";
            const result = await db.query(sql, [this.email, hashedPassword, this.name]);
            return result.insertId; // Return the new user's ID
        } catch (err) {
            console.error("Error adding user:", err.message);
            throw err; // Rethrow error for caller to handle
        }
    }

    // Static method to check if an email already exists in the database
    static async checkEmailExists(email) {
        const sql = "SELECT 1 FROM Users WHERE email = ?";
        const results = await db.query(sql, [email]);
        return results.length > 0; // Return true if email exists
    }

    // Authenticates user by comparing submitted password with stored hash
    async authenticate(submitted) {
        const sql = "SELECT password FROM Users WHERE id = ?";
        const result = await db.query(sql, [this.id]);
        const match = await bcrypt.compare(submitted, result[0].password); // Compare passwords
        return match; // Return true if passwords match
    }

    // Sets a password reset token for the user
    async setResetToken(token) {
        const sql = "UPDATE Users SET reset_token = ? WHERE email = ?";
        await db.query(sql, [token, this.email]);
    }

    // Static method to retrieve a user by reset token
    static async getUserByToken(token) {
        const sql = "SELECT * FROM Users WHERE reset_token = ?";
        const result = await db.query(sql, [token]);
        if (result.length > 0) {
            const user = new User(result[0].email); // Create new User instance
            user.id = result[0].id; // Set user ID
            return user; // Return user object
        }
        return null; // Return null if no user found
    }

    // Updates user password and clears reset token
    async updatePassword(newPassword) {
        const pw = await bcrypt.hash(newPassword, 10); // Hash new password
        const sql = "UPDATE Users SET password = ?, reset_token = NULL WHERE id = ?";
        await db.query(sql, [pw, this.id]);
    }
}

// Export the User class
module.exports = { User };