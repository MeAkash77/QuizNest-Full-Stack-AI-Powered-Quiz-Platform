import express from "express";
import { registerUser, loginUser, getAllUsers, updateUserRole, updateUserTheme, logoutUser, saveCustomTheme, getCustomThemes, deleteCustomTheme, bookmarkQuiz, removeBookmark, getBookmarkedQuizzes, getUserProfile, updateUserProfile, updateUserPreferences, updatePrivacySettings, changePassword, deleteAccount } from "../controllers/userController.js";
import { getStreakAndGoals, updateDailyGoals, updateDailyActivity } from "../controllers/streakController.js";
import { verifyToken } from "../middleware/auth.js";
import { roleUpdateLimiter } from "../middleware/rateLimiting.js";
import mongoose from "mongoose";
import { validate, registerSchema, loginSchema } from "../middleware/validation.js";
import cache, { clearCacheByPattern } from "../middleware/cache.js";

import passport from "passport";
import "../config/passport.js";
import UserQuiz from "../models/User.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.post("/register", validate(registerSchema), clearCacheByPattern("/api/users"), registerUser);
router.post("/login", validate(loginSchema), clearCacheByPattern("/api/users"), clearCacheByPattern("/api/dashboard"), loginUser);
router.post("/logout", async (req, res, next) => {
    if (!req.headers.authorization) {
        return res.json({ message: "Already logged out" });
    }
    verifyToken(req, res, next);
}, logoutUser);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

const normalizeIP = (ip) => {
    if (!ip || typeof ip !== 'string') return ip;
    if (ip === '::1' || ip === '::') {
        return '127.0.0.1';
    }
    const ipv4MappedMatch = ip.match(/^::ffff:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
    if (ipv4MappedMatch) {
        return ip.replace(/^::ffff:/, '');
    }
    return ip;
};

const isValidIP = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    const normalized = normalizeIP(ip);
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    const ipv4MappedRegex = /^::ffff:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(normalized) || ipv6Regex.test(ip) || ipv4MappedRegex.test(ip);
};

const getClientIP = (req) => {
    let ip = null;
    if (req.ip && isValidIP(req.ip)) {
        ip = req.ip;
        return ip;
    }
    if (req.headers['x-real-ip']) {
        const realIP = req.headers['x-real-ip'].trim();
        if (isValidIP(realIP)) {
            ip = realIP;
            return ip;
        }
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        const firstIP = ips[0];
        if (isValidIP(firstIP) && req.app.get('trust proxy')) {
            ip = firstIP;
            return ip;
        }
    }
    const remoteAddr = req.connection?.remoteAddress || req.socket?.remoteAddress;
    if (remoteAddr) {
        const cleanIP = remoteAddr.replace(/^::ffff:/, '');
        if (isValidIP(cleanIP)) {
            ip = cleanIP;
            return ip;
        }
    }
    return 'unknown';
};

// Google OAuth Callback - FIXED VERSION (redirects to /auth/success)
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/login" }),
    async (req, res) => {
        try {
            const { token, user: userData } = req.user;
            const userId = userData._id;

            const rawIP = getClientIP(req);
            const clientIP = normalizeIP(rawIP);
            const userAgent = req.headers['user-agent'] || 'unknown';

            const user = await UserQuiz.findById(userId);
            if (user) {
                user.isOnline = true;
                user.lastSeen = new Date();

                if (clientIP && clientIP !== 'unknown' && isValidIP(clientIP)) {
                    user.lastLoginIP = clientIP;
                    if (!user.loginIPHistory) {
                        user.loginIPHistory = [];
                    }
                    user.loginIPHistory.push({
                        ip: clientIP,
                        loginDate: new Date(),
                        userAgent: userAgent
                    });
                    if (user.loginIPHistory.length > 10) {
                        user.loginIPHistory = user.loginIPHistory.slice(-10);
                    }
                    await user.save();
                    logger.info(`Saved IP address for Google OAuth login for user ${userId}`);
                } else {
                    user.lastLoginIP = 'unknown';
                    await user.save();
                }
            }

            // ✅ Redirect to frontend auth success page
            const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
            res.redirect(`${frontendURL}/auth/success?token=${token}`);
            
        } catch (error) {
            logger.error({ message: "Error in Google OAuth callback", error: error.message, stack: error.stack });
            const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
            res.redirect(`${frontendURL}/login?error=auth_failed`);
        }
    }
);

