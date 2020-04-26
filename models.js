const { Sequelize, Model, DataTypes } = require('sequelize');

// Get env name
const env = process.env.NODE_ENV || 'development';

// Get database config dict
const config = require(__dirname + '/config.json')[env];

// Start a db connection
sequelize = new Sequelize(config.database, config.username, config.password, config);

// ==============================================================================
// Create our models from here on ===============================================
// ==============================================================================

const selector_set = sequelize.define('selector_sets', {
	set_name: { type: Sequelize.STRING },
	hash_id: { type: Sequelize.STRING },
	selectors_json: { type: Sequelize.TEXT },
}, {/* options */});
module.exports.selector_set = selector_set;


// const selectors = sequelize.define('selectors', {
// 	selector_set_id: { type: Sequelize.INTEGER },
// 	selector_string: { type: Sequelize.STRING },
// 	tag: { type: Sequelize.STRING },
// 	attribute: { type: Sequelize.STRING },
// 	hash_id: { type: Sequelize.STRING },
// }, {/* options */});
// module.exports.selectors = selectors;