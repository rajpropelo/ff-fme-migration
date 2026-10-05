const axios = require('axios');
const fs = require('fs');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../config');

async function fetchProjects() {
  try {
    const pageSize = 100;
    const headers = {
      'x-api-key': `${HARNESS_API_KEY}`,
      'Content-Type': 'application/json',
    };
    const getPage = (pageIndex) => axios.get(
      `${HARNESS_API_URLS.PROJECTS}?accountIdentifier=${HARNESS_ACCOUNT_ID}&hasModule=true&pageIndex=${pageIndex}&pageSize=${pageSize}&moduleType=CF`,
      { headers },
    );

    console.log('[extract:projects] Fetching page 1...');
    const response = await getPage(0);
    const totalPages = response.data.data.totalPages || 1;
    const projects = [...response.data.data.content];

    for (let pageIndex = 1; pageIndex < totalPages; pageIndex += 1) {
      console.log(`[extract:projects] Fetching page ${pageIndex + 1}/${totalPages}...`);
      const pageResponse = await getPage(pageIndex);
      projects.push(...pageResponse.data.data.content);
    }

    response.data.data.content = projects;
    response.data.data.pageItemCount = projects.length;

    // Save the projects to a JSON file
    const dir = './data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync('./data/projects.json', JSON.stringify(response.data, null, 2));
    console.log(`[extract:projects] Saved ${projects.length} projects to data/projects.json`);
    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return undefined;
  }
}


module.exports = fetchProjects;
