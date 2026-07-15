const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const usePostgres = !!process.env.DATABASE_URL;
let pool = null;

if (usePostgres) {
    console.log('Database Mode: NEON (POSTGRESQL)');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Bỏ qua xác thực SSL nghiêm ngặt trên Vercel để tránh lỗi kết nối Neon
        }
    });

    // Tự động cập nhật Database (Auto-Migration)
    pool.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kahoot NUMERIC(4,2) DEFAULT 0')
        .then(() => console.log('Auto-migration: kahoot column checked.'))
        .catch(err => console.error('Auto-migration error:', err.message));

    pool.query(`CREATE TABLE IF NOT EXISTS archived_rounds (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )`).catch(err => console.error('Auto-migration archived_rounds error:', err.message));
} else {
    console.log('Database Mode: LOCAL JSON');
}

// Đường dẫn file lưu trữ cục bộ JSON
let usersFilePath = path.join(__dirname, 'users.json');
let contestFilePath = path.join(__dirname, 'contest.json');

// Sửa lỗi Read-only file system trên Vercel khi chạy bằng JSON
if (process.env.VERCEL) {
    const tmpUsersPath = path.join('/tmp', 'users.json');
    const tmpContestPath = path.join('/tmp', 'contest.json');
    if (!fs.existsSync(tmpUsersPath) && fs.existsSync(usersFilePath)) {
        fs.copyFileSync(usersFilePath, tmpUsersPath);
    }
    if (!fs.existsSync(tmpContestPath) && fs.existsSync(contestFilePath)) {
        fs.copyFileSync(contestFilePath, tmpContestPath);
    }
    usersFilePath = tmpUsersPath;
    contestFilePath = tmpContestPath;
}

const readJSON = (filePath, defaultVal) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 4));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const writeJSON = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
};

