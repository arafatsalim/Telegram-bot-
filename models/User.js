const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: { type: String },
  city: { type: String },
  country: { type: String },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
