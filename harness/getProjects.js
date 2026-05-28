const axios = require('axios');
const fs = require('fs');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../config');

async function fetchProjects() {
  try {
    const response = await axios.get(`${HARNESS_API_URLS.PROJECTS}?accountIdentifier=${HARNESS_ACCOUNT_ID}&hasModule=true&pageIndex=0&pageSize=100&moduleType=CF`, {
      headers: {
        'x-api-key': `${HARNESS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    // Save the projects to a JSON file
    const dir = './data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync('./data/projects.json', JSON.stringify(response.data, null, 2));
    console.log('Projects saved to projects.json');
  } catch (error) {
    console.error('Error fetching projects:', error);
  }
}


module.exports = fetchProjects;