module.exports = {
    isPostgres: usePostgres,

    getUsers: async () => {
        if (usePostgres) {
            const res = await pool.query('SELECT * FROM users');
            return res.rows.map(u => ({ ...u, status: u.status || 'active' }));
        } else {
            const users = readJSON(usersFilePath, []);
            return users.map(u => ({ ...u, status: u.status || 'active' }));
        }
    },

    addUser: async (username, password, role) => {
        if (usePostgres) {
            await pool.query('INSERT INTO users (username, password, role, status) VALUES ($1, $2, $3, $4)', [username, password, role, 'active']);
        } else {
            const users = readJSON(usersFilePath, []);
            users.push({ username, password, role, status: 'active' });
            writeJSON(usersFilePath, users);
        }
    },

    toggleUserStatus: async (username) => {
        if (usePostgres) {
            const res = await pool.query('SELECT status FROM users WHERE username = $1', [username]);
            if (res.rows.length > 0) {
                const current = res.rows[0].status || 'active';
                const next = current === 'active' ? 'inactive' : 'active';
                await pool.query('UPDATE users SET status = $1 WHERE username = $2', [next, username]);
            }
        } else {
            let users = readJSON(usersFilePath, []);
            const user = users.find(u => u.username === username);
            if (user) {
                user.status = (user.status || 'active') === 'active' ? 'inactive' : 'active';
                writeJSON(usersFilePath, users);
            }
        }
    },

    deleteUser: async (username) => {
        if (usePostgres) {
            await pool.query('DELETE FROM users WHERE username = $1', [username]);
        } else {
            let users = readJSON(usersFilePath, []);
            users = users.filter(u => u.username !== username);
            writeJSON(usersFilePath, users);

            // Xóa điểm số liên quan đến giám khảo bị xóa
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            if (contest.scores) {
                contest.scores = contest.scores.filter(s => s.judge !== username);
                writeJSON(contestFilePath, contest);
            }
        }
    },

    getContestData: async () => {
        if (usePostgres) {
            const teams = await pool.query('SELECT * FROM teams');
            const candidates = await pool.query('SELECT * FROM candidates');

            // Ánh xạ tên cột từ Snake Case (Postgres) sang Camel Case (Frontend JS)
            const mappedCandidates = candidates.rows.map(c => ({
                id: c.id,
                name: c.name,
                sbd: c.sbd,
                teamId: c.team_id,
                kahoot: c.kahoot ? parseFloat(c.kahoot) : 0
            }));

            const scores = await pool.query('SELECT * FROM scores');
            const mappedScores = scores.rows.map(s => ({
                judge: s.judge,
                candidateId: s.candidate_id,
                aoDai: s.ao_dai ? parseFloat(s.ao_dai) : undefined,
                inspiration: s.inspiration ? parseFloat(s.inspiration) : undefined
            }));

            return {
                teams: teams.rows,
                candidates: mappedCandidates,
                scores: mappedScores
            };
        } else {
            const data = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            if (!data.teams) data.teams = [];
            if (!data.candidates) data.candidates = [];
            if (!data.scores) data.scores = [];
            return data;
        }
    },

    addTeam: async (id, name, mentors) => {
        if (usePostgres) {
            await pool.query('INSERT INTO teams (id, name, mentors) VALUES ($1, $2, $3)', [id, name, mentors]);
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            contest.teams.push({ id, name, mentors });
            writeJSON(contestFilePath, contest);
        }
    },

    deleteTeam: async (teamId) => {
        if (usePostgres) {
            await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            contest.teams = contest.teams.filter(t => t.id !== teamId);
            const candidatesToDelete = contest.candidates.filter(c => c.teamId === teamId);
            const candidateIdsToDelete = candidatesToDelete.map(c => c.id);
            contest.candidates = contest.candidates.filter(c => c.teamId !== teamId);
            contest.scores = contest.scores.filter(s => !candidateIdsToDelete.includes(s.candidateId));
            writeJSON(contestFilePath, contest);
        }
    },

    addCandidate: async (id, name, sbd, teamId) => {
        if (usePostgres) {
            await pool.query('INSERT INTO candidates (id, name, sbd, team_id, kahoot) VALUES ($1, $2, $3, $4, 0)', [id, name, sbd, teamId]);
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            contest.candidates.push({ id, name, sbd, teamId, kahoot: 0 });
            writeJSON(contestFilePath, contest);
        }
    },

    deleteCandidate: async (candidateId) => {
        if (usePostgres) {
            await pool.query('DELETE FROM candidates WHERE id = $1', [candidateId]);
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            contest.candidates = contest.candidates.filter(c => c.id !== candidateId);
            contest.scores = contest.scores.filter(s => s.candidateId !== candidateId);
            writeJSON(contestFilePath, contest);
        }
    },

    updateKahoot: async (candidateId, kahootVal) => {
        if (usePostgres) {
            await pool.query('UPDATE candidates SET kahoot = $1 WHERE id = $2', [kahootVal, candidateId]);
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            const cand = contest.candidates.find(c => c.id === candidateId);
            if (cand) {
                cand.kahoot = kahootVal;
                writeJSON(contestFilePath, contest);
            }
        }
    },

    saveScore: async (judge, candidateId, aoDai, inspiration) => {
        if (usePostgres) {
            const existing = await pool.query('SELECT * FROM scores WHERE judge = $1 AND candidate_id = $2', [judge, candidateId]);
            if (existing.rows.length > 0) {
                if (typeof aoDai !== 'undefined') {
                    await pool.query('UPDATE scores SET ao_dai = $1 WHERE judge = $2 AND candidate_id = $3', [aoDai, judge, candidateId]);
                } else if (typeof inspiration !== 'undefined') {
                    await pool.query('UPDATE scores SET inspiration = $1 WHERE judge = $2 AND candidate_id = $3', [inspiration, judge, candidateId]);
                }
            } else {
                const ad = typeof aoDai !== 'undefined' ? aoDai : 0;
                const ins = typeof inspiration !== 'undefined' ? inspiration : 0;
                await pool.query('INSERT INTO scores (judge, candidate_id, ao_dai, inspiration) VALUES ($1, $2, $3, $4)', [judge, candidateId, ad, ins]);
            }
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });
            const existingScoreIdx = contest.scores.findIndex(s => s.candidateId === candidateId && s.judge === judge);
            let currentScore = existingScoreIdx > -1 ? contest.scores[existingScoreIdx] : {
                judge: judge,
                candidateId: candidateId
            };

            if (typeof aoDai !== 'undefined') currentScore.aoDai = aoDai;
            if (typeof inspiration !== 'undefined') currentScore.inspiration = inspiration;

            if (existingScoreIdx > -1) {
                contest.scores[existingScoreIdx] = currentScore;
            } else {
                contest.scores.push(currentScore);
            }
            writeJSON(contestFilePath, contest);
        }
    },

    resetScores: async () => {
        if (usePostgres) {
            await pool.query('DELETE FROM scores');
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [], archivedRounds: [] });
            contest.scores = [];
            writeJSON(contestFilePath, contest);
        }
    },

    archiveCurrentRound: async (roundName) => {
        if (usePostgres) {
            const scoresData = await pool.query('SELECT * FROM scores');
            const dataToArchive = { scores: scoresData.rows };
            await pool.query('INSERT INTO archived_rounds (name, data) VALUES ($1, $2)', [roundName, JSON.stringify(dataToArchive)]);
            await pool.query('DELETE FROM scores');
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [], archivedRounds: [] });
            if (!contest.archivedRounds) contest.archivedRounds = [];
            contest.archivedRounds.push({
                id: 'round_' + Date.now(),
                name: roundName,
                scores: [...contest.scores],
                createdAt: new Date().toISOString()
            });
            contest.scores = [];
            writeJSON(contestFilePath, contest);
        }
    },

    getArchivedRounds: async () => {
        if (usePostgres) {
            const res = await pool.query('SELECT * FROM archived_rounds ORDER BY created_at DESC');
            return res.rows.map(r => ({
                id: r.id,
                name: r.name,
                scores: r.data.scores.map(s => ({
                    judge: s.judge,
                    candidateId: s.candidate_id,
                    aoDai: s.ao_dai ? parseFloat(s.ao_dai) : undefined,
                    inspiration: s.inspiration ? parseFloat(s.inspiration) : undefined
                })),
                createdAt: r.created_at
            }));
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [], archivedRounds: [] });
            return contest.archivedRounds || [];
        }
    },

    importData: async (teams, candidates) => {
        if (usePostgres) {
            // Nhập Đội Mentor
            for (const newTeam of teams) {
                const existing = await pool.query('SELECT id FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [newTeam.name]);
                if (existing.rows.length === 0) {
                    const teamId = 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    await pool.query('INSERT INTO teams (id, name, mentors) VALUES ($1, $2, $3)', [teamId, newTeam.name.trim(), newTeam.mentors]);
                    newTeam.mappedId = teamId;
                } else {
                    newTeam.mappedId = existing.rows[0].id;
                    const curTeam = await pool.query('SELECT mentors FROM teams WHERE id = $1', [newTeam.mappedId]);
                    const currentMentors = curTeam.rows[0].mentors || [];
                    newTeam.mentors.forEach(m => {
                        if (!currentMentors.map(x => x.toLowerCase()).includes(m.trim().toLowerCase())) {
                            currentMentors.push(m.trim());
                        }
                    });
                    await pool.query('UPDATE teams SET mentors = $1 WHERE id = $2', [currentMentors, newTeam.mappedId]);
                }
            }

            // Nhập Thí sinh
            for (const newCand of candidates) {
                const teamRef = teams.find(t => t.name.trim().toLowerCase() === newCand.teamName.trim().toLowerCase());
                let targetTeamId = null;
                if (teamRef) {
                    targetTeamId = teamRef.mappedId;
                } else {
                    const existingTeam = await pool.query('SELECT id FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [newCand.teamName]);
                    if (existingTeam.rows.length > 0) {
                        targetTeamId = existingTeam.rows[0].id;
                    }
                }

                if (targetTeamId) {
                    const existingCand = await pool.query('SELECT id FROM candidates WHERE team_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))', [targetTeamId, newCand.name]);
                    if (existingCand.rows.length === 0) {
                        const candId = 'candidate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                        await pool.query('INSERT INTO candidates (id, name, sbd, team_id, kahoot) VALUES ($1, $2, $3, $4, 0)', [
                            candId, newCand.name.trim(), newCand.sbd ? String(newCand.sbd).trim() : '', targetTeamId
                        ]);
                    } else {
                        if (newCand.sbd) {
                            await pool.query('UPDATE candidates SET sbd = $1 WHERE id = $2', [String(newCand.sbd).trim(), existingCand.rows[0].id]);
                        }
                    }
                }
            }
        } else {
            const contest = readJSON(contestFilePath, { teams: [], candidates: [], scores: [] });

            // 1. Nhập Đội Mentor
            teams.forEach(newTeam => {
                let existingTeam = contest.teams.find(t => t.name.trim().toLowerCase() === newTeam.name.trim().toLowerCase());
                if (!existingTeam) {
                    const teamId = 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    const teamObj = {
                        id: teamId,
                        name: newTeam.name.trim(),
                        mentors: newTeam.mentors.map(m => m.trim()).filter(m => m !== '')
                    };
                    contest.teams.push(teamObj);
                    newTeam.mappedId = teamId;
                } else {
                    newTeam.mappedId = existingTeam.id;
                    newTeam.mentors.forEach(m => {
                        const trimmedM = m.trim();
                        if (trimmedM !== '' && !existingTeam.mentors.map(x => x.toLowerCase()).includes(trimmedM.toLowerCase())) {
                            existingTeam.mentors.push(trimmedM);
                        }
                    });
                }
            });

            // 2. Nhập Thí sinh
            candidates.forEach(newCand => {
                const teamRef = teams.find(t => t.name.trim().toLowerCase() === newCand.teamName.trim().toLowerCase());
                let targetTeamId = null;
                if (teamRef) {
                    targetTeamId = teamRef.mappedId;
                } else {
                    const existingTeam = contest.teams.find(t => t.name.trim().toLowerCase() === newCand.teamName.trim().toLowerCase());
                    if (existingTeam) {
                        targetTeamId = existingTeam.id;
                    }
                }

                if (targetTeamId) {
                    const candNameLower = newCand.name.trim().toLowerCase();
                    const existingCand = contest.candidates.find(c => c.teamId === targetTeamId && c.name.trim().toLowerCase() === candNameLower);

                    if (!existingCand) {
                        contest.candidates.push({
                            id: 'candidate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                            name: newCand.name.trim(),
                            sbd: newCand.sbd ? String(newCand.sbd).trim() : '',
                            teamId: targetTeamId,
                            kahoot: 0
                        });
                    } else {
                        if (newCand.sbd) {
                            existingCand.sbd = String(newCand.sbd).trim();
                        }
                    }
                }
            });

            writeJSON(contestFilePath, contest);
        }
    }
};
