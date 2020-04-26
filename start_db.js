// Import our models
const { selector_set, selectors } = require(__dirname + '/models.js');

selector_set.sync({ force: true });
// selectors.sync({ force: true });