const crypto = require("crypto");
const { promisify } = require("util");
const { db } = require("../data/db");
const { DEFAULT_STATS, findUserByIdentifier } = require("../data/helpers");
const { DEFAULT_COUNTRY_CODE, resolveCountryCode } = require("../config/countryConfig");

const scryptAsync = promisify(crypto.scrypt);
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,24}$/;

const sanitizeUsername = (value = "") => String(value || "").trim();

const toLocalEmail = (username) =>
  `${username.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase()}@local.5second`;

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
};

const verifyPassword = async (password, storedHash = "") => {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const storedBuffer = Buffer.from(key, "hex");
  const candidateBuffer = Buffer.from(derivedKey);

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, candidateBuffer);
};

const validateCredentials = ({ username, password }) => {
  const normalizedUsername = sanitizeUsername(username);
  const normalizedPassword = String(password || "");

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return {
      error:
        "Username must be 3-24 chars and use only letters, numbers, dot, underscore, or dash",
    };
  }

  if (normalizedPassword.length < 4) {
    return {
      error: "Password must be at least 4 characters",
    };
  }

  return {
    username: normalizedUsername,
    password: normalizedPassword,
  };
};

exports.signup = async (req, res) => {
  const validation = validateCredentials(req.body || {});

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const existing = await db("users")
      .whereRaw("LOWER(username) = LOWER(?)", [validation.username])
      .first();

    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await hashPassword(validation.password);
    const homeCountry = resolveCountryCode(req.body?.homeCountry, DEFAULT_COUNTRY_CODE);
    const [createdUser] = await db("users")
      .insert({
        username: validation.username,
        email: toLocalEmail(validation.username),
        avatar: null,
        stats: DEFAULT_STATS,
        followers: 0,
        home_country: homeCountry,
        ranking: 1000,
        password_hash: passwordHash,
      })
      .returning("*");

    const user = await findUserByIdentifier(createdUser.id);
    return res.status(201).json({ user });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Failed to create account" });
  }
};

exports.login = async (req, res) => {
  const validation = validateCredentials(req.body || {});

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const row = await db("users")
      .whereRaw("LOWER(username) = LOWER(?)", [validation.username])
      .first();

    if (!row?.password_hash) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await verifyPassword(validation.password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = await findUserByIdentifier(row.id);
    return res.json({ user });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to login" });
  }
};

exports.me = async (req, res) => {
  const identifier = String(req.query.userId || req.query.username || "").trim();

  if (!identifier) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Auth me error:", error);
    return res.status(500).json({ error: "Failed to load user" });
  }
};

exports.updateHomeCountry = async (req, res) => {
  const identifier = String(req.body?.userId || req.body?.username || "").trim();

  if (!identifier) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const homeCountry = resolveCountryCode(req.body?.homeCountry, user.homeCountry || DEFAULT_COUNTRY_CODE);

    await db("users")
      .where({ id: user.id })
      .update({
        home_country: homeCountry,
        updated_at: db.fn.now(),
      });

    return res.json({
      user: await findUserByIdentifier(user.id),
    });
  } catch (error) {
    console.error("Update home country error:", error);
    return res.status(500).json({ error: "Failed to update home country" });
  }
};
