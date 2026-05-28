const fs = require('fs');
const axios = require('axios');
const fetchTargetGroups = require('../getTargetGroups');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../../config');

// Mock dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('../../config', () => ({
  HARNESS_API_KEY: 'test-api-key',
  HARNESS_ACCOUNT_ID: 'test-account-id',
  HARNESS_API_URLS: {
    TARGET_GROUPS: 'https://app.harness.io/cf/admin/segments'
  }
}));

describe('fetchTargetGroups', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockImplementation(() => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    
    // Mock projects.json
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('projects.json')) {
        return JSON.stringify({
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
        });
      }
      // Mock environments.json
      if (path.includes('environments.json')) {
        return JSON.stringify({
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
        });
      }
      return '{}';
    });
  });

  test('should fetch target groups for each environment and save to file', async () => {
    // Mock axios response
    const mockResponse = {
      data: {
        segments: [
          {
            identifier: 'test-group',
            name: 'Test Group',
            included: [
              { identifier: 'user1' },
              { identifier: 'user2' }
            ]
          }
        ],
        pageCount: 1
      }
    };
    
    axios.get.mockResolvedValue(mockResponse);

    // Execute the function
    await fetchTargetGroups('test-project');

    // Verify axios was called with correct parameters
    expect(axios.get).toHaveBeenCalledWith(
      `${HARNESS_API_URLS.TARGET_GROUPS}?pageNumber=0&pageSize=100&accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=test-org&projectIdentifier=test-project&environmentIdentifier=test-env`,
      {
        headers: {
          'x-api-key': HARNESS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    // Verify directory was created if it didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./data/test-org/test-project/test-env');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./data/test-org/test-project/test-env', { recursive: true });

    // Verify file was written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './data/test-org/test-project/test-env/targetGroups.json',
      JSON.stringify(mockResponse.data.segments, null, 2)
    );
  });

  test('should handle pagination when fetching target groups', async () => {
    // Mock axios responses for pagination
    const mockResponse1 = {
      data: {
        segments: [{ identifier: 'group1' }],
        pageCount: 2
      }
    };
    
    const mockResponse2 = {
      data: {
        segments: [{ identifier: 'group2' }],
        pageCount: 2
      }
    };
    
    axios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

    // Execute the function
    await fetchTargetGroups('test-project');

    // Verify axios was called twice for pagination
    expect(axios.get).toHaveBeenCalledTimes(2);
    
    // Verify file was written with combined data from both pages
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './data/test-org/test-project/test-env/targetGroups.json',
      JSON.stringify([{ identifier: 'group1' }, { identifier: 'group2' }], null, 2)
    );
  });

  test('should handle errors when fetching target groups', async () => {
    // Mock console.error
    console.error = jest.fn();
    
    // Mock axios to throw an error
    const mockError = new Error('API error');
    axios.get.mockRejectedValue(mockError);

    // Execute the function
    await fetchTargetGroups('test-project');

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Error fetching Target Groups:', mockError);
  });
});
