require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let User;

const userSchema = new mongoose.Schema({
    userName: { type: String, unique: true },
    password: String,
    email: String,
    loginHistory: [{ dateTime: Date, userAgent: String }]
});

const initialize = () => {
    return new Promise((resolve, reject) => {
        mongoose
            .connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
            .then(() => {
                User = mongoose.model('User', userSchema); // Initialize the User model
                resolve();
            })
            .catch((err) => reject("Failed to initialize MongoDB: " + err));
    });
};

const registerUser = (userData) => {
    return new Promise((resolve, reject) => {
        if (userData.password !== userData.password2) {
            return reject("Passwords do not match.");
        }

        bcrypt
            .hash(userData.password, 10)
            .then((hash) => {
                userData.password = hash;
                const newUser = new User(userData);

                return newUser.save();
            })
            .then(() => resolve())
            .catch((err) => {
                if (err.code === 11000) {
                    reject("User Name already taken.");
                } else {
                    reject("There was an error creating the user: " + err);
                }
            });
    });
};

const checkUser = (userData) => {
    return new Promise((resolve, reject) => {
        User.findOne({ userName: userData.userName })
            .then((user) => {
                if (!user) {
                    return reject("Unable to find user: " + userData.userName);
                }

                return bcrypt.compare(userData.password, user.password).then((match) => {
                    if (!match) {
                        return reject("Incorrect Password for user: " + userData.userName);
                    }

                    user.loginHistory.push({
                        dateTime: new Date().toString(),
                        userAgent: userData.userAgent
                    });

                    return User.updateOne(
                        { userName: user.userName },
                        { $set: { loginHistory: user.loginHistory } }
                    )
                        .then(() => resolve(user))
                        .catch((err) => reject("There was an error verifying the user: " + err));
                });
            })
            .catch((err) => reject("Unable to find user: " + userData.userName));
    });
};
module.exports = { initialize, registerUser, checkUser };
