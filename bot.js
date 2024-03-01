const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const User = require('./models/User');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');

// Load admin panel
const adminPanel = require('./admin-panel');

const botToken = 'YOUR_TELEGRAM_BOT_TOKEN';
const weatherApiKey = 'YOUR_OPENWEATHERMAP_API_KEY';

const bot = new TelegramBot(botToken, { polling: true });
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Temporary data store (you should use a database in a real-world scenario)
const adminSettings = {
  apiKey: 'YOUR_API_KEY',
  messageFrequency: 24, // in hours
};

// Middleware to check if the request is from an admin
const isAdmin = (req, res, next) => {
  // You should implement proper authentication and authorization logic here
  // For simplicity, using a hardcoded API key
  const providedApiKey = req.headers['x-api-key'];
  if (providedApiKey && providedApiKey === adminSettings.apiKey) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
};

// Admin panel route
app.get('/admin', isAdmin, (req, res) => {
  res.render('admin', { adminSettings });
});

// Update admin settings route
app.post('/admin/update', isAdmin, (req, res) => {
  const { apiKey, messageFrequency } = req.body;

  // Update temporary data store (you should update the database in a real-world scenario)
  adminSettings.apiKey = apiKey;
  adminSettings.messageFrequency = parseInt(messageFrequency);

  res.redirect('/admin');
});

// Mount the admin panel at /admin
app.use('/admin', adminPanel);

// Event listener for new users
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if user already exists
  const existingUser = await User.findOne({ telegramId: chatId });
  if (existingUser) {
    bot.sendMessage(chatId, 'Welcome back!');
  } else {
    // Get user information
    bot.sendMessage(chatId, 'Hello! What is your name?');
    bot.once('text', async (name) => {
      bot.sendMessage(chatId, `Nice to meet you, ${name.text}! What city are you in?`);
      bot.once('text', async (city) => {
        bot.sendMessage(chatId, `Got it! And in which country is ${city.text} located?`);
        bot.once('text', async (country) => {
          // Save user information to MongoDB
          await User.create({
            telegramId: chatId,
            name: name.text,
            city: city.text,
            country: country.text,
          });

          bot.sendMessage(chatId, `Thank you! Your information has been saved.`);
        });
      });
    });
  }
});

// Event listener for daily weather updates
setInterval(() => {
  User.find({}, 'telegramId city country', async (err, users) => {
    if (err) {
      console.error(err);
      return;
    }

    for (const user of users) {
      try {
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${user.city},${user.country}&appid=${weatherApiKey}`
        );

        const weatherDescription = response.data.weather[0].description;
        const temperature = response.data.main.temp;

        bot.sendMessage(
          user.telegramId,
          `Weather Update:\n${weatherDescription}\nTemperature: ${temperature}°C`
        );
      } catch (error) {
        console.error(error);
      }
    }
  });
}, adminSettings.messageFrequency * 60 * 60 * 1000);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/telegram-bot', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Start Express app for the admin panel
app.listen(port, () => {
  console.log(`Bot and Admin Panel listening at http://localhost:${port}`);
});
