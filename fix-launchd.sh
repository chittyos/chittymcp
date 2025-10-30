#!/bin/bash

# ChittyMCP LaunchD Service Repair Script
# Fixes macOS LaunchDaemons for MCP services
# Usage: sudo bash fix-launchd.sh [--dry-run]

# IMPORTANT: This script requires root privileges
if [ "$EUID" -ne 0 ] && [ "$1" != "--dry-run" ]; then
    echo "This script must be run as root (use sudo)"
    exit 1
fi

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Flags
DRY_RUN=false
BACKUP_DIR="/tmp/launchd-backups-$(date +%Y%m%d-%H%M%S)"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
    esac
done

log_action() {
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Execute or simulate
execute() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} $1"
    else
        eval "$1"
    fi
}

# Create backup
create_backup() {
    local file=$1
    if [ -f "$file" ]; then
        execute "mkdir -p $BACKUP_DIR"
        execute "cp $file $BACKUP_DIR/$(basename $file)"
        log_info "Backed up: $(basename $file)"
    fi
}

# Fix plist file
fix_plist() {
    local plist_path=$1
    local service_name=$2
    local program_path=$3
    local log_dir=$4

    log_action "Fixing $service_name"

    if [ ! -f "$plist_path" ]; then
        log_warn "Plist not found: $plist_path (will create)"
        return 0
    fi

    create_backup "$plist_path"

    # Create temporary fixed version
    local temp_plist="/tmp/$(basename $plist_path).tmp"

    cat > "$temp_plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$service_name</string>

    <key>ProgramArguments</key>
    <array>
        <string>$program_path</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>StandardOutPath</key>
    <string>$log_dir/$(basename $service_name).out.log</string>

    <key>StandardErrorPath</key>
    <string>$log_dir/$(basename $service_name).err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>

    <key>ProcessType</key>
    <string>Background</string>

    <key>Nice</key>
    <integer>0</integer>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

    # Validate XML
    if plutil -lint "$temp_plist" &>/dev/null; then
        execute "mv $temp_plist $plist_path"
        execute "chmod 644 $plist_path"
        execute "chown root:wheel $plist_path"
        log_success "Fixed $service_name plist"
        return 0
    else
        log_error "Failed to generate valid plist for $service_name"
        rm -f "$temp_plist"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║        ChittyMCP LaunchD Repair v1.0                  ║"
    echo "║        macOS Service Configuration Fixer              ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY-RUN MODE - No changes will be made"
    fi

    # Check if on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "This script is only for macOS"
        exit 1
    fi

    # Create log directories
    log_action "Creating log directories"
    execute "mkdir -p /usr/local/var/log/chittyos"
    execute "chmod 755 /usr/local/var/log/chittyos"
    log_success "Log directories created"

    # Define services to fix
    declare -A SERVICES=(
        ["com.chitty.external.monitor"]="/usr/local/bin/chitty-monitor"
        ["com.chittycorp.session-orchestrator"]="/usr/local/bin/chitty-orchestrator"
        ["com.chittyos.sync"]="/usr/local/bin/chitty-sync"
        ["com.user.storage-daemon"]="/usr/local/bin/storage-daemon"
    )

    # Fix each service
    echo ""
    log_section() {
        echo -e "${CYAN}═════════════════════════════════════${NC}"
        echo -e "${CYAN}  $1${NC}"
        echo -e "${CYAN}═════════════════════════════════════${NC}"
    }

    log_section "Fixing LaunchDaemon Plists"

    for service in "${!SERVICES[@]}"; do
        local plist_path="/Library/LaunchDaemons/${service}.plist"
        local program="${SERVICES[$service]}"
        local log_dir="/usr/local/var/log/chittyos"

        # Unload if running
        if launchctl list | grep -q "$service"; then
            log_action "Unloading $service"
            execute "launchctl unload $plist_path 2>/dev/null || true"
            log_success "Unloaded $service"
        fi

        # Fix plist
        fix_plist "$plist_path" "$service" "$program" "$log_dir"

        # Reload
        if [ -f "$plist_path" ] && [ "$DRY_RUN" = false ]; then
            log_action "Loading $service"
            execute "launchctl load $plist_path"
            log_success "Loaded $service"
        fi
    done

    # Check conflicts
    echo ""
    log_section "Checking for Conflicts"

    log_action "Checking for duplicate labels"
    local labels=$(launchctl list | grep -E "com\.(chitty|chittycorp|chittyos)" | awk '{print $3}')

    if [ -n "$labels" ]; then
        log_info "Active ChittyOS services:"
        echo "$labels" | while read -r label; do
            echo "    - $label"
        done

        # Check for duplicates
        local duplicates=$(echo "$labels" | sort | uniq -d)
        if [ -n "$duplicates" ]; then
            log_error "Duplicate service labels found:"
            echo "$duplicates" | while read -r dup; do
                echo "    - $dup"
            done
            log_info "Unload duplicates manually: launchctl unload /Library/LaunchDaemons/<service>.plist"
        else
            log_success "No duplicate labels found"
        fi
    else
        log_warn "No ChittyOS services currently loaded"
    fi

    # Test log files
    echo ""
    log_section "Testing Log Files"

    for service in "${!SERVICES[@]}"; do
        local out_log="/usr/local/var/log/chittyos/${service}.out.log"
        local err_log="/usr/local/var/log/chittyos/${service}.err.log"

        if [ -f "$out_log" ]; then
            log_success "$service stdout log exists"
        else
            log_warn "$service stdout log not yet created"
        fi

        if [ -f "$err_log" ]; then
            # Check if has recent errors
            local error_count=$(tail -20 "$err_log" 2>/dev/null | grep -i "error" | wc -l || echo "0")
            if [ "$error_count" -gt 0 ]; then
                log_warn "$service has $error_count recent errors in log"
            else
                log_success "$service error log exists (no recent errors)"
            fi
        else
            log_warn "$service error log not yet created"
        fi
    done

    # Summary
    echo ""
    log_section "Repair Summary"

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY-RUN MODE - No changes were made"
        log_info "Run without --dry-run to apply fixes (requires sudo)"
    else
        log_success "LaunchD services repaired"
        log_info "Backups saved to: $BACKUP_DIR"
    fi

    echo ""
    echo "Next Steps:"
    echo ""
    echo "1. Check service status:"
    echo "   launchctl list | grep chitty"
    echo ""
    echo "2. Monitor logs:"
    echo "   tail -f /usr/local/var/log/chittyos/*.err.log"
    echo ""
    echo "3. If services are crashing, check program paths:"
    echo "   ls -l /usr/local/bin/chitty-*"
    echo ""
    echo "4. Restart services if needed:"
    echo "   sudo launchctl unload /Library/LaunchDaemons/com.chitty*.plist"
    echo "   sudo launchctl load /Library/LaunchDaemons/com.chitty*.plist"
    echo ""
    echo "5. For persistent issues, check system logs:"
    echo "   log show --predicate 'subsystem == \"com.apple.launchd\"' --last 30m"
    echo ""
}

# Run main
main "$@"
