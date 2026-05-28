#!/bin/bash

export HARNESS_API_KEY=<HARNESS_API_KEY>    # This is the API key of the Harness account you are using
export SPLIT_API_KEY=<SPLIT_API_KEY> # This is the Admin API key of the Split account you are using
export HARNESS_ACCOUNT_ID=<HARNESS_ACCOUNT_ID>  # This is the account ID of the Harness account you are using
export TARGET_HARNESS_ORG_ID=<TARGET_HARNESS_ORG_ID>  # This is the org ID of the target Harness account you are using
export TARGET_HARNESS_ACCOUNT_ID=<TARGET_HARNESS_ACCOUNT_ID>  # This is the account ID of the target Harness account you are using

# Run the command
node index.js --extract --transform --load --project ffsample