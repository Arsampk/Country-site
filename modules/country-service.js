require('dotenv').config();
const Sequelize = require('sequelize');

let sequelize = new Sequelize(
    process.env.DB_DATABASE,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: "postgres",
        dialectModule: require("pg"),
        port: 5432,

        dialectOptions: {
            ssl: { rejectUnauthorized: false },
        },
    }
);

const SubRegion = sequelize.define('SubRegion', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    subRegion: Sequelize.STRING,
    region: Sequelize.STRING
}, { timestamps: false });

const Country = sequelize.define('Country', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    commonName: Sequelize.STRING,
    officialName: Sequelize.STRING,
    nativeName: Sequelize.STRING,
    currencies: Sequelize.STRING,
    capital: Sequelize.STRING,
    languages: Sequelize.STRING,
    openStreetMaps: Sequelize.STRING,
    population: Sequelize.INTEGER,
    area: Sequelize.INTEGER,
    landlocked: Sequelize.BOOLEAN,
    coatOfArms: Sequelize.TEXT,
    flag: Sequelize.TEXT,
    subRegionId: Sequelize.INTEGER
}, { timestamps: false });


Country.belongsTo(SubRegion, { foreignKey: 'subRegionId' });

async function importData(countryData, subRegionData) {
    try {
        await SubRegion.bulkCreate(subRegionData, { ignoreDuplicates: true });
        console.log("SubRegions data imported successfully.");

        const subRegions = await SubRegion.findAll();
        const subRegionMap = {};
        subRegions.forEach(subRegion => {
            subRegionMap[subRegion.id] = subRegion.subRegion;
        });

        const validCountryData = countryData.filter(country => {
            return subRegionMap[country.subRegionId];
        });

        await Country.bulkCreate(validCountryData, { ignoreDuplicates: true });
        console.log("Countries data imported successfully.");
    } catch (error) {
        console.error("Error importing data:", error);
    }
}

function initialize(countryData, subRegionData) {
    return sequelize.sync({ alter: true })
        .then(async () => {
            console.log("Database synced successfully.");
            //await importData(countryData, subRegionData);
        })
        .catch(err => Promise.reject("Unable to sync the database: " + err));
}

function getAllCountries() {
    return Country.findAll({
        include: [SubRegion]
    });
}

function getCountryById(id) {
    return Country.findOne({
        where: { id },
        include: [{ model: SubRegion }],
    }).then(country => {
        if (!country) {
            return null;
        }
        return {
            id: country.id,
            commonName: country.commonName,
            officialName: country.officialName,
            nativeName: country.nativeName,
            capital: country.capital,
            population: country.population,
            region: country.SubRegion.region,
            subRegion: country.SubRegion.subRegion,
            area: country.area,
            flag: country.flag,
            coatOfArms: country.coatOfArms,
        };
    });
}

function getCountriesBySubRegion(subRegion) {
    return Country.findAll({
        include: [SubRegion],
        where: {
            '$SubRegion.subRegion$': { [Sequelize.Op.iLike]: `%${subRegion}%` }
        }
    });
}

function getCountriesByRegion(region) {
    return Country.findAll({
        include: [SubRegion],
        where: {
            '$SubRegion.region$': region
        }
    });
}

async function addCountry(countryData) {
    const existingCountry = await Country.findOne({ where: { id: countryData.id } });
    if (existingCountry) {
        // Handle the case where the ID already exists
        throw new Error(`A country with the ID ${countryData.id} already exists.`);
    }

    const validatedData = {
        ...countryData,
        currencies: countryData.currencies || '',
        languages: countryData.languages || '',
        openStreetMaps: countryData.openStreetMaps || '',
        coatOfArms: countryData.coatOfArms || '',
        flag: countryData.flag || ''
    };

    return Country.create(validatedData);
}

function editCountry(id, countryData) {
    return Country.update(countryData, {
        where: { id }
    });
}

function deleteCountry(id) {
    return Country.destroy({ where: { id } });
}

function getAllSubRegions() {
    return SubRegion.findAll();
}

module.exports = {
    initialize,
    //importData,
    getAllCountries,
    getCountryById,
    getCountriesBySubRegion,
    getCountriesByRegion,
    addCountry,
    editCountry,
    deleteCountry,
    getAllSubRegions
};
