-- 1. Table for scraped GitHub Trending repositories
CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    repo_name VARCHAR(255) UNIQUE NOT NULL,
    link TEXT NOT NULL,
    description TEXT,
    readme TEXT,
    language VARCHAR(100),
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for managing user sessions (active repo being questioned & selected AI model)
CREATE TABLE IF NOT EXISTS user_sessions (
    chat_id BIGINT PRIMARY KEY,
    active_repo VARCHAR(255),
    selected_model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration nếu bảng user_sessions đã tồn tại từ trước:
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS selected_model VARCHAR(100) DEFAULT 'gemini-2.5-flash';



-- 3. Table for storing user chat history (for conversational context)
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'user' or 'model'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table for managing subscribers (daily cron broadcasts for multiple users)
CREATE TABLE IF NOT EXISTS subscribers (
    chat_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Performance Indexes for multi-user scale
CREATE INDEX IF NOT EXISTS idx_chat_history_chat_id_created_at ON chat_history (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_scraped_at ON repositories (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers (is_active);

