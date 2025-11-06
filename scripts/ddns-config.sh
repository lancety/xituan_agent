#!/bin/bash
# DDNS Configuration Example
# Copy this file to ddns-config.sh and fill in your values
# The ddns-update.sh script will source this file if it exists

# AWS Route 53 Configuration
export DOMAIN="xituan.com.au"
export SUBDOMAIN="backend-dev"
export HOSTED_ZONE_ID="Z04957681Q52HNHG6LXQT"
export TTL=300
export CHECK_INTERVAL=300  # 5 minutes in seconds

# AWS Credentials (optional - if not using aws configure)
# export AWS_ACCESS_KEY_ID="your_access_key_id"
# export AWS_SECRET_ACCESS_KEY="your_secret_access_key"
# export AWS_DEFAULT_REGION="us-east-1"

