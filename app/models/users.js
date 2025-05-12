const db = require('../services/db');
const bcrypt = require("bcryptjs");

class User {
    id;
    email;
    name;

    constructor(email, name = null) {
        this.email = email;
        this.name = name;
    }

    async getIdFromEmail() {
        const sql = "SELECT id FROM Users WHERE email = ?";
        try {
            const result = await db.query(sql, [this.email]);
            if (result.length > 0) {
                this.id = result[0].id;
                return this.id;
            }
            return false;
        } catch (err) {
            console.error("Database error in getIdFromEmail:", err.message);
            return false;
        }
    }

    async getUserDetails() {
        try {
            const rows = await db.query('SELECT name, email, phone_number, gender, date_of_birth FROM Users WHERE email = ?', [this.email]);
            return rows.length > 0 ? rows[0] : null;
        } catch (err) {
            console.error('Error fetching user details:', err.message);
            return null;
        }
    }

    async updateUserDetails(name, phone_number, gender, date_of_birth) {
        try {
            const sql = 'UPDATE Users SET name = ?, phone_number = ?, gender = ?, date_of_birth = ? WHERE email = ?';
            await db.query(sql, [name, phone_number, gender, date_of_birth, this.email]);
            return true;
        } catch (err) {
            console.error('Error updating user details:', err.message);
            return false;
        }
    }

    async addAddress(address_type, address_line1, address_line2, city, state, country, postal_code) {
        try {
            if (!this.id) {
                await this.getIdFromEmail();
                if (!this.id) throw new Error('User ID not found');
            }
            const sql = 'INSERT INTO addresses (user_id, address_type, address_line1, address_line2, city, state, country, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            await db.query(sql, [this.id, address_type, address_line1, address_line2, city, state, country, postal_code]);
            return true;
        } catch (err) {
            console.error('Error adding address:', err.message);
            return false;
        }
    }

    async getAddresses() {
        try {
            const rows = await db.query('SELECT * FROM addresses WHERE user_id = ?', [this.id]);
            return rows;
        } catch (err) {
            console.error('Error fetching addresses:', err.message);
            return [];
        }
    }

    async updateAddress(id, address_type, address_line1, address_line2, city, state, country, postal_code) {
        try {
            const sql = 'UPDATE addresses SET address_type = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, country = ?, postal_code = ? WHERE id = ? AND user_id = ?';
            await db.query(sql, [address_type, address_line1, address_line2, city, state, country, postal_code, id, this.id]);
            return true;
        } catch (err) {
            console.error('Error updating address:', err.message);
            return false;
        }
    }

    async deleteAddress(id) {
        try {
            const sql = 'DELETE FROM addresses WHERE id = ? AND user_id = ?';
            await db.query(sql, [id, this.id]);
            return true;
        } catch (err) {
            console.error('Error deleting address:', err.message);
            return false;
        }
    }

    async getNameFromId(uId) {
        try {
            const rows = await db.query('SELECT name FROM Users WHERE id = ?', [uId]);
            return rows.length > 0 ? rows[0].name : null;
        } catch (err) {
            console.error('Error fetching name:', err.message);
            return null;
        }
    }

    async setUserPassword(password) {
        const pw = await bcrypt.hash(password, 10);
        const sql = "UPDATE Users SET password = ? WHERE id = ?";
        await db.query(sql, [pw, this.id]);
        return true;
    }

    async addUser(password) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = "INSERT INTO Users (email, password, name) VALUES (?, ?, ?)";
            const result = await db.query(sql, [this.email, hashedPassword, this.name]);
            return result.insertId;
        } catch (err) {
            console.error("Error adding user:", err.message);
            throw err;
        }
    }

    static async checkEmailExists(email) {
        const sql = "SELECT 1 FROM Users WHERE email = ?";
        const results = await db.query(sql, [email]);
        return results.length > 0;
    }

    async authenticate(submitted) {
        const sql = "SELECT password FROM Users WHERE id = ?";
        const result = await db.query(sql, [this.id]);
        const match = await bcrypt.compare(submitted, result[0].password);
        return match;
    }

    async setResetToken(token) {
        const sql = "UPDATE Users SET reset_token = ? WHERE email = ?";
        await db.query(sql, [token, this.email]);
    }

    static async getUserByToken(token) {
        const sql = "SELECT * FROM Users WHERE reset_token = ?";
        const result = await db.query(sql, [token]);
        if (result.length > 0) {
            const user = new User(result[0].email);
            user.id = result[0].id;
            return user;
        }
        return null;
    }

    async updatePassword(newPassword) {
        const pw = await bcrypt.hash(newPassword, 10);
        const sql = "UPDATE Users SET password = ?, reset_token = NULL WHERE id = ?";
        await db.query(sql, [pw, this.id]);
    }
}

module.exports = { User };