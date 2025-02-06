const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const countryData = require('./data/countryData.json');
const subRegionData = require('./data/subRegionData.json');
const clientSessions = require("client-sessions");
const authService = require('./modules/auth-service'); // Added auth-service module

/********************************************************************************
 * WEB322 – Assignment 06
 *
 * I declare that this assignment is my own work in accordance with Seneca's
 * Academic Integrity Policy:
 *
 * https://www.senecacollege.ca/about/policies/academic-integrity-policy.html
 *
 * Name: Seyed Arsam Pak Seresht Student ID: 154291231 Date: 6th Dec 2024
 *
 * Published URL:
 *
 ********************************************************************************/

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // Middleware for parsing POST data
app.use(express.json()); // Middleware for JSON data
app.use(express.static('public'));
app.use(clientSessions({
    cookieName: "session",
    secret: "yourSecretStringHere",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}

const countryService = require('./modules/country-service');
Promise.all([
    countryService.initialize(countryData, subRegionData),
    authService.initialize()
])
    .then(() => {
        console.log("App initialized and services started successfully.");
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error("Error initializing app:", err);
    });

app.get('/login', (req, res) => {
    res.render('login', { errorMessage: null, userName: null });
});

app.get('/register', (req, res) => {
    res.render('register', { errorMessage: null, successMessage: null, userName: null });
});

app.post('/register', (req, res) => {
    authService.registerUser(req.body)
        .then(() => {
            res.render('register', { successMessage: "User created", errorMessage: null, userName: null });
        })
        .catch((err) => {
            res.render('register', { errorMessage: err, successMessage: null, userName: req.body.userName });
        });
});

app.post('/login', (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authService.checkUser(req.body)
        .then((user) => {
            req.session.user = {
                userName: user.userName,
                email: user.email,
                loginHistory: user.loginHistory
            };
            res.redirect('/countries');
        })
        .catch((err) => {
            res.render('login', { errorMessage: err, userName: req.body.userName });
        });
});

app.get('/logout', (req, res) => {
    req.session.reset();
    res.redirect('/');
});

app.get('/userHistory', ensureLogin, (req, res) => {
    res.render('userHistory', { user: req.session.user });
});

app.get('/', (req, res) => {
    res.render("home");
});

app.get('/about', (req, res) => {
    res.render("about");
});

app.get("/countries", (req, res) => {
    const { region, subRegion } = req.query;

    if (region) {
        countryService.getCountriesByRegion(region)
            .then(countries => res.render("Countries", { countries, filter: `Region: ${region}` }))
            .catch(err => res.status(404).render("404", { message: "Region not found", details: err }));
    } else if (subRegion) {
        countryService.getCountriesBySubRegion(subRegion)
            .then(countries => res.render("Countries", { countries, filter: `Subregion: ${subRegion}` }))
            .catch(err => res.status(404).render("404", { message: "Subregion not found", details: err }));
    } else {
        countryService.getAllCountries()
            .then(countries => res.render("Countries", { countries }))
            .catch(err => res.status(404).render("404", { message: "No countries found", details: err }));
    }
});

app.get("/countries/:id", (req, res) => {
    const countryId = req.params.id;

    countryService.getCountryById(countryId)
        .then(country => res.render("Country", { country }))
        .catch(err => res.status(404).render("404", { message: "Country not found", details: err }));
});

app.get('/addCountry', ensureLogin, (req, res) => {
    countryService.getAllSubRegions()
        .then(subRegions => {
            res.render('addCountry', { subRegions });
        })
        .catch(err => res.status(404).render('404', { message: "Failed to load subregions", details: err }));
});

app.post('/addCountry', ensureLogin, (req, res) => {
    countryService.addCountry(req.body)
        .then(() => res.redirect('/countries'))
        .catch(err => {
            console.error("Error adding country:", err);
            res.status(400).render('404', { message: "Failed to add country", details: err.message });
        });
});

app.get('/editCountry/:id', ensureLogin, (req, res) => {
    const countryId = req.params.id;

    Promise.all([countryService.getCountryById(countryId), countryService.getAllSubRegions()])
        .then(([country, subRegions]) => {
            res.render('editCountry', { country, subRegions });
        })
        .catch(err => res.status(404).render("404", { message: "Failed to load country for editing", details: err }));
});

app.post('/editCountry/:id', ensureLogin, (req, res) => {
    const countryId = req.params.id;

    countryService.editCountry(countryId, req.body)
        .then(() => res.redirect('/countries'))
        .catch(err => {
            console.error("Error editing country:", err);
            res.status(400).render('404', { message: `Error editing country: ${err.message}` });
        });
});

app.post('/deleteCountry/:id', ensureLogin, (req, res) => {
    const countryId = req.params.id;

    countryService.deleteCountry(countryId)
        .then(() => res.redirect('/countries'))
        .catch(err => res.status(404).render('404', { message: `Error deleting country: ${err.message}` }));
});

app.get('/404', (req, res) => {
    res.render('404', { message: "Page not found" });
});
