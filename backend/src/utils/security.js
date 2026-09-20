const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

const hashPassword = async (plain) => bcrypt.hash(plain, 10);
const comparePassword = async (plain, hash) => bcrypt.compare(plain, hash);

const signToken = (payload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = async (otp) => bcrypt.hash(otp, 8);

const compareOtp = async (otp, hash) => bcrypt.compare(otp, hash);

const generateCode = (prefix) => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `${prefix}-${y}${m}${d}-${rand}`;
};

const generateToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

const money = (value) => Number(Number(value || 0).toFixed(2));

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  generateOtp,
  hashOtp,
  compareOtp,
  generateCode,
  generateToken,
  money,
};