router.get("/", verifyToken, cache, getAllUsers);
router.get("/me", verifyToken, async (req, res) => {
    try {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'ETag': `"${Date.now()}-${Math.random().toString(36).substring(7)}"`
        });

        if (!req.user?.id) {
            return res.status(401).json({ error: "Invalid token - no user ID" });
        }

        if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        const userWithPassword = await UserQuiz.findById(req.user.id);
        if (!userWithPassword) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = await UserQuiz.findById(req.user.id).select("-password");
        logger.info("✅ User found:", user?._id);

        const now = new Date();
        const lastSeen = user.lastSeen ? new Date(user.lastSeen) : null;
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        if (!lastSeen || lastSeen < fiveMinutesAgo) {
            user.lastSeen = now;
            if (!user.isOnline) {
                user.isOnline = true;
            }
            await user.save();
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            xp: user.xp || 0,
            totalXP: user.totalXP || 0,
            level: user.level || 1,
            loginStreak: user.loginStreak || 0,
            quizStreak: user.quizStreak || 0,
            badges: user.badges || [],
            unlockedThemes: user.unlockedThemes || [],
            selectedTheme: user.selectedTheme || "Default",
            customThemes: user.customThemes || [],
            isOnline: user.isOnline || false,
            lastSeen: user.lastSeen || new Date(),
        });
    } catch (err) {
        logger.error("❌ /me endpoint error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

router.get("/streak/goals", verifyToken, getStreakAndGoals);
router.put("/streak/goals", verifyToken, clearCacheByPattern("/api/users"), updateDailyGoals);
router.post("/streak/activity", verifyToken, clearCacheByPattern("/api/users"), clearCacheByPattern("/api/users/streak"), updateDailyActivity);

router.post("/bookmarks", verifyToken, clearCacheByPattern("/api/users"), bookmarkQuiz);
router.delete("/bookmarks", verifyToken, clearCacheByPattern("/api/users"), removeBookmark);
router.get("/bookmarks", verifyToken, getBookmarkedQuizzes);

router.get("/profile", verifyToken, getUserProfile);
router.put("/profile", verifyToken, clearCacheByPattern("/api/users"), updateUserProfile);
router.put("/preferences", verifyToken, clearCacheByPattern("/api/users"), updateUserPreferences);
router.put("/privacy", verifyToken, clearCacheByPattern("/api/users"), updatePrivacySettings);
router.put("/password", verifyToken, changePassword);
router.delete("/account", verifyToken, deleteAccount);

router.patch("/update-role", roleUpdateLimiter, verifyToken, clearCacheByPattern("/api/users"), updateUserRole);
router.post("/:id/theme", verifyToken, clearCacheByPattern("/api/users"), updateUserTheme);
router.post("/:id/custom-theme", verifyToken, clearCacheByPattern("/api/users"), saveCustomTheme);
router.get("/:id/custom-themes", verifyToken, getCustomThemes);
router.delete("/:id/custom-theme", verifyToken, clearCacheByPattern("/api/users"), deleteCustomTheme);

router.get("/:id", verifyToken, cache, async (req, res) => {
    try {
        const user = await UserQuiz.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            xp: user.xp || 0,
            totalXP: user.totalXP || 0,
            level: user.level || 1,
            loginStreak: user.loginStreak || 0,
            quizStreak: user.quizStreak || 0,
            badges: user.badges || [],
            unlockedThemes: user.unlockedThemes || [],
            selectedTheme: user.selectedTheme || "Default",
            customThemes: user.customThemes || [],
            isOnline: user.isOnline || false,
            lastSeen: user.lastSeen || new Date(),
        });
    } catch (err) {
        logger.error({ message: `Error fetching user ${req.params.id}`, error: err.message });
        res.status(500).json({ error: "User not found" });
    }
});

export default router;
