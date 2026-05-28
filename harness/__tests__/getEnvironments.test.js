const fs = require('fs');
const axios = require('axios');
const fetchEnvironments = require('../getEnvironments');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../../config');

// Mock dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('../../config', () => ({
  HARNESS_API_KEY: 'test-api-key',
  HARNESS_ACCOUNT_ID: 'test-account-id',
  HARNESS_API_URLS: {
    ENVIRONMENTS: 'https://app.harness.io/ng/api/environmentsV2'
  }
}));

describe('fetchEnvironments', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockImplementation(() => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockImplementation(() => JSON.stringify({
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
    }));
  });

  test('should fetch environments for each project and save to file', async () => {
    // Mock axios response
    const mockResponse = {
      data: {
        data: {
          content: [
            {
              environment: {
                identifier: 'test-env',
                name: 'Test Environment'
              }
            }
          ]
        }
      }
    };
    
    axios.get.mockResolvedValue(mockResponse);

    // Execute the function
    await fetchEnvironments('test-project');

    // Verify axios was called with correct parameters
    expect(axios.get).toHaveBeenCalledWith(
      `${HARNESS_API_URLS.ENVIRONMENTS}?page=0&size=100&accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=test-org&projectIdentifier=test-project`,
      {
        headers: {
          'x-api-key': HARNESS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    // Verify directory was created if it didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./data/test-org/test-project');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./data/test-org/test-project', { recursive: true });

    // Verify file was written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './data/test-org/test-project/environments.json',
      JSON.stringify(mockResponse.data, null, 2)
    );
  });

  test('should handle errors when fetching environments', async () => {
    // Mock console.error
    console.error = jest.fn();
    
    // Mock axios to throw an error
    const mockError = new Error('API error');
    axios.get.mockRejectedValue(mockError);

    // Execute the function
    await fetchEnvironments('test-project');

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Error fetching environments:', mockError);
  });

  test('should filter projects based on the filter parameter', async () => {
    // Mock readFileSync to return multiple projects
    fs.readFileSync.mockImplementation(() => JSON.stringify({
      data: {
        content: [
          {
            project: {
              identifier: 'test-project',
              orgIdentifier: 'test-org'
            }
          },
          {
            project: {
              identifier: 'other-project',
              orgIdentifier: 'test-org'
            }
          }
        ]
      }
    }));

    // Mock axios response
    axios.get.mockResolvedValue({
      data: {
        data: {
          content: []
        }
      }
    });

    // Execute the function with a filter
    await fetchEnvironments('test');

    // Verify axios was called only for the matching project
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('projectIdentifier=test-project'),
      expect.any(Object)
    );
  });
});
