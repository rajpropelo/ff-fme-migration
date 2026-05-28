const axios = require('axios');
const fs = require('fs');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../config');

async function fetchEnvironments(filterProject) {

    const projects = JSON.parse(fs.readFileSync('./data/projects.json')).data.content;
    
    const projectIds = projects.map((project) => {
      return {
        "project": project.project.identifier, 
        "org": project.project.orgIdentifier
      };
    }).filter((element) => element.project.match(filterProject));
for (const project of projectIds) {

  try {
    const response = await axios.get(`${HARNESS_API_URLS.ENVIRONMENTS}?page=0&size=100&accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=${project.org}&projectIdentifier=${project.project}`, {
      headers: {
        'x-api-key': `${HARNESS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const dir = `./data/${project.org}/${project.project}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Save the feature flags to a JSON file
    fs.writeFileSync(`./data/${project.org}/${project.project}/environments.json`, JSON.stringify(response.data, null, 2));
    console.log(`Environment  ${project.org}/${project.project} saved to environments.json`);
  } catch (error) {
    console.error('Error fetching environments:', error);
  }
}
}


module.exports = fetchEnvironments;
