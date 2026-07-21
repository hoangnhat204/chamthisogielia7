-- ==========================================
-- NEON SQL SETUP FOR SOGIELIA SEASON 7
-- Copy and run this script inside the Neon SQL Editor
-- ==========================================

-- 1. Clean up existing tables (if any)
DROP TABLE IF EXISTS archived_rounds CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Create tables
CREATE TABLE archived_rounds (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE users (
    username VARCHAR(100) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE teams (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mentors TEXT[] NOT NULL
);

CREATE TABLE candidates (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sbd VARCHAR(50) DEFAULT '',
    kahoot NUMERIC(4,2) DEFAULT 0,
    selected_r7 BOOLEAN DEFAULT FALSE,
    team_id VARCHAR(100) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    judge VARCHAR(100) REFERENCES users(username) ON DELETE CASCADE,
    candidate_id VARCHAR(100) REFERENCES candidates(id) ON DELETE CASCADE,
    ao_dai NUMERIC(4, 2) NULL,
    inspiration NUMERIC(4, 2) NULL,
    ung_xu NUMERIC(4, 2) NULL,
    details JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_judge_candidate UNIQUE (judge, candidate_id)
);

-- 3. Insert initial Users
INSERT INTO users (username, password, role) VALUES
('admin', 'matkhaula1', 'admin');

-- 4. Insert initial Teams
INSERT INTO teams (id, name, mentors) VALUES
('team_xanh_la', 'Team Xanh Lá', ARRAY['Lê Thanh Hải', 'Đoàn Khánh Thuần']),
('team_vang', 'Team Vàng', ARRAY['Võ Tấn Phát', 'Huỳnh Khánh Vân An']),
('team_xanh_bien', 'Team Xanh Biển', ARRAY['Đinh Huỳnh Thanh Trúc', 'Luna Hồ']),
('team_do', 'Team Đỏ', ARRAY['Nguyễn An Tâm', 'Trần Chí Tâm']);

-- 5. Insert initial Candidates (matches the exact spreadsheet layout)
INSERT INTO candidates (id, name, sbd, team_id) VALUES
('candidate_1783960000000', 'Dương Triệu Thiên Ý', '01', 'team_xanh_la'),
('candidate_1783960000001', 'Tống Phú Vinh', '02', 'team_vang'),
('candidate_1783960000002', 'Nguyễn Hoàng Trúc Huỳnh', '03', 'team_xanh_bien'),
('candidate_1783960000003', 'Trần Nhật Hải', '04', 'team_xanh_la'),
('candidate_1783960000004', 'Nguyễn Lê Vĩnh Phúc', '06', 'team_xanh_la'),
('candidate_1783960000005', 'Trần Văn Đệ', '07', 'team_do'),
('candidate_1783960000006', 'Phạm Phúc Khang', '08', 'team_do'),
('candidate_1783960000007', 'Huỳnh Đức Phong', '09', 'team_xanh_bien'),
('candidate_1783960000008', 'Nguyễn Minh Khôi', '10', 'team_xanh_la'),
('candidate_1783960000009', 'Nguyễn Phạm Phúc Vinh', '11', 'team_do'),
('candidate_1783960000010', 'Trần Như Khanh', '12', 'team_xanh_bien'),
('candidate_1783960000011', 'Nguyễn Thị Bích Tuyền', '14', 'team_vang'),
('candidate_1783960000012', 'Lương Tú Vi', '15', 'team_do');
