const { token } = require("../config");
const { createClient } = require("./module");

createClient().login(token);
