const fs = require('fs');
const axios = require('axios');
const fetchTargets = require('../getTargets');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../../config');

// Mock dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('../../config', () => ({
  HARNESS_API_KEY: 'test-api-key',
  HARNESS_ACCOUNT_ID: 'test-account-id',
  HARNESS_API_URLS: {
    TARGETS: 'https://app.harness.io/cf/admin/targets'
  }
}));

describe('fetchTargets', () => {
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

  test('should fetch targets for each environment and save to file', async () => {
    // Mock axios response
    const mockResponse = {
      data: {
        targets: [
          {
            identifier: 'test-target',
            name: 'Test Target',
            attributes: [
              { name: 'attr1', value: 'value1' },
              { name: 'attr2', value: 'value2' }
            ]
          }
        ],
        pageCount: 1
      }
    };
    
    axios.get.mockResolvedValue(mockResponse);

    // Execute the function
    await fetchTargets('test-project');

    // Verify axios was called with correct parameters
    expect(axios.get).toHaveBeenCalledWith(
      `${HARNESS_API_URLS.TARGETS}?pageNumber=0&pageSize=100&accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=test-org&projectIdentifier=test-project&environmentIdentifier=test-env`,
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
      './data/test-org/test-project/test-env/targets.json',
      JSON.stringify(mockResponse.data.targets, null, 2)
    );
  });

  test('should handle pagination when fetching targets', async () => {
    // Mock axios responses for pagination
    const mockResponse1 = {
      data: {
        targets: [{ identifier: 'target1', attributes: [] }],
        pageCount: 2
      }
    };
    
    const mockResponse2 = {
      data: {
        targets: [{ identifier: 'target2', attributes: [] }],
        pageCount: 2
      }
    };
    
    axios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

    // Execute the function
    await fetchTargets('test-project');

    // Verify axios was called twice for pagination
    expect(axios.get).toHaveBeenCalledTimes(2);
    
    // Verify file was written with combined data from both pages
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './data/test-org/test-project/test-env/targets.json',
      JSON.stringify([{ identifier: 'target1', attributes: [] }, { identifier: 'target2', attributes: [] }], null, 2)
    );
  });

  test('should handle errors when fetching targets', async () => {
    // Mock console.error
    console.error = jest.fn();
    
    // Mock axios to throw an error
    const mockError = new Error('API error');
    axios.get.mockRejectedValue(mockError);

    // Execute the function
    await fetchTargets('test-project');

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Error fetching Targets:', mockError);
  });
});
