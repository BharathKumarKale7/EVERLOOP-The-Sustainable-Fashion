-- Table to store user account details
CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,                          -- Unique identifier for each user
    email VARCHAR(255) UNIQUE NOT NULL,                         -- User's email (must be unique)
    password VARCHAR(255) NOT NULL,                             -- Hashed password
    name VARCHAR(255),                                          -- User's full name
    phone_number VARCHAR(20),                                   -- Optional phone number
    gender ENUM('male', 'female', 'other'),                     -- Gender with limited predefined options
    date_of_birth DATE,                                         -- Date of birth
    reset_token VARCHAR(255),                                   -- Token for password reset flow
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP              -- Timestamp of account creation
);

-- Table to store multiple addresses for a user
CREATE TABLE addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,                          -- Unique identifier for each address
    user_id INT,                                                -- FK: ID of the user this address belongs to
    address_type VARCHAR(50),                                   -- e.g., 'home', 'work'
    address_line1 VARCHAR(255),                                 -- Street address
    address_line2 VARCHAR(255),                                 -- Optional second address line
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE -- Delete address if the user is deleted
);

-- Table to store catalog items
CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                                 -- Name of the product
    description VARCHAR(255) NOT NULL,                          -- Short description
    price DECIMAL(10, 2) NOT NULL,                              -- Product price
    image VARCHAR(255) NOT NULL,                                -- Image URL or path
    category VARCHAR(50) NOT NULL,                              -- Product category
    discount INT DEFAULT 0                                      -- Discount percentage
);

-- Table for cart items specific to a user
CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,                                                -- FK: Owner of the cart item
    item_id INT,                                                -- FK: Item added to the cart
    name VARCHAR(255),                                          -- Item name (duplicated for faster access)
    image VARCHAR(255),                                         -- Item image
    description TEXT,                                           -- Item description
    price DECIMAL(10,2),                                        -- Item price at time of adding to cart
    quantity INT,                                               -- Number of items
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Table for items users wish to buy later
CREATE TABLE wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,                                                -- FK: Owner of the wishlist
    item_id INT,                                                -- FK: Item added to wishlist
    name VARCHAR(255),
    image VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Table to store individual orders
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,                                                -- FK: Who placed the order
    address_id INT,                                             -- FK: Shipping address used
    total DECIMAL(10,2),                                        -- Total order cost
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL -- Keep order if address deleted
);

-- Table to store items that are part of an order
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,                                               -- FK: Which order this item belongs to
    item_id INT,                                                -- FK: Item being ordered
    name VARCHAR(255),
    price DECIMAL(10,2),                                        -- Price at time of order
    quantity INT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL -- Retain record if item deleted
);

-- Table to store newsletter subscribers
CREATE TABLE subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,                         -- Subscriber's email
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP              -- Timestamp of subscription
);
