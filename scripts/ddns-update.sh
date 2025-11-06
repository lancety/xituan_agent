#!/bin/bash
# AWS Route 53 DDNS Update Script
# This script runs continuously and updates DNS record every 5 minutes
# Usage: ./ddns-update.sh

# Load configuration from config file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/ddns-config.sh"

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo "Loaded configuration from $CONFIG_FILE"
else
    # Default configuration - Replace with your values
    DOMAIN="example.com"              # Your domain
    SUBDOMAIN="api"                   # Subdomain like api.example.com (leave empty for root domain)
    HOSTED_ZONE_ID="Z1234567890ABC"   # Your Route 53 Hosted Zone ID
    TTL=300                           # TTL in seconds (5 minutes)
    CHECK_INTERVAL=300                # Check interval in seconds (5 minutes)
fi

# Build full domain name
if [ -n "$SUBDOMAIN" ]; then
    FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
else
    FULL_DOMAIN="${DOMAIN}"
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to get current public IP
get_current_ip() {
    local ip=""
    
    # Try api.ipify.org first
    ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null)
    
    # If failed, try ifconfig.me
    if [ -z "$ip" ]; then
        ip=$(curl -s --max-time 5 http://ifconfig.me 2>/dev/null)
    fi
    
    # If still failed, try icanhazip.com
    if [ -z "$ip" ]; then
        ip=$(curl -s --max-time 5 https://icanhazip.com 2>/dev/null)
    fi
    
    echo "$ip"
}

# Function to get current DNS record IP
get_dns_record_ip() {
    local domain="$1"
    local domain_with_dot="${domain}."
    
    local json_output=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --query "ResourceRecordSets[?Name=='${domain_with_dot}' && Type=='A']" \
        --output json 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "ERROR: $json_output" >&2
        echo ""
        return 1
    fi
    
    # Extract IP from JSON using jq if available, or grep/sed
    if command -v jq &> /dev/null; then
        local ip=$(echo "$json_output" | jq -r '.[0].ResourceRecords[0].Value // empty' 2>/dev/null)
        echo "$ip"
    else
        # Fallback: use grep and sed
        local ip=$(echo "$json_output" | grep -o '"Value"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"Value"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        echo "$ip"
    fi
}

# Function to update DNS record
update_dns_record() {
    local domain="$1"
    local new_ip="$2"
    local ttl="$3"
    local domain_with_dot="${domain}."
    
    # Create change batch JSON
    local change_batch=$(cat <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${domain_with_dot}",
        "Type": "A",
        "TTL": ${ttl},
        "ResourceRecords": [
          {
            "Value": "${new_ip}"
          }
        ]
      }
    }
  ]
}
EOF
)
    
    # Save to temporary file
    local temp_file=$(mktemp)
    echo "$change_batch" > "$temp_file"
    
    # Update DNS record
    local result=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch "file://${temp_file}" \
        --output json 2>&1)
    
    local exit_code=$?
    
    # Clean up temp file
    rm -f "$temp_file"
    
    if [ $exit_code -eq 0 ]; then
        echo "$result"
        return 0
    else
        echo "ERROR: $result" >&2
        return 1
    fi
}

# Function to log with timestamp
log() {
    local level="$1"
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${GREEN}[$timestamp] [INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] [WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] [ERROR]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${CYAN}[$timestamp] [SUCCESS]${NC} $message"
            ;;
        *)
            echo -e "[$timestamp] $message"
            ;;
    esac
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    log "ERROR" "AWS CLI not found. Please install AWS CLI first."
    log "INFO" "Download from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    log "ERROR" "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

log "INFO" "Starting DDNS update service for ${FULL_DOMAIN}"
log "INFO" "Check interval: ${CHECK_INTERVAL} seconds ($(($CHECK_INTERVAL / 60)) minutes)"
log "INFO" "Hosted Zone ID: ${HOSTED_ZONE_ID}"

# Main loop
while true; do
    log "INFO" "Checking IP for ${FULL_DOMAIN}..."
    
    # Get current public IP
    current_ip=$(get_current_ip)
    
    if [ -z "$current_ip" ]; then
        log "ERROR" "Could not get current public IP"
        sleep "$CHECK_INTERVAL"
        continue
    fi
    
    log "INFO" "Current public IP: ${current_ip}"
    
    # Get existing DNS record IP
    dns_ip=$(get_dns_record_ip "$FULL_DOMAIN")
    
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to get DNS record"
        sleep "$CHECK_INTERVAL"
        continue
    fi
    
    if [ -z "$dns_ip" ]; then
        log "WARN" "DNS record not found. Creating new A record..."
        dns_ip=""
    else
        log "INFO" "Existing DNS IP: ${dns_ip}"
    fi
    
    # Update if IP changed
    if [ "$current_ip" != "$dns_ip" ]; then
        if [ -z "$dns_ip" ]; then
            log "INFO" "Creating new A record with IP: ${current_ip}"
        else
            log "INFO" "IP changed from ${dns_ip} to ${current_ip}, updating DNS record..."
        fi
        
        update_result=$(update_dns_record "$FULL_DOMAIN" "$current_ip" "$TTL")
        
        if [ $? -eq 0 ]; then
            log "SUCCESS" "DNS record updated successfully!"
            log "SUCCESS" "  Domain: ${FULL_DOMAIN}"
            log "SUCCESS" "  New IP: ${current_ip}"
            log "SUCCESS" "  TTL: ${TTL} seconds"
            
            # Extract change ID if available
            if command -v jq &> /dev/null; then
                change_id=$(echo "$update_result" | jq -r '.ChangeInfo.Id // empty' 2>/dev/null)
                if [ -n "$change_id" ]; then
                    log "INFO" "  Change ID: ${change_id}"
                fi
            fi
        else
            log "ERROR" "Failed to update DNS record"
            log "ERROR" "Response: ${update_result}"
        fi
    else
        log "INFO" "IP unchanged (${current_ip}), no update needed"
    fi
    
    log "INFO" "Next check in ${CHECK_INTERVAL} seconds..."
    log "INFO" "---"
    
    # Wait for next check
    sleep "$CHECK_INTERVAL"
done

