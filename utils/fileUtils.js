const fs = require('fs');
const path = require('path');

function caseExactFileExists(filePath) {
    try {
      // If the file exists, check that the case matches exactly
      const directoryPath = path.dirname(filePath);
      const fileName = path.basename(filePath);
      
      // Get the actual files in the directory with their exact case
      const filesInDir = fs.readdirSync(directoryPath);
      
      // Check if our exact filename (with matching case) is in the directory
      return filesInDir.includes(fileName);
    } catch (error) {
      // If there's any error (e.g., directory doesn't exist), file doesn't exist
      return false;
    }
  }

  module.exports = {
    caseExactFileExists
  }