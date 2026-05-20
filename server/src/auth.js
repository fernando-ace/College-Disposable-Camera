const jwt = require("jsonwebtoken");
const { jwtSecret } = require("./config");

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid auth token" });
  }
}

module.exports = { signToken, requireAuth };
