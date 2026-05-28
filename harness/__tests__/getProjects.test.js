const fs = require('fs');
const axios = require('axios');
const fetchProjects = require('../getProjects');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../../config');

// Mock dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('../../config', () => ({
  HARNESS_API_KEY: 'test-api-key',
  HARNESS_ACCOUNT_ID: 'test-account-id',
  HARNESS_API_URLS: {
    PROJECTS: 'https://app.harness.io/ng/api/projects'
  }
}));

describe('fetchProjects', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockImplementation(() => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
  });

  test('should fetch projects and save to file', async () => {
    // Mock axios response
    const mockResponse = {
      data: {
        data: {
          content: [
            {
              project: {
                identifier: 'test-project',
                orgIdentifier: 'test-org'
              }
            }
          ]
        }
      }
    };
    
    axios.get.mockResolvedValue(mockResponse);

    // Execute the function
    await fetchProjects();

    // Verify axios was called with correct parameters
    expect(axios.get).toHaveBeenCalledWith(
      `${HARNESS_API_URLS.PROJECTS}?accountIdentifier=${HARNESS_ACCOUNT_ID}&hasModule=true&pageIndex=0&pageSize=100&moduleType=CF`,
      {
        headers: {
          'x-api-key': HARNESS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    // Verify directory was created if it didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./data');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./data', { recursive: true });

    // Verify file was written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './data/projects.json',
      JSON.stringify(mockResponse.data, null, 2)
    );
  });

  test('should handle errors when fetching projects', async () => {
    // Mock console.error
    console.error = jest.fn();
    
    // Mock axios to throw an error
    const mockError = new Error('API error');
    axios.get.mockRejectedValue(mockError);

    // Execute the function
    await fetchProjects();

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Error fetching projects:', mockError);
  });
});
