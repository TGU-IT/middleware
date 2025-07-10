const { v4: uuidv4 } = require('uuid');
module.exports = function generateUploadId() {
    return uuidv4();
};
