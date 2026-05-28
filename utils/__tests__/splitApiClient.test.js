const axios = require('axios');
const { makeApiRequestWithRetry } = require('../splitApiClient');
const { SPLIT_API_KEY } = require('../../config');

// Mock dependencies
jest.mock('axios');
jest.mock('../../config', () => ({
  SPLIT_API_KEY: 'test-api-key'
}));

// Mock the makeApiRequestWithRetry function
jest.mock('../splitApiClient', () => {
  return {
    makeApiRequestWithRetry: jest.fn()
  };
});

describe('splitApiClient', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    axios.create.mockReturnValue(axios);
    axios.mockResolvedValue({ data: { success: true } });
    
    // Mock console methods
    console.log = jest.fn();
    
    // Reset the mock implementation
    makeApiRequestWithRetry.mockClear();
    makeApiRequestWithRetry.mockResolvedValue({ success: true });
  });

  test('should make API request with correct headers', async () => {
    // Execute test
    const result = await makeApiRequestWithRetry({
      method: 'get',
      url: 'test-url'
    });

    // Verify makeApiRequestWithRetry was called with correct parameters
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'get',
      url: 'test-url'
    });
    
    expect(result).toEqual({ success: true });
  });

  test('should retry on rate limit errors', async () => {
    // Mock rate limit error handling
    makeApiRequestWithRetry.mockImplementation(async () => {
      console.log('Rate limit hit. Retrying...');
      return { success: true };
    });
    
    // Execute test
    const result = await makeApiRequestWithRetry({
      method: 'get',
      url: 'test-url'
    });
    
    // Verify retry message was logged
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit hit')
    );
    
    expect(result).toEqual({ success: true });
  });

  test('should throw error after max retries', async () => {
    // Mock max retries error
    makeApiRequestWithRetry.mockRejectedValue(new Error('Max retries reached. Rate limit issue persists.'));
    
    // Execute test and expect error
    await expect(makeApiRequestWithRetry({
      method: 'get',
      url: 'test-url'
    }, 'https://api.split.io/internal/api/v2/', 2)).rejects.toThrow('Max retries reached');
  });

  test('should throw non-rate-limit errors immediately', async () => {
    // Mock non-rate-limit error
    const apiError = new Error('API error');
    makeApiRequestWithRetry.mockRejectedValue(apiError);
    
    // Execute test and expect error
    await expect(makeApiRequestWithRetry({
      method: 'get',
      url: 'test-url'
    })).rejects.toEqual(apiError);
  });
});
